/**
 * Example: Create a permissionless CPMM spot pool (Solana)
 *
 * Creates the payer's token accounts, wraps SOL liquidity when the quote is
 * WSOL, and initializes a base/quote pool with an immutable fee tier. Set both
 * hook variables to bind the pool to an allowlisted swap-phase hook.
 */
import './env.js';

import { getTransferSolInstruction } from '@solana-program/system';
import {
  getCreateAssociatedTokenIdempotentInstruction,
  getSyncNativeInstruction,
} from '@solana-program/token';
import { address, type Address } from '@solana/kit';

import {
  cpmm,
  cpmmMigrator,
  initializer,
  swapExactIn,
} from '../src/solana/index.js';
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
  const quoteAmount = positiveBigIntEnv('SPOT_POOL_QUOTE_AMOUNT');
  const quoteMint = address(process.env.SPOT_POOL_QUOTE_MINT ?? WSOL_MINT);
  const wrapSol = quoteMint === WSOL_MINT;
  const tokenKind = process.env.SPOT_POOL_BASE_TOKEN_PROGRAM ?? 'spl';
  if (tokenKind !== 'spl' && tokenKind !== 'token2022') {
    throw new Error('SPOT_POOL_BASE_TOKEN_PROGRAM must be spl or token2022');
  }
  const { baseTokenProgram } =
    tokenKind === 'token2022'
      ? initializer.launchTokenPrograms.token2022Base()
      : initializer.launchTokenPrograms.splToken();
  const swapFeeBps = Number(process.env.SPOT_POOL_SWAP_FEE_BPS ?? '30');
  if (quoteAmount < 10n)
    throw new Error('Quote liquidity must be at least 10 raw units');
  const hook = parseHookConfig();
  const hookInput = hook ?? {};

  const spotPoolInput = {
    payer,
    tokenAMint: baseMint,
    tokenBMint: quoteMint,
    tokenAProgram: baseTokenProgram,
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
  const quoteAccount =
    accounts.token0Mint === quoteMint ? accounts.user0 : accounts.user1;
  const wrap = (amount: bigint) =>
    wrapSol
      ? [
          getTransferSolInstruction({
            source: payer,
            destination: quoteAccount,
            amount,
          }),
          getSyncNativeInstruction({ account: quoteAccount }),
        ]
      : [];

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
      ...wrap(quoteAmount),
    ],
  });

  const createInstruction =
    await cpmmMigrator.createSpotPoolInstruction(spotPoolInput);

  console.log('Creating spot pool...');
  console.log('  Pool:       ', accounts.pool);
  console.log('  Base mint:  ', baseMint);
  console.log('  Quote mint: ', quoteMint);
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

  // Buy with 10% of the initial quote liquidity; the SDK applies 0.5% slippage.
  // Hooked pools may require additional swap accounts supplied by their integrator.
  if (hook) {
    console.log(
      'Supply your hook remainingAccounts to swapExactIn before trading this pool.',
    );
    return;
  }
  const swapAmount = quoteAmount / 10n;
  const swap = await swapExactIn({
    deployment,
    pool: { address: accounts.pool, account: pool },
    payer,
    amountIn: swapAmount,
    slippageBps: 50n,
    tradeDirection: pool.token0Mint === quoteMint ? 0 : 1,
    token0Program: accounts.token0Program,
    token1Program: accounts.token1Program,
  });
  console.log('Swap quote:', swap.quote);
  console.log('Minimum received:', swap.minAmountOut.toString());
  console.log(
    'Swap:',
    await sendInstructions({
      rpc,
      rpcSubscriptions,
      payer,
      instructions: [
        ...swap.setupInstructions,
        ...wrap(swapAmount),
        swap.swapInstruction,
      ],
    }),
  );
}

main().catch((error: unknown) => {
  console.error('Error creating spot pool:', error);
  process.exit(1);
});
