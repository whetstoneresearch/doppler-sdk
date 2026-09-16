/** Claim winnings, harvest later proceeds with burn=0, or refund a void outcome. */
import './env.js';
import { address } from '@solana/kit';
import { predictionMarkets } from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  loadKeypairSignerFromEnv,
  requiredEnv,
  sendInstructions,
} from './solanaExampleHelpers.js';

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const clients = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(clients.network, ['devnet', 'custom']);
  const market = address(requiredEnv('SOLANA_PREDICTION_MARKET'));
  const view = await predictionMarkets.fetchPredictionMarket(
    clients.rpc,
    market,
  );
  const burnAmount = BigInt(requiredEnv('SOLANA_PREDICTION_BURN_AMOUNT'));
  const input = {
    market,
    payer,
    potVault: view.market.data.potVault,
    quoteMint: view.market.data.quoteMint,
    burnAmount,
  };
  if (!view.status.canClaim && !view.status.canRefund)
    throw new Error('Settle the finalized market before claiming');
  const claim = view.status.canRefund
    ? await predictionMarkets.prepareRefund({
        ...input,
        refunder: payer,
        baseMint: address(requiredEnv('SOLANA_PREDICTION_BASE_MINT')),
      })
    : await predictionMarkets.prepareClaim({
        ...input,
        claimer: payer,
        winnerMint: view.market.data.winnerMint,
      });
  console.log(
    'Claim:',
    await sendInstructions({
      ...clients,
      payer,
      instructions: claim.instructions,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
