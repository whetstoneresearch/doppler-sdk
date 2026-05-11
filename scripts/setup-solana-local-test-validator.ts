#!/usr/bin/env npx tsx
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getAddressCodec,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from '@solana/kit';

import { cpmm, cpmmMigrator, initializer } from '../src/solana/index.js';
import { PREDICTION_MIGRATOR_PROGRAM_ADDRESS } from '../src/solana/generated/predictionMigrator/programs/predictionMigrator.js';

const DEFAULT_RPC_URL = 'http://127.0.0.1:8899';
const DEFAULT_KEYPAIR_PATH = join(homedir(), '.config', 'solana', 'id.json');
const WSOL_MINT = address('So11111111111111111111111111111111111111112');
const LOCAL_RPC_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

const rpcUrl = process.env.SOLANA_RPC_URL ?? DEFAULT_RPC_URL;
const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? DEFAULT_KEYPAIR_PATH;
const allowNonLocalRpc =
  (
    process.env.SOLANA_LOCAL_TEST_ALLOW_NON_LOCAL_RPC ?? 'false'
  ).toLowerCase() === 'true';
const numeraireMint = address(
  process.env.SOLANA_LOCAL_TEST_NUMERAIRE_MINT ?? String(WSOL_MINT),
);
const protocolFeeEnabled =
  (
    process.env.SOLANA_LOCAL_TEST_PROTOCOL_FEE_ENABLED ?? 'true'
  ).toLowerCase() !== 'false';
const protocolFeeBps = Number(
  process.env.SOLANA_LOCAL_TEST_PROTOCOL_FEE_BPS ?? '200',
);

const addressCodec = getAddressCodec();

type LocalTestRpc = Rpc<SolanaRpcApi>;
type TransactionSignature = Awaited<
  ReturnType<ReturnType<LocalTestRpc['sendTransaction']>['send']>
>;

function extractBase64(data: string | [string, string]): string {
  return Array.isArray(data) ? data[0] : data;
}

function assertLocalRpcUrl(url: string): void {
  if (allowNonLocalRpc) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid SOLANA_RPC_URL: ${url}`);
  }

  if (LOCAL_RPC_HOSTS.has(parsed.hostname.toLowerCase())) {
    return;
  }

  throw new Error(
    `Refusing to set up non-local Solana RPC ${url}. ` +
      'This script is intended for local test validators; set ' +
      'SOLANA_LOCAL_TEST_ALLOW_NON_LOCAL_RPC=true to override.',
  );
}

function loadSigner(): Promise<TransactionSigner> {
  const keypair = JSON.parse(readFileSync(keypairPath, 'utf8')) as number[];
  return createKeyPairSignerFromBytes(new Uint8Array(keypair));
}

async function getProgramDataAddress(programId: Address): Promise<Address> {
  const [programData] = await getProgramDerivedAddress({
    programAddress: initializer.BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    seeds: [addressCodec.encode(programId)],
  });
  return programData;
}

async function fetchAccountBytes(
  rpc: LocalTestRpc,
  account: Address,
): Promise<Uint8Array | null> {
  const response = await rpc
    .getAccountInfo(account, { encoding: 'base64' })
    .send();
  if (!response.value) {
    return null;
  }
  return Uint8Array.from(
    Buffer.from(extractBase64(response.value.data), 'base64'),
  );
}

async function waitForAccountBytes(
  rpc: LocalTestRpc,
  account: Address,
  label: string,
): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const bytes = await fetchAccountBytes(rpc, account);
    if (bytes) {
      return bytes;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label} account ${account} was not visible before timeout`);
}

async function sendInstructions(
  rpc: LocalTestRpc,
  payer: TransactionSigner,
  label: string,
  instructions: Instruction[],
): Promise<void> {
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send();
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);
  const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);

  const simulation = await rpc
    .simulateTransaction(wireTransaction, {
      encoding: 'base64',
      commitment: 'confirmed',
    })
    .send();
  if (simulation.value.err) {
    console.error(`${label} simulation failed:`, simulation.value.err);
    simulation.value.logs?.forEach((log) => console.error(`  ${log}`));
    throw new Error(`${label} simulation failed`);
  }

  const signature = await rpc
    .sendTransaction(wireTransaction, {
      encoding: 'base64',
      skipPreflight: true,
      preflightCommitment: 'confirmed',
    })
    .send();
  await waitForSignature(rpc, signature, label);
  console.log(`${label}: ${signature}`);
}

async function waitForSignature(
  rpc: LocalTestRpc,
  signature: TransactionSignature,
  label: string,
): Promise<void> {
  const commitmentRank = { processed: 0, confirmed: 1, finalized: 2 };

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await rpc
      .getSignatureStatuses([signature], { searchTransactionHistory: true })
      .send();
    const status = response.value[0];

    if (status?.err) {
      throw new Error(`${label} failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus &&
      commitmentRank[status.confirmationStatus] >= commitmentRank.confirmed
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label} was not confirmed before timeout`);
}

function trimAllowlist(addresses: readonly Address[], len: number): Address[] {
  return Array.from(addresses.slice(0, len));
}

function listMatches(lhs: readonly Address[], rhs: readonly Address[]) {
  return lhs.length === rhs.length && lhs.every((value, i) => value === rhs[i]);
}

async function setupInitializerConfig(
  rpc: LocalTestRpc,
  payer: TransactionSigner,
) {
  const [config] = await initializer.getConfigAddress();
  const [programData] = await initializer.getProgramDataAddress();
  const expectedMigrators = [
    cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
    PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
  ];
  const expectedHooks = [
    initializer.CPMM_HOOK_PROGRAM_ID,
    initializer.PREDICTION_HOOK_PROGRAM_ID,
  ];

  const existing = await fetchAccountBytes(rpc, config);
  if (!existing) {
    const ix = initializer.createInitializeConfigInstruction(
      {
        admin: payer,
        config,
        programData,
      },
      {
        migratorAllowlist: expectedMigrators,
        hookAllowlist: expectedHooks,
      },
    );
    await sendInstructions(rpc, payer, 'initializer.initialize_config', [ix]);
  }

  const bytes = await waitForAccountBytes(rpc, config, 'initializer config');
  const state = initializer.getInitConfigDecoder().decode(bytes);
  const migrators = trimAllowlist(
    state.migratorAllowlist,
    state.migratorAllowlistLen,
  );
  const hooks = trimAllowlist(state.hookAllowlist, state.hookAllowlistLen);
  if (!listMatches(migrators, expectedMigrators)) {
    await sendInstructions(rpc, payer, 'initializer.set_migrator_allowlist', [
      initializer.createSetMigratorAllowlistInstruction(
        { admin: payer, config },
        expectedMigrators,
      ),
    ]);
  }
  if (!listMatches(hooks, expectedHooks)) {
    await sendInstructions(rpc, payer, 'initializer.set_hook_allowlist', [
      initializer.createSetHookAllowlistInstruction(
        { admin: payer, config },
        expectedHooks,
      ),
    ]);
  }

  console.log(`Initializer config: ${config}`);
}

async function setupCpmmConfig(rpc: LocalTestRpc, payer: TransactionSigner) {
  const [config] = await cpmm.getConfigAddress();
  const programData = await getProgramDataAddress(cpmm.CPMM_PROGRAM_ID);
  const expectedHooks = [initializer.CPMM_HOOK_PROGRAM_ID];

  const existing = await fetchAccountBytes(rpc, config);
  if (!existing) {
    const ix = cpmm.createInitializeConfigInstruction({
      config,
      programData,
      payer,
      admin: payer.address,
      numeraireMint,
      maxSwapFeeBps: 100,
      maxFeeSplitBps: 5000,
      maxRouteHops: 3,
      protocolFeeEnabled,
      protocolFeeBps,
      hookAllowlist: expectedHooks,
    });
    await sendInstructions(rpc, payer, 'cpmm.initialize_config', [ix]);
  }

  await waitForAccountBytes(rpc, config, 'CPMM config');
  const state = await cpmm.fetchConfig(rpc);
  if (!state) {
    throw new Error(`CPMM config ${config} was not initialized`);
  }

  console.log(`CPMM config: ${config}`);
  console.log(`CPMM numeraire mint: ${state.numeraireMint}`);
}

async function main() {
  assertLocalRpcUrl(rpcUrl);

  const rpc = createSolanaRpc(rpcUrl);
  const payer = await loadSigner();
  const balance = await rpc.getBalance(payer.address).send();

  console.log(`RPC: ${rpcUrl}`);
  console.log(`Wallet: ${payer.address}`);
  console.log(`Balance: ${Number(balance.value) / 1e9} SOL`);
  console.log(`Numeraire mint: ${numeraireMint}`);
  console.log();

  await setupInitializerConfig(rpc, payer);
  await setupCpmmConfig(rpc, payer);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
