/**
 * Example: Create an XYK Token Launch using Market Cap Range (Solana)
 *
 * Demonstrates:
 * - Fetching a live SOL price and converting a market cap range to XYK virtual reserves
 * - Building and sending an initializeLaunch transaction
 * - Verifying the resulting launch account state
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

  // ── Token supply parameters ────────────────────────────────────────────────
  // This example puts the entire supply on the bonding curve (no creator
  // distribution or CPMM liquidity allocation). See solana-adv-launch.ts for
  // an example with custom token allocations and fee configuration.
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);

  const QUOTE_DECIMALS = 9; // WSOL
  const START_MARKET_CAP_USD = 100_000;
  const END_MARKET_CAP_USD = 10_000_000;
  const SWAP_FEE_BPS = 200; // 2%; must fit this deployment's configured fee bounds
  const CPMM_FEE_SPLIT_BPS = 10_000; // migrated launch fees route through LaunchFeeState

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
  const metadataAccount = await initializer.getTokenMetadataAddress(
    baseMint.address,
  );

  // ── Derive PDAs ─────────────────────────────────────────────────────────────
  // Date.now() as launchId ensures each run creates a distinct launch.
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
  // Admin ATAs receive unsold curve tokens and residual migration dust.
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
      recipientAtas: [],
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

  // ── Encode CPMM migrator payload ──────────────────────────────────────────
  // migratorInitPayload registers graduation params; migratorMigratePayload
  // is forwarded at migration. minRaiseQuote is the graduation threshold.
  const migratorInitPayload = cpmmMigrator.encodeRegisterLaunchPayload({
    cpmmConfig: cpmmConfig,
    initialSwapFeeBps: SWAP_FEE_BPS,
    initialFeeSplitBps: CPMM_FEE_SPLIT_BPS,
    recipients: [],
    minRaiseQuote,
    minMigrationPriceQ64Opt: null, // no minimum graduation price floor
    migratedPoolHookConfig: null,
  });

  const migratorMigratePayload = cpmmMigrator.encodeMigratePayload({
    baseForDistribution: 0n,
    baseForLiquidity: 0n,
  });

  // ── Build, sign, and send ────────────────────────────────────────────────
  // The CPMM migrator register_launch CPI consumes both the cpmmMigrationState
  // PDA and cpmmConfig as remaining accounts.
  console.log('Building launch instruction...');
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
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
        // Opening price: virtualQuote / (baseForCurve + virtualBase)
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        swapFeeBps: SWAP_FEE_BPS,
        curveKind: initializer.CURVE_KIND_XYK,
        curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
        allowBuy: true,
        allowSell: true,
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
