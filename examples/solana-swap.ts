/**
 * Example: Swap tokens on a CPMM pool (Solana)
 *
 * Demonstrates:
 * - Fetching pool state and computing an exact-in quote off-chain
 * - Deriving user ATAs and building a swap_exact_in instruction
 */
import './env.js';

import { address, type Address } from '@solana/kit';
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';

import { cpmm } from '../src/solana/index.js';
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

  // ── Fetch pool state ─────────────────────────────────────────────────────
  console.log('Fetching pool state...');
  const poolResult = await cpmm.getPoolByMints(rpc, MINT_0, MINT_1, {
    programId: deployment.cpmmProgram,
  });

  if (!poolResult) {
    throw new Error(`No pool found for ${MINT_0} / ${MINT_1}`);
  }

  const { address: poolAddress, account: pool } = poolResult;

  console.log('  Pool address:  ', poolAddress);
  console.log('  token0 mint:   ', pool.token0Mint);
  console.log('  token1 mint:   ', pool.token1Mint);
  console.log('  reserve0:      ', pool.reserve0.toString());
  console.log('  reserve1:      ', pool.reserve1.toString());
  console.log('  Swap fee:      ', pool.swapFeeBps, 'bps');
  console.log('');

  // ── Quote the swap ───────────────────────────────────────────────────────
  // tradeDirection 0 = token0→token1, tradeDirection 1 = token1→token0.
  const tradeDirection = (process.env.SWAP_DIRECTION === '1' ? 1 : 0) as 0 | 1;
  const AMOUNT_IN = BigInt(process.env.AMOUNT_IN ?? '1000000');

  const quote = cpmm.getSwapQuote(pool, AMOUNT_IN, tradeDirection);

  const SLIPPAGE_BPS = 50n; // 0.5%
  const minAmountOut = (quote.amountOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;

  console.log(
    `Swap quote (${tradeDirection === 0 ? 'token0 → token1' : 'token1 → token0'}):`,
  );
  console.log('  Amount in:     ', AMOUNT_IN.toString(), '(input token atoms)');
  console.log(
    '  Amount out:    ',
    quote.amountOut.toString(),
    '(output token atoms, estimated)',
  );
  console.log(
    '  Fee:           ',
    quote.feeTotal.toString(),
    '(input token atoms)',
  );
  console.log('  Price impact:  ', (quote.priceImpact * 100).toFixed(4), '%');
  console.log('  Min out (0.5%):', minAmountOut.toString());
  console.log('');

  // ── Derive PDAs and user token accounts ─────────────────────────────────
  const config = deployment.cpmmConfig;
  const [userToken0] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: pool.token0Mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [userToken1] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: pool.token1Mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const userIn = tradeDirection === 0 ? userToken0 : userToken1;
  const userOut = tradeDirection === 0 ? userToken1 : userToken0;

  console.log('  Config:   ', config);
  console.log('  User ATA (in): ', userIn);
  console.log('  User ATA (out):', userOut);
  console.log('');

  // ── Build and send the swap instruction ──────────────────────────────────
  console.log('Submitting swap...');

  try {
    const ix = cpmm.createSwapInstruction({
      config,
      pool: poolAddress,
      authority: pool.authority,
      vault0: pool.vault0,
      vault1: pool.vault1,
      token0Mint: pool.token0Mint,
      token1Mint: pool.token1Mint,
      userToken0,
      userToken1,
      user: payer,
      amountIn: AMOUNT_IN,
      minAmountOut,
      tradeDirection,
      programId: deployment.cpmmProgram,
    });
    const createUserInAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata: userToken0,
      owner: payer.address,
      mint: pool.token0Mint,
    });
    const createUserOutAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata: userToken1,
      owner: payer.address,
      mint: pool.token1Mint,
    });

    const signature = await sendInstructions({
      rpc,
      rpcSubscriptions,
      payer,
      instructions: [createUserInAtaIx, createUserOutAtaIx, ix],
    });

    console.log('');
    console.log('Swap confirmed!');
    console.log('  Transaction:', signature);
    console.log('  Sent:       ', AMOUNT_IN.toString(), 'input token atoms');
    console.log(
      '  Received:   ~',
      quote.amountOut.toString(),
      'output token atoms',
    );
  } catch (error) {
    console.error('Error executing swap:', error);
    process.exit(1);
  }
}

main();
