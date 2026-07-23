/**
 * Example: Swap tokens on a CPMM pool (Solana)
 *
 * Demonstrates:
 * - Fetching pool state and computing an exact-in quote off-chain
 * - Deriving user ATAs and building a swap_exact_in instruction
 */
import './env.js';

import { address, type Address } from '@solana/kit';

import { cpmm, swapExactIn } from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInstructions,
} from './solanaExampleHelpers.js';

if (!process.env.MINT_0 || !process.env.MINT_1) {
  throw new Error(
    'MINT_0 and MINT_1 must be set to the two token mints of the pool',
  );
}

// The two token mints of the pool — order does not matter, they are sorted internally.
const MINT_0: Address = address(process.env.MINT_0);
const MINT_1: Address = address(process.env.MINT_1);

// ============================================================================
// Main
// ============================================================================

async function main() {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);

  const poolResult = await cpmm.getPoolByMints(rpc, MINT_0, MINT_1, {
    commitment: 'confirmed',
    programId: deployment.cpmmProgram,
  });
  if (!poolResult) {
    throw new Error(`No pool found for ${MINT_0} / ${MINT_1}`);
  }

  // ── Quote the swap ───────────────────────────────────────────────────────
  // SWAP_INPUT_MINT is less error-prone than reasoning about canonical token
  // ordering. SWAP_DIRECTION remains available for direct direction testing.
  const configuredInputMint = process.env.SWAP_INPUT_MINT
    ? address(process.env.SWAP_INPUT_MINT)
    : undefined;
  let tradeDirection: 0 | 1;
  if (!configuredInputMint) {
    tradeDirection = process.env.SWAP_DIRECTION === '1' ? 1 : 0;
  } else if (poolResult.account.token0Mint === configuredInputMint) {
    tradeDirection = 0;
  } else if (poolResult.account.token1Mint === configuredInputMint) {
    tradeDirection = 1;
  } else {
    throw new Error(
      `SWAP_INPUT_MINT ${configuredInputMint} is not in the pool`,
    );
  }
  const AMOUNT_IN = BigInt(process.env.AMOUNT_IN ?? '1000000');
  const SLIPPAGE_BPS = 50n; // 0.5%

  console.log('Preparing exact-in swap...');
  const swap = await swapExactIn({
    deployment,
    pool: poolResult,
    payer,
    amountIn: AMOUNT_IN,
    tradeDirection,
    slippageBps: SLIPPAGE_BPS,
  });

  const { address: poolAddress, account: poolState } = swap.pool;

  console.log('  Pool address:  ', poolAddress);
  console.log('  token0 mint:   ', poolState.token0Mint);
  console.log('  token1 mint:   ', poolState.token1Mint);
  console.log('  reserve0:      ', poolState.reserve0.toString());
  console.log('  reserve1:      ', poolState.reserve1.toString());
  console.log('  Swap fee:      ', poolState.swapFeeBps, 'bps');
  console.log('');

  console.log(
    `Swap quote (${tradeDirection === 0 ? 'token0 → token1' : 'token1 → token0'}):`,
  );
  console.log('  Amount in:     ', AMOUNT_IN.toString(), '(input token atoms)');
  console.log(
    '  Amount out:    ',
    swap.quote.amountOut.toString(),
    '(output token atoms, estimated)',
  );
  console.log(
    '  Fee:           ',
    swap.quote.feeTotal.toString(),
    '(input token atoms)',
  );
  console.log(
    '  Price impact:  ',
    (swap.quote.priceImpact * 100).toFixed(4),
    '%',
  );
  console.log('  Min out (0.5%):', swap.minAmountOut.toString());

  console.log('  Config:   ', deployment.cpmmConfig);
  console.log('  User ATA (in): ', swap.userIn);
  console.log('  User ATA (out):', swap.userOut);
  console.log('');

  // ── Build and send the swap instruction ──────────────────────────────────
  console.log('Submitting swap...');

  try {
    const signature = await sendInstructions({
      rpc,
      rpcSubscriptions,
      payer,
      instructions: swap.instructions,
    });

    console.log('');
    console.log('Swap confirmed!');
    console.log('  Transaction:', signature);
    console.log('  Sent:       ', AMOUNT_IN.toString(), 'input token atoms');
    console.log(
      '  Received:   ~',
      swap.quote.amountOut.toString(),
      'output token atoms',
    );
  } catch (error) {
    console.error('Error executing swap:', error);
    process.exit(1);
  }
}

main();
