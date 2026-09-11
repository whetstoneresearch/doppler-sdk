/** Finalize as oracle authority, then permissionlessly settle outstanding entries. */
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
  if (view.status.missingOutcomeIndexes.length)
    throw new Error('Register every outcome before finalizing');
  const winnerIndex = Number(requiredEnv('SOLANA_PREDICTION_WINNER_INDEX'));
  if (
    !Number.isInteger(winnerIndex) ||
    winnerIndex < 0 ||
    winnerIndex >= view.oracle.data.outcomeCount
  )
    throw new Error('Winner index must identify a registered oracle outcome');
  const winningOutcomeId = Uint8Array.from(
    view.oracle.data.outcomeIds[winnerIndex],
  );
  if (!view.oracle.data.isFinalized) {
    if (view.oracle.data.oracleAuthority !== payer.address)
      throw new Error('Finalization requires the oracle authority signer');
    const finalize = predictionMarkets.prepareFinalize({
      oracleAuthority: payer,
      oracle: view.market.data.oracle,
      winningOutcomeId,
    });
    console.log(
      'Finalize:',
      await sendInstructions({
        ...clients,
        payer,
        instructions: finalize.instructions,
      }),
    );
  } else if (
    !winningOutcomeId.every(
      (byte, i) => byte === view.oracle.data.winningOutcomeId[i],
    )
  ) {
    throw new Error('Oracle was finalized with a different winner');
  }
  // Refetch after each confirmation; the SDK skips already settled entries.
  while (true) {
    const [settlement] = await predictionMarkets.prepareRemainingSettlements(
      clients.rpc,
      { market, payer },
    );
    if (!settlement) break;
    console.log(
      'Settle:',
      await sendInstructions({
        ...clients,
        payer,
        instructions: settlement.instructions,
      }),
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
