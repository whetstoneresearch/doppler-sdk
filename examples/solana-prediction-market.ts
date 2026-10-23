/** Prediction lifecycle. Run create, buy, resolve, or claim separately. */
import './env.js';
import { createHash } from 'node:crypto';
import {
  address,
  generateKeyPairSigner,
  type TransactionSigner,
} from '@solana/kit';
import { predictionMarkets } from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  loadKeypairSignerFromEnv,
  requiredEnv,
  sendInstructions,
  sendInitializeLaunchWithLookupTable,
  WSOL_MINT,
} from './solanaExampleHelpers.js';

type Context = {
  payer: TransactionSigner;
  clients: ReturnType<typeof createSolanaClientsFromEnv>;
};

async function create({ payer, clients }: Context): Promise<void> {
  const outcomeIds = ['YES', 'NO'].map(
    (label) =>
      new Uint8Array(
        createHash('sha256').update(`doppler-example:${label}`).digest(),
      ),
  );
  const oracle = await predictionMarkets.prepareOracle({
    oracleAuthority: payer,
    nonce: BigInt(Date.now()),
    outcomeIds,
  });
  console.log('Oracle:', oracle.oracle);
  await sendInstructions({
    ...clients,
    payer,
    instructions: oracle.instructions,
  });
  const market = await predictionMarkets.prepareMarket({
    creator: payer,
    oracle: oracle.oracle,
    quoteMint: WSOL_MINT,
  });
  console.log('Market:', market.market);
  await sendInstructions({
    ...clients,
    payer,
    instructions: market.instructions,
  });

  for (const [index, outcomeId] of outcomeIds.entries()) {
    const baseMint = await generateKeyPairSigner();
    const launch = await predictionMarkets.prepareOutcomeLaunch({
      creator: payer,
      oracle: oracle.oracle,
      outcomeId,
      launch: {
        payer,
        launchAccounts: {
          baseMint,
          quoteMint: WSOL_MINT,
        },
        supply: {
          baseDecimals: 6,
          baseTotalSupply: 1_000_000_000_000n,
          baseForDistribution: 0n,
          baseForLiquidity: 0n,
        },
        curve: {
          curveVirtualBase: 1_000_000_000_000n,
          curveVirtualQuote: 1_000_000_000n,
          swapFeeBps: 100,
        },
        metadata: null,
      },
    });
    console.log('Outcome index / mint:', index, baseMint.address);
    console.log(
      'Register:',
      await sendInitializeLaunchWithLookupTable({
        ...clients,
        payer,
        instruction: launch.instruction,
      }),
    );
  }
}

async function buy({ payer, clients }: Context): Promise<void> {
  const market = address(requiredEnv('SOLANA_PREDICTION_MARKET'));
  const baseMint = address(requiredEnv('SOLANA_PREDICTION_BASE_MINT'));
  const launch = process.env.SOLANA_PREDICTION_LAUNCH
    ? address(process.env.SOLANA_PREDICTION_LAUNCH)
    : undefined;
  const amountIn = BigInt(requiredEnv('SOLANA_PREDICTION_AMOUNT_IN'));
  const quote = await predictionMarkets.fetchPredictionBuyQuote(clients.rpc, {
    market,
    baseMint,
    launch,
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

async function resolve({ payer, clients }: Context): Promise<void> {
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

async function claim({ payer, clients }: Context): Promise<void> {
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

async function main(): Promise<void> {
  const action = process.argv[2];
  if (
    action !== 'create' &&
    action !== 'buy' &&
    action !== 'resolve' &&
    action !== 'claim'
  ) {
    throw new Error(
      'Usage: solana-prediction-market.ts <create|buy|resolve|claim>',
    );
  }
  const clients = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(clients.network, ['devnet', 'custom']);
  const payer = await loadKeypairSignerFromEnv();
  await { create, buy, resolve, claim }[action]({ clients, payer });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
