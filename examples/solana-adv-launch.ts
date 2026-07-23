/**
 * Example: Advanced XYK Token Launch — Custom Fees & Token Allocations (Solana)
 *
 * Extends solana-launch-by-marketcap.ts with production-ready configuration:
 *
 * Token allocation (1 B supply):
 *   • 75% → bonding curve (BASE_FOR_CURVE)
 *   • 20% → creator + team recipients at graduation (BASE_FOR_DISTRIBUTION)
 *   •  5% → seeded as initial CPMM liquidity at graduation (BASE_FOR_LIQUIDITY)
 *
 * Fee configuration:
 *   • swapFeeBps         — swap fee used by the launch and graduated pool
 *   • initialSwapFeeBps  — migrated CPMM swap fee; must match swapFeeBps
 *   • initialFeeSplitBps — CPMM fee split routed through launch fee state
 *
 * Also demonstrates minMigrationPriceQ64Opt: an optional Q64.64 price floor
 * that prevents graduation if the market cap is too low at migration time.
 */
import './env.js';

import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
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

  // ── Token supply and allocation ─────────────────────────────────────────
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 200_000_000n * 10n ** BigInt(BASE_DECIMALS); // 20% to recipients
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS); //  5% seeds CPMM pool
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY; // 75%

  const QUOTE_DECIMALS = 9; // WSOL
  const START_MARKET_CAP_USD = 100_000;
  const END_MARKET_CAP_USD = 10_000_000;

  // Distribution split between creator (70%) and team (30%)
  const CREATOR_SHARE = (BASE_FOR_DISTRIBUTION * 70n) / 100n;
  const TEAM_SHARE = BASE_FOR_DISTRIBUTION - CREATOR_SHARE;

  // ── Fee configuration ───────────────────────────────────────────────────
  const SWAP_FEE_BPS = DEFAULT_SWAP_FEE_BPS;

  // ── Graduation threshold and price floor ────────────────────────────────
  const MIN_SOL_RAISE = 50;
  const minRaiseQuote = BigInt(MIN_SOL_RAISE) * 1_000_000_000n;

  // Optional: refuse graduation if spot price (reserve1/reserve0 in raw units)
  // at migration time is below this Q64.64 value.
  // Example: require at least 0.001 WSOL per 1 base atom → numberToQ64(0.001).
  // Set to null to allow graduation at any price.
  const minMigrationPriceQ64Opt = null;

  // ── Live SOL price → curve virtual reserves ─────────────────────────────
  const solPriceUsd = await getSolPriceUsd();

  const { start } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: START_MARKET_CAP_USD,
    endMarketCapUSD: END_MARKET_CAP_USD,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: solPriceUsd,
  });

  // ── Generate keypairs and derive PDAs ───────────────────────────────────
  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const metadata = DEFAULT_TEST_METADATA;

  const namespace = SYSTEM_PROGRAM_ADDRESS;
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
  const recipients = [
    { wallet: payer.address, amount: CREATOR_SHARE },
    { wallet: payer.address, amount: TEAM_SHARE },
  ];

  // ── Build, sign, and send ────────────────────────────────────────────────
  console.log('Creating advanced XYK token launch...');
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
        baseForDistribution: BASE_FOR_DISTRIBUTION,
        baseForLiquidity: BASE_FOR_LIQUIDITY,
      },
      curve: {
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        swapFeeBps: SWAP_FEE_BPS,
      },
      migration: {
        recipients,
        minRaiseQuote,
        minMigrationPriceQ64Opt,
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

    // ── Verify launch state ──────────────────────────────────────────────
    const launchAccount = await initializer.fetchLaunch(rpc, launch, {
      programId: deployment.initializerProgram,
    });
    if (launchAccount) {
      console.log('');
      console.log('Launch account verified:');
      // Status
      console.log(
        '  Phase:              ',
        initializer.phaseLabel(launchAccount.phase),
      );
      console.log(
        '  Quote deposited:    ',
        launchAccount.quoteDeposited.toString(),
        'lamports',
      );
      console.log('  Graduates at:       ', MIN_SOL_RAISE, 'SOL raised');
      // Token allocation
      console.log(
        '  Base total supply:  ',
        launchAccount.baseTotalSupply.toString(),
      );
      console.log(
        '  Base for curve:     ',
        launchAccount.baseForCurve.toString(),
      );
      console.log(
        '  Base for liquidity: ',
        launchAccount.baseForLiquidity.toString(),
      );
      console.log(
        '  Base for distrib:   ',
        launchAccount.baseForDistribution.toString(),
      );
      // Curve pricing
      console.log(
        '  Curve virtual base: ',
        launchAccount.curveVirtualBase.toString(),
      );
      console.log(
        '  Curve virtual quote:',
        launchAccount.curveVirtualQuote.toString(),
      );
      // Fees
      console.log('  Swap fee:           ', launchAccount.swapFeeBps, 'bps');
    }
  } catch (error) {
    console.error('Error creating launch:', error);
    process.exit(1);
  }
}

main();
