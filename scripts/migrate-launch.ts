#!/usr/bin/env npx tsx
/**
 * Migrate Launch Script (Initializer + CPMM migrator)
 *
 * Usage:
 *   pnpm tsx scripts/migrate-launch.ts [--simulate] <LAUNCH_ADDRESS>
 *
 * Environment:
 *   SOLANA_RPC_URL       defaults to https://api.devnet.solana.com
 *   SOLANA_KEYPAIR       optional JSON array of 64 bytes
 *   SOLANA_KEYPAIR_PATH  optional path to a JSON keypair file
 *                        defaults to ~/.config/solana/id.json
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import {
  AccountRole,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  address,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import { cpmm, initializer, cpmmMigrator } from '../src/solana/index.js';

const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const RPC_URL = process.env.SOLANA_RPC_URL ?? DEVNET_RPC_URL;
const COMPUTE_BUDGET_PROGRAM_ID = address(
  'ComputeBudget111111111111111111111111111111',
);
const MIGRATION_COMPUTE_UNIT_LIMIT = Number(
  process.env.SOLANA_MIGRATE_COMPUTE_UNIT_LIMIT ?? 400_000,
);

type SolanaRpc = Rpc<SolanaRpcApi>;

async function loadKeypair(): Promise<KeyPairSigner> {
  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH ??
    join(homedir(), '.config', 'solana', 'id.json');
  const raw =
    process.env.SOLANA_KEYPAIR ?? (await readFile(keypairPath, 'utf-8'));
  return createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(raw)));
}

async function accountExists(
  rpc: SolanaRpc,
  account: Address,
): Promise<boolean> {
  const response = await rpc
    .getAccountInfo(account, { encoding: 'base64' })
    .send();
  return response.value !== null;
}

async function getAta(mint: Address, owner: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    mint,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata;
}

async function maybeCreateAtaInstruction(
  rpc: SolanaRpc,
  payer: TransactionSigner,
  ata: Address,
  owner: Address,
  mint: Address,
): Promise<Instruction | undefined> {
  if (await accountExists(rpc, ata)) return undefined;
  return getCreateAssociatedTokenIdempotentInstruction({
    payer,
    ata,
    owner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
}

function createSetComputeUnitLimitInstruction(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM_ID,
    accounts: [],
    data,
  };
}

async function simulateWireTransaction(wireTransaction: string) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'simulateTransaction',
      params: [
        wireTransaction,
        {
          encoding: 'base64',
          commitment: 'confirmed',
          sigVerify: true,
          replaceRecentBlockhash: false,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `simulateTransaction HTTP ${response.status}: ${await response.text()}`,
    );
  }

  const body = (await response.json()) as {
    error?: unknown;
    result?: {
      value?: { err?: unknown; logs?: string[]; unitsConsumed?: number };
    };
  };
  if (body.error) {
    throw new Error(
      `simulateTransaction RPC error: ${JSON.stringify(body.error)}`,
    );
  }

  const value = body.result?.value;
  if (!value) {
    throw new Error(
      `simulateTransaction missing result: ${JSON.stringify(body)}`,
    );
  }
  return value;
}

function parseArgs(argv: string[]): {
  simulate: boolean;
  launchAddress?: string;
} {
  const simulate = argv.includes('--simulate');
  const filtered = argv.filter((arg) => arg !== '--simulate' && arg !== '--');
  return { simulate, launchAddress: filtered[0] };
}

async function main() {
  const { simulate, launchAddress: launchArg } = parseArgs(
    process.argv.slice(2),
  );
  if (!launchArg) {
    console.log(
      'Usage: pnpm tsx scripts/migrate-launch.ts [--simulate] <LAUNCH_ADDRESS>',
    );
    process.exit(1);
  }

  const launchAddress = address(launchArg);
  const rpc = createSolanaRpc(RPC_URL);
  const caller = await loadKeypair();

  const launch = await initializer.fetchLaunch(rpc, launchAddress);
  if (!launch) {
    throw new Error(`Launch not found: ${launchAddress}`);
  }

  if (
    launch.migratorProgram.toString() !==
    cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID.toString()
  ) {
    throw new Error(
      `Launch migrator_program is not cpmm_migrator: ${launch.migratorProgram}`,
    );
  }

  const [stateAddress] = await cpmmMigrator.getCpmmMigratorStateAddress(
    launchAddress,
    launch.migratorProgram,
  );
  const state = await cpmmMigrator.fetchCpmmMigratorState(rpc, stateAddress);
  if (!state) {
    throw new Error(`Missing cpmm_migrator state: ${stateAddress}`);
  }

  const [initializerConfig] = await initializer.getConfigAddress();
  const [launchAuthority] =
    await initializer.getLaunchAuthorityAddress(launchAddress);
  const [poolAddress] = await cpmm.getPoolAddress(
    launch.baseMint,
    launch.quoteMint,
  );
  const [poolAuthority] = await cpmm.getPoolAuthorityAddress(poolAddress);
  const [poolVault0] = await cpmm.getPoolVault0Address(poolAddress);
  const [poolVault1] = await cpmm.getPoolVault1Address(poolAddress);
  const [protocolPosition] =
    await cpmm.getProtocolFeePositionAddress(poolAddress);
  const [launchLpPosition] = await cpmm.getPositionAddress(
    poolAddress,
    launchAuthority,
    0n,
  );
  const [migrationAuthority] =
    await cpmmMigrator.getCpmmMigrationAuthorityAddress(launch.migratorProgram);

  const ataInstructions: Instruction[] = [];
  const adminBaseAta = await getAta(launch.baseMint, state.admin);
  const adminBaseAtaIx = await maybeCreateAtaInstruction(
    rpc,
    caller,
    adminBaseAta,
    state.admin,
    launch.baseMint,
  );
  if (adminBaseAtaIx) ataInstructions.push(adminBaseAtaIx);

  const adminQuoteAta = await getAta(launch.quoteMint, state.admin);
  const adminQuoteAtaIx = await maybeCreateAtaInstruction(
    rpc,
    caller,
    adminQuoteAta,
    state.admin,
    launch.quoteMint,
  );
  if (adminQuoteAtaIx) ataInstructions.push(adminQuoteAtaIx);

  const recipientAtas: Address[] = [];
  for (const recipient of state.recipients) {
    if (recipient.amount === 0n) continue;
    const recipientAta = await getAta(launch.baseMint, recipient.wallet);
    recipientAtas.push(recipientAta);
    const recipientAtaIx = await maybeCreateAtaInstruction(
      rpc,
      caller,
      recipientAta,
      recipient.wallet,
      launch.baseMint,
    );
    if (recipientAtaIx) ataInstructions.push(recipientAtaIx);
  }

  const migrateIxBase = initializer.createMigrateLaunchInstruction({
    config: initializerConfig,
    launch: launchAddress,
    launchAuthority,
    baseMint: launch.baseMint,
    quoteMint: launch.quoteMint,
    baseVault: launch.baseVault,
    quoteVault: launch.quoteVault,
    migratorProgram: launch.migratorProgram,
    payer: caller,
    baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
  });

  const migrateIx = {
    ...migrateIxBase,
    accounts: [
      ...(migrateIxBase.accounts ?? []),
      { address: stateAddress, role: AccountRole.WRITABLE },
      { address: state.cpmmConfig, role: AccountRole.READONLY },
      { address: poolAddress, role: AccountRole.WRITABLE },
      { address: poolAuthority, role: AccountRole.READONLY },
      { address: poolVault0, role: AccountRole.WRITABLE },
      { address: poolVault1, role: AccountRole.WRITABLE },
      { address: protocolPosition, role: AccountRole.WRITABLE },
      { address: launchLpPosition, role: AccountRole.WRITABLE },
      { address: cpmm.CPMM_PROGRAM_ID, role: AccountRole.READONLY },
      { address: migrationAuthority, role: AccountRole.READONLY },
      { address: adminBaseAta, role: AccountRole.WRITABLE },
      { address: adminQuoteAta, role: AccountRole.WRITABLE },
      ...recipientAtas.map((ata) => ({
        address: ata,
        role: AccountRole.WRITABLE,
      })),
    ],
  } satisfies Instruction;

  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send();
  const message = pipe(
    createTransactionMessage({ version: 'legacy' }),
    (tx) => setTransactionMessageFeePayerSigner(caller, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      appendTransactionMessageInstructions(
        [
          createSetComputeUnitLimitInstruction(MIGRATION_COMPUTE_UNIT_LIMIT),
          ...ataInstructions,
          migrateIx,
        ],
        tx,
      ),
  );

  const signedTx = await signTransactionMessageWithSigners(message);
  const wireTransaction = getBase64EncodedWireTransaction(signedTx);

  if (simulate) {
    const result = await simulateWireTransaction(wireTransaction);
    console.log('='.repeat(60));
    console.log('Launch migration simulation');
    console.log('='.repeat(60));
    console.log(`  Launch:         ${launchAddress}`);
    console.log(`  Pool:           ${poolAddress}`);
    console.log(`  State:          ${stateAddress}`);
    console.log(`  Instructions:   ${ataInstructions.length + 2}`);
    console.log(`  Compute limit:  ${MIGRATION_COMPUTE_UNIT_LIMIT}`);
    console.log(`  Units consumed: ${result.unitsConsumed ?? 'n/a'}`);
    if (result.logs?.length) {
      console.log('  Logs:');
      for (const line of result.logs) console.log(`    ${line}`);
    }
    if (result.err) {
      console.error(`  Error: ${JSON.stringify(result.err)}`);
      process.exit(2);
    }
    console.log('  Result: ok');
    console.log('='.repeat(60));
    return;
  }

  const signature = await rpc
    .sendTransaction(wireTransaction, {
      encoding: 'base64',
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })
    .send();

  console.log('='.repeat(60));
  console.log('Launch migrated');
  console.log('='.repeat(60));
  console.log(`  Signature: ${signature}`);
  console.log(`  Launch:    ${launchAddress}`);
  console.log(`  Pool:      ${poolAddress}`);
  console.log(`  State:     ${stateAddress}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
