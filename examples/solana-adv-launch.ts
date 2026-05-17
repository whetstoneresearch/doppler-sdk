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

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import {
  generateKeyPairSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  type Address,
} from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import { cpmm, initializer, cpmmMigrator } from '../src/solana/index.js';
import {
  assertTransactionFits,
  assertSolanaExampleNetwork,
  createLookupTableForInstruction,
  createSolanaClientsFromEnv,
  getMetadataByteLength,
  getSolPriceUsd,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
} from './solanaExampleHelpers.js';

// WSOL mint — pools use the wrapped SPL mint since native SOL can't live in token vaults.
const WSOL_MINT: Address =
  'So11111111111111111111111111111111111111112' as Address;

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
  const SWAP_FEE_BPS = 200; // 2%; must fit this deployment's configured fee bounds
  const CPMM_SWAP_FEE_BPS = SWAP_FEE_BPS;
  const CPMM_SWAP_FEE_SPLIT_BPS = 10_000; // migrated launch fees route through LaunchFeeState

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
  const metadataAccount = await initializer.getTokenMetadataAddress(
    baseMint.address,
  );

  const namespace = payer.address;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));

  const [launch] = await initializer.getLaunchAddress(
    namespace,
    launchId,
    deployment.initializerProgram,
  );
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(
    launch,
    deployment.initializerProgram,
  );
  const [launchFeeState] = await initializer.getLaunchFeeStateAddress(
    launch,
    deployment.initializerProgram,
  );
  const initializerConfig = deployment.initializerConfig;

  // Payer receives admin dust and both example recipient allocations.
  const [payerBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [payerQuoteAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: WSOL_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const migrationAccounts =
    await cpmmMigrator.buildCpmmMigrationRemainingAccounts({
      launch,
      baseMint: baseMint.address,
      quoteMint: WSOL_MINT,
      launchAuthority,
      adminBaseAta: payerBaseAta,
      adminQuoteAta: payerQuoteAta,
      recipientAtas: [payerBaseAta, payerBaseAta],
      cpmmProgram: deployment.cpmmProgram,
      cpmmMigratorProgram: deployment.cpmmMigratorProgram,
    });
  const cpmmConfig = migrationAccounts.cpmmConfig;
  const cpmmMigrationState = migrationAccounts.cpmmMigrationState;

  console.log('Derived addresses:');
  console.log('  Launch:          ', launch);
  console.log('  Launch authority:', launchAuthority);
  console.log('  Initializer config:', initializerConfig);
  console.log('  CPMM config:     ', cpmmConfig);
  console.log('  CPMM migrator state:', cpmmMigrationState);
  console.log('');

  // ── Encode migrator payloads ────────────────────────────────────────────
  // migratorInitPayload registers graduation params; migratorMigratePayload
  // is forwarded at migration. minRaiseQuote is the graduation threshold.
  const migratorInitPayload = cpmmMigrator.encodeRegisterLaunchPayload({
    cpmmConfig: cpmmConfig,
    initialSwapFeeBps: CPMM_SWAP_FEE_BPS,
    initialFeeSplitBps: CPMM_SWAP_FEE_SPLIT_BPS,
    recipients: [
      { wallet: payer.address, amount: CREATOR_SHARE },
      { wallet: payer.address, amount: TEAM_SHARE }, // use payer as team wallet in this example
    ],
    minRaiseQuote,
    minMigrationPriceQ64Opt,
    migratedPoolHookConfig: null,
  });

  const migratorMigratePayload = cpmmMigrator.encodeMigratePayload({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  });

  // ── Build, sign, and send ────────────────────────────────────────────────
  console.log('Creating advanced XYK token launch...');
  try {
    const metadata = {
      metadataName: 'TEST',
      metadataSymbol: 'TEST',
      metadataUri: 'https://example.com/metadata/test-token.json',
    };

    const ix = await initializer.createInitializeLaunchInstruction(
      {
        config: initializerConfig,
        launch,
        launchAuthority,
        baseMint,
        quoteMint: WSOL_MINT,
        baseVault,
        quoteVault,
        launchFeeState,
        payer,
        authority: payer,
        hookProgram: deployment.cpmmHookProgram,
        migratorProgram: deployment.cpmmMigratorProgram,
        cpmmConfig,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        rent: SYSVAR_RENT_ADDRESS,
        metadataAccount,
      },
      {
        namespace,
        launchId,
        baseDecimals: BASE_DECIMALS,
        baseTotalSupply: BASE_TOTAL_SUPPLY,
        baseForDistribution: BASE_FOR_DISTRIBUTION,
        baseForLiquidity: BASE_FOR_LIQUIDITY,
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        swapFeeBps: SWAP_FEE_BPS,
        curveKind: initializer.CURVE_KIND_XYK,
        curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
        allowBuy: true,
        allowSell: true,
        hookProgram: deployment.cpmmHookProgram,
        hookFlags: initializer.HF_BEFORE_SWAP,
        hookPayload: new Uint8Array(),
        migratorInitPayload,
        migratorMigratePayload,
        hookRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
        migratorInitRemainingAccountsHash:
          initializer.computeRemainingAccountsHash([
            cpmmMigrationState,
            cpmmConfig,
          ]),
        migratorRemainingAccountsHash: migrationAccounts.hash,
        feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
        ...metadata,
      },
      deployment.initializerProgram,
    );
    const lookupTable = await createLookupTableForInstruction({
      rpc,
      rpcSubscriptions,
      payer,
      instruction: ix,
      label: 'initialize_launch lookup table',
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transactionMessage =
      initializer.compressTransactionMessageWithLookupTable(
        pipe(
          createTransactionMessage({ version: 0 }),
          (tx) => setTransactionMessageFeePayerSigner(payer, tx),
          (tx) =>
            setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstructions([ix], tx),
        ),
        lookupTable,
      );
    assertTransactionFits(transactionMessage, {
      label: 'initialize_launch',
      metadataBytes: getMetadataByteLength(metadata),
    });

    const signedTransaction =
      await signTransactionMessageWithSigners(transactionMessage);

    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });
    await sendAndConfirmTransaction(
      signedTransaction as Parameters<typeof sendAndConfirmTransaction>[0],
      {
        commitment: 'confirmed',
      },
    );

    console.log('');
    console.log('Token launch created successfully!');
    console.log('  Launch address:', launch);
    console.log('  Base mint:     ', baseMint.address);
    console.log(
      '  Transaction:   ',
      getSignatureFromTransaction(signedTransaction),
    );

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
