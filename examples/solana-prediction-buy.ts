/** Buy one registered outcome using a fee-aware SDK quote and 0.5% slippage. */
import './env.js';
import { address } from '@solana/kit';
import { predictionMarkets } from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  loadKeypairSignerFromEnv,
  requiredEnv,
  sendInstructions,
  WSOL_MINT,
} from './solanaExampleHelpers.js';

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const clients = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(clients.network, ['devnet', 'custom']);
  const market = address(requiredEnv('SOLANA_PREDICTION_MARKET'));
  const baseMint = address(requiredEnv('SOLANA_PREDICTION_BASE_MINT'));
  const amountIn = BigInt(requiredEnv('SOLANA_PREDICTION_AMOUNT_IN'));
  const quote = await predictionMarkets.fetchPredictionBuyQuote(clients.rpc, {
    market,
    baseMint,
    amountIn,
    slippageBps: 50,
  });
  const { outcome } = quote;
  const buy = await predictionMarkets.prepareBuy({
    payer,
    market,
    oracle: quote.oracle,
    launch: outcome.launch.address,
    launchAuthority: outcome.launchAuthority,
    launchFeeState: outcome.launchFeeState,
    baseMint,
    quoteMint: outcome.launch.account.quoteMint,
    baseVault: outcome.launch.account.baseVault,
    quoteVault: outcome.launch.account.quoteVault,
    amountIn,
    minAmountOut: quote.minAmountOut,
    wrapSol: outcome.launch.account.quoteMint === WSOL_MINT,
  });
  console.log(
    'Buy:',
    await sendInstructions({
      ...clients,
      payer,
      instructions: buy.instructions,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
