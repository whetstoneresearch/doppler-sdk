/**
 * Example: Swap tokens on a CPMM pool (Solana)
 *
 * Demonstrates:
 * - Fetching pool state and computing an exact-in quote off-chain
 * - Deriving user ATAs and building a swap_exact_in instruction
 */
import './env.js';

import { address, type Address } from '@solana/kit';

import { swapExactIn } from '../src/solana/index.js';
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

  // ── Quote the swap ───────────────────────────────────────────────────────
  // tradeDirection 0 = token0→token1, tradeDirection 1 = token1→token0.
  const tradeDirection = (process.env.SWAP_DIRECTION === '1' ? 1 : 0) as 0 | 1;
  const AMOUNT_IN = BigInt(process.env.AMOUNT_IN ?? '1000000');
  const SLIPPAGE_BPS = 50n; // 0.5%

  console.log('Preparing exact-in swap...');
  const swap = await swapExactIn({
    rpc,
    deployment,
    payer,
    mintA: MINT_0,
    mintB: MINT_1,
    amountIn: AMOUNT_IN,
    tradeDirection,
    slippageBps: SLIPPAGE_BPS,
  });

  const { address: poolAddress, account: pool } = swap.pool;

  console.log('  Pool address:  ', poolAddress);
  console.log('  token0 mint:   ', pool.token0Mint);
  console.log('  token1 mint:   ', pool.token1Mint);
  console.log('  reserve0:      ', pool.reserve0.toString());
  console.log('  reserve1:      ', pool.reserve1.toString());
  console.log('  Swap fee:      ', pool.swapFeeBps, 'bps');
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
