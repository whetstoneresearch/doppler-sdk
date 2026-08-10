/**
 * Example: Create a permissionless CPMM spot pool (Solana)
 *
 * Creates the payer's token accounts, wraps the configured SOL liquidity, and
 * initializes a base-token/WSOL pool with an immutable fee tier. Set both hook
 * variables to bind the pool to an allowlisted swap-phase hook.
 */
import './env.js';

import { getTransferSolInstruction } from '@solana-program/system';
import {
  getCreateAssociatedTokenIdempotentInstruction,
  getSyncNativeInstruction,
} from '@solana-program/token';
import { address, type Address } from '@solana/kit';

import { cpmm, cpmmMigrator } from '../src/solana/index.js';
import {
  WSOL_MINT,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInstructions,
} from './solanaExampleHelpers.js';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveBigIntEnv(name: string): bigint {
  const value = BigInt(requiredEnv(name));
  if (value <= 0n) {
    throw new Error(`${name} must be greater than zero`);
  }
  return value;
}

function parseHookConfig():
  | undefined
  | { hookProgram: Address; hookFlags: number } {
  const hookProgramText = process.env.SPOT_POOL_HOOK_PROGRAM?.trim();
  const hookFlagsText = process.env.SPOT_POOL_HOOK_FLAGS?.trim();

  if (!hookProgramText && !hookFlagsText) {
    return undefined;
  }
  if (!hookProgramText || !hookFlagsText) {
    throw new Error(
      'SPOT_POOL_HOOK_PROGRAM and SPOT_POOL_HOOK_FLAGS must be set together',
    );
  }

  return {
    hookProgram: address(hookProgramText),
    hookFlags: Number(hookFlagsText),
  };
}

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);

  const baseMint = address(requiredEnv('SPOT_POOL_BASE_MINT'));
  const baseAmount = positiveBigIntEnv('SPOT_POOL_BASE_AMOUNT');
  const quoteAmount = positiveBigIntEnv('SPOT_POOL_QUOTE_AMOUNT_LAMPORTS');
  const swapFeeBps = Number(process.env.SPOT_POOL_SWAP_FEE_BPS ?? '30');
  const hook = parseHookConfig();
  const hookInput = hook ?? {};

  const spotPoolInput = {
    payer,
    tokenAMint: baseMint,
    tokenBMint: WSOL_MINT,
    tokenAAmount: baseAmount,
    tokenBAmount: quoteAmount,
    swapFeeBps,
    cpmmProgram: deployment.cpmmProgram,
    cpmmMigratorProgram: deployment.cpmmMigratorProgram,
    ...hookInput,
  };
  const accounts = await cpmmMigrator.deriveSpotPoolAccounts({
    ...spotPoolInput,
    liquidityOwner: payer.address,
  });
  const wrappedSolAccount =
    accounts.token0Mint === WSOL_MINT ? accounts.user0 : accounts.user1;

  console.log('Preparing spot-pool token accounts...');
  await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [
      getCreateAssociatedTokenIdempotentInstruction({
        payer,
        ata: accounts.user0,
        owner: payer.address,
        mint: accounts.token0Mint,
        tokenProgram: accounts.token0Program,
      }),
      getCreateAssociatedTokenIdempotentInstruction({
        payer,
        ata: accounts.user1,
        owner: payer.address,
        mint: accounts.token1Mint,
        tokenProgram: accounts.token1Program,
      }),
      getTransferSolInstruction({
        source: payer,
        destination: wrappedSolAccount,
        amount: quoteAmount,
      }),
      getSyncNativeInstruction({ account: wrappedSolAccount }),
    ],
  });

  const createInstruction =
    await cpmmMigrator.createSpotPoolInstruction(spotPoolInput);

  console.log('Creating spot pool...');
  console.log('  Pool:       ', accounts.pool);
  console.log('  Base mint:  ', baseMint);
  console.log('  Quote mint: ', WSOL_MINT);
  console.log('  Swap fee:   ', `${swapFeeBps} bps`);
  if (hook) {
    console.log('  Hook:       ', hook.hookProgram);
    console.log('  Hook flags: ', hook.hookFlags);
  }

  const signature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [createInstruction],
  });
  const pool = await cpmm.fetchPool(rpc, accounts.pool, {
    commitment: 'confirmed',
    programId: deployment.cpmmProgram,
  });
  if (!pool) {
    throw new Error('Spot pool was not found after creation');
  }

  console.log('');
  console.log('Spot pool created successfully!');
  console.log('  Transaction: ', signature);
  console.log('  Reserve 0:   ', pool.reserve0.toString());
  console.log('  Reserve 1:   ', pool.reserve1.toString());
  console.log('  Hook program:', pool.hookProgram);
}

main().catch((error: unknown) => {
  console.error('Error creating spot pool:', error);
  process.exit(1);
});
