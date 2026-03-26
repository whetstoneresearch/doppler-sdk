/**
 * Example: Swap tokens on a CPMM pool (Solana)
 *
 * Demonstrates:
 * - Fetching pool state and computing an exact-in quote off-chain
 * - Deriving user ATAs and building a swap_exact_in instruction
 */
import './env.js';

import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  getAddressEncoder,
  getProgramDerivedAddress,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  type Address,
} from '@solana/kit';

import {
  TOKEN_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

import { cpmm } from '../src/solana/index.js';

// ============================================================================
// Environment
// ============================================================================

const keypairJson = process.env.SOLANA_KEYPAIR;
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const wsUrl = process.env.SOLANA_WS_URL ?? 'wss://api.devnet.solana.com';

if (!keypairJson) {
  throw new Error('SOLANA_KEYPAIR must be set (JSON array of 64 bytes)');
}
if (!process.env.MINT_0 || !process.env.MINT_1) {
  throw new Error(
    'MINT_0 and MINT_1 must be set to the two token mints of the pool',
  );
}

// The two token mints of the pool — order does not matter, they are sorted internally.
const MINT_0: Address = address(process.env.MINT_0);
const MINT_1: Address = address(process.env.MINT_1);

// ============================================================================
// Helpers
// ============================================================================

/** Derive the ATA address for a wallet + mint. Seeds: [wallet, tokenProgram, mint]. */
async function getAtaAddress(wallet: Address, mint: Address): Promise<Address> {
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [
      getAddressEncoder().encode(wallet),
      getAddressEncoder().encode(TOKEN_PROGRAM_ADDRESS),
      getAddressEncoder().encode(mint),
    ],
  });
  return ata;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const payer = await createKeyPairSignerFromBytes(
    new Uint8Array(JSON.parse(keypairJson as string)),
  );

  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  // ── Fetch pool state ─────────────────────────────────────────────────────
  console.log('Fetching pool state...');
  const poolResult = await cpmm.getPoolByMints(rpc, MINT_0, MINT_1);

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
  // direction 0 = token0→token1, direction 1 = token1→token0.
  const direction = 0 as const; // token0 → token1
  const AMOUNT_IN = 1_000_000n; // 1 token (assuming 6 decimals)

  const quote = cpmm.getSwapQuote(pool, AMOUNT_IN, direction);

  const SLIPPAGE_BPS = 50n; // 0.5%
  const minAmountOut = (quote.amountOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;

  console.log('Swap quote (token0 → token1):');
  console.log('  Amount in:     ', AMOUNT_IN.toString(), '(token0 atoms)');
  console.log(
    '  Amount out:    ',
    quote.amountOut.toString(),
    '(token1 atoms, estimated)',
  );
  console.log('  Fee:           ', quote.feeTotal.toString(), '(token0 atoms)');
  console.log('  Price impact:  ', (quote.priceImpact * 100).toFixed(4), '%');
  console.log('  Min out (0.5%):', minAmountOut.toString());
  console.log('');

  // ── Derive PDAs and user token accounts ─────────────────────────────────
  const [config] = await cpmm.getConfigAddress();
  const userIn = await getAtaAddress(payer.address, pool.token0Mint);
  const userOut = await getAtaAddress(payer.address, pool.token1Mint);

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
      userToken0: userIn,
      userToken1: userOut,
      user: payer.address,
      amountIn: AMOUNT_IN,
      minAmountOut,
      direction,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const txMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (msg) => setTransactionMessageFeePayer(payer.address, msg),
      (msg) =>
        setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
      (msg) => appendTransactionMessageInstructions([ix], msg),
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);
    const signature = getSignatureFromTransaction(signedTx);

    await sendAndConfirm(signedTx, { commitment: 'confirmed' });

    console.log('');
    console.log('Swap confirmed!');
    console.log('  Transaction:', signature);
    console.log('  Sent:       ', AMOUNT_IN.toString(), 'token0 atoms');
    console.log('  Received:   ~', quote.amountOut.toString(), 'token1 atoms');
  } catch (error) {
    console.error('Error executing swap:', error);
    process.exit(1);
  }
}

main();
