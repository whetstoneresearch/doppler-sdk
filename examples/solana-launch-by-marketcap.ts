/**
 * Example: Create an XYK Token Launch using Market Cap Range (Solana)
 *
 * Demonstrates:
 * - Fetching a live SOL price and converting a market cap range to XYK virtual reserves
 * - Building and sending an initializeLaunch transaction
 * - Verifying the resulting launch account state
 */
import './env.js';

import { generateKeyPairSigner } from '@solana/kit';

import { cpmm, createLaunch, initializer } from '../src/solana/index.js';
import {
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
  WSOL_MINT,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolPriceUsd,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInitializeLaunchWithLookupTable,
} from './solanaExampleHelpers.js';

async function main() {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);

  // ── Token supply parameters ────────────────────────────────────────────────
  // This example puts the entire supply on the bonding curve (no creator
  // distribution or CPMM liquidity allocation). See solana-adv-launch.ts for
  // an example with custom token allocations and fee configuration.
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);

  const QUOTE_DECIMALS = 9; // WSOL
  const START_MARKET_CAP_USD = 100_000;
  const END_MARKET_CAP_USD = 10_000_000;
  const SWAP_FEE_BPS = DEFAULT_SWAP_FEE_BPS;

  // ── Graduation threshold and price floor ────────────────────────────────
  const MIN_SOL_RAISE = 50;
  const minRaiseQuote = BigInt(MIN_SOL_RAISE) * 1_000_000_000n;

  // ── Fetch live SOL price ────────────────────────────────────────────────────
  console.log('Fetching current SOL price from CoinGecko...');
  const solPriceUsd = await getSolPriceUsd();
  console.log(`Current SOL price: $${solPriceUsd.toLocaleString()}`);
  console.log('');

  // ── Validate market cap parameters ────────────────────────────────────────
  // Optional but recommended — warns if startMarketCapUSD is too low for the supply.
  const { valid, warnings } = cpmm.validateMarketCapParameters(
    START_MARKET_CAP_USD,
    BASE_TOTAL_SUPPLY,
    BASE_DECIMALS,
  );
  if (!valid) {
    for (const w of warnings) console.warn('Warning:', w);
  }

  // ── Convert market cap range → XYK curve virtual reserves ─────────────────
  // start sets the opening spot price; graduation is triggered by minRaiseQuote.
  const { start } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: START_MARKET_CAP_USD,
    endMarketCapUSD: END_MARKET_CAP_USD,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_TOTAL_SUPPLY,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: solPriceUsd,
  });

  console.log('Computed curve virtual reserves (opening price):');
  console.log('  curveVirtualBase: ', start.curveVirtualBase.toString());
  console.log('  curveVirtualQuote:', start.curveVirtualQuote.toString());
  console.log(
    `  Market cap range: $${START_MARKET_CAP_USD.toLocaleString()} → $${END_MARKET_CAP_USD.toLocaleString()} (at SOL = $${solPriceUsd.toLocaleString()})`,
  );
  console.log('');

  // ── Generate new keypairs for base token accounts ──────────────────────────
  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const metadata = DEFAULT_TEST_METADATA;

  // ── Derive launch addresses ─────────────────────────────────────────────────
  // Date.now() as launchId ensures each run creates a distinct launch.
  const namespace = payer.address;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));
  const launchAddresses = await initializer.deriveCreateLaunchAddresses({
    deployment,
    namespace,
    launchId,
    baseMint,
    metadata,
  });
  const { launch, launchAuthority } = launchAddresses;
  const initializerConfig = launchAddresses.config;

  // ── Build, sign, and send ────────────────────────────────────────────────
  console.log('Building launch instruction...');
  try {
    const { instruction: ix, cpmmMigration } = await createLaunch({
      deployment,
      namespace,
      launchId,
      addresses: launchAddresses,
      launchAccounts: {
        baseMint,
        quoteMint: WSOL_MINT,
        baseVault,
        quoteVault,
      },
      payer,
      authority: payer,
      supply: {
        baseDecimals: BASE_DECIMALS,
        baseTotalSupply: BASE_TOTAL_SUPPLY,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        swapFeeBps: SWAP_FEE_BPS,
      },
      migration: {
        minRaiseQuote,
      },
      metadata,
      feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
    });
    if (!cpmmMigration) {
      throw new Error('CPMM migration accounts were not prepared');
    }
    const cpmmConfig = cpmmMigration.cpmmConfig;
    const cpmmMigrationState = cpmmMigration.cpmmMigrationState;

    console.log('Derived addresses:');
    console.log('  Launch:          ', launch);
    console.log('  Launch authority:', launchAuthority);
    console.log('  Initializer config:', initializerConfig);
    console.log('  CPMM config:     ', cpmmConfig);
    console.log('  CPMM migrator state:', cpmmMigrationState);
    console.log('');

    const launchSignature = await sendInitializeLaunchWithLookupTable({
      rpc,
      rpcSubscriptions,
      payer,
      instruction: ix,
      metadata,
    });

    console.log('');
    console.log('Token launch created successfully!');
    console.log('  Launch address:', launch);
    console.log('  Base mint:     ', baseMint.address);
    console.log('  Transaction:   ', launchSignature);

    // ── Verify launch state ──────────────────────────────────────
    const launchAccount = await initializer.fetchLaunch(rpc, launch, {
      programId: deployment.initializerProgram,
    });
    if (launchAccount) {
      console.log('');
      console.log('Launch account verified:');
      console.log(
        '  Phase:              ',
        initializer.phaseLabel(launchAccount.phase),
      );
      console.log('  Base mint:          ', launchAccount.baseMint);
      console.log(
        '  Base total supply:  ',
        launchAccount.baseTotalSupply.toString(),
      );
      console.log(
        '  Curve virtual base: ',
        launchAccount.curveVirtualBase.toString(),
      );
      console.log(
        '  Curve virtual quote:',
        launchAccount.curveVirtualQuote.toString(),
      );
      console.log(
        '  Quote deposited:    ',
        launchAccount.quoteDeposited.toString(),
        'lamports',
      );
      console.log(`  Graduation at:       ${MIN_SOL_RAISE} SOL raised`);

      if (launchAccount.phase === initializer.PHASE_MIGRATED) {
        console.log('');
        console.log('Launch has graduated — CPMM pool is live.');
      } else {
        console.log('');
        console.log(
          'Launch is active. Will graduate once',
          MIN_SOL_RAISE,
          'SOL is raised.',
        );
      }
    }
  } catch (error) {
    console.error('Error creating launch:', error);
    process.exit(1);
  }
}

main();
