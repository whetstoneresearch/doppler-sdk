/** Create a binary oracle/market and register both buy-only outcome launches. */
import './env.js';
import { createHash } from 'node:crypto';
import { generateKeyPairSigner } from '@solana/kit';
import { predictionMarkets } from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  loadKeypairSignerFromEnv,
  sendInstructions,
  sendInitializeLaunchWithLookupTable,
  WSOL_MINT,
} from './solanaExampleHelpers.js';

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const clients = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(clients.network, ['devnet', 'custom']);
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
    const [baseMint, baseVault, quoteVault] = await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);
    const launch = await predictionMarkets.prepareOutcomeLaunch({
      creator: payer,
      oracle: oracle.oracle,
      outcomeId,
      launch: {
        payer,
        launchId: outcomeId,
        launchAccounts: {
          baseMint,
          baseVault,
          quoteVault,
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
