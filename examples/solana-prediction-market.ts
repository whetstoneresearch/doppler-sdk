/**
 * Example: Create a Prediction Market on Solana
 *
 * Components:
 *   trustedOracle      - holds the final resolution (who won?)
 *   predictionMigrator - manages the market + entry/pot accounting
 *   initializer (x2)   - one XYK launch per outcome (YES / NO tokens)
 *
 * Lifecycle:
 *   1. Create a trusted oracle (authority + quote mint).
 *   2. For each outcome, call initializeLaunch with predictionMigrator as migratorProgram.
 *   3. Users trade outcome tokens on the bonding curve.
 *   4. Once minRaiseQuote is reached, migrateEntry burns unsold tokens and fills the pot.
 *   5. Oracle authority calls finalize(winningMint) to resolve the market.
 *   6. Winning token holders call claim() to receive their SOL share.
 */
import './env.js';

import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
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

import {
  initializer,
  predictionMigrator,
  trustedOracle,
} from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createLookupTableForInstruction,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
} from './solanaExampleHelpers.js';

// WSOL mint — the quote token (SOL wrapped as SPL token so it can live in vaults).
const WSOL_MINT: Address =
  'So11111111111111111111111111111111111111112' as Address;

// ============================================================================
// Main
// ============================================================================

async function main() {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);

  // ── Token supply parameters ─────────────────────────────────────────────
  //
  // Each outcome token ("YES" and "NO") has its own independent mint and
  // bonding curve.  The supply/curve parameters here are the same for both
  // to keep the example simple, but they could differ per outcome.
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS); // 1 B
  const BASE_FOR_DISTRIBUTION = 0n; // no creator distribution for prediction tokens
  const BASE_FOR_LIQUIDITY = 0n;
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY;

  // Opening XYK price at ~50% implied probability (0.5 SOL per token at SOL=$150).
  // Adjust curveVirtualQuote to shift the opening probability.
  const CURVE_VIRTUAL_BASE = BASE_FOR_CURVE;
  const CURVE_VIRTUAL_QUOTE = 500_000_000n; // 0.5 SOL

  // Graduation threshold: launch migrates once this many lamports are raised.
  const MIN_RAISE_QUOTE = 10_000_000_000n; // 10 SOL per entry

  const outcomes = [{ label: 'YES' }, { label: 'NO' }];

  // ── Step 1: Create the trusted oracle ───────────────────────────────────
  //
  // The oracle is the on-chain record that will eventually be resolved with
  // the winning outcome mint.  Any wallet can be the oracleAuthority — in
  // production, use a multisig or a program-controlled authority.
  const oracleNonce = BigInt(Date.now());
  const [oracleStateAddress] = await trustedOracle.getOracleStateAddress(
    payer.address,
    oracleNonce,
  );

  // namespace must equal oracleStateAddress (validated by register_entry:
  // require_keys_eq!(launch.namespace, oracle.key()))
  const namespace = oracleStateAddress;
  const config = deployment.initializerConfig;

  console.log('Creating trusted oracle...');
  console.log('  Oracle state:', oracleStateAddress);

  try {
    const initOracleIx = trustedOracle.getInitializeOracleInstruction({
      oracleAuthority: payer,
      oracleState: oracleStateAddress,
      nonce: oracleNonce,
      quoteMint: WSOL_MINT,
    });

    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });

    {
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(payer, tx),
        (tx) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions([initOracleIx], tx),
      );
      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);
      await sendAndConfirmTransaction(
        signedTransaction as Parameters<typeof sendAndConfirmTransaction>[0],
        {
          commitment: 'confirmed',
        },
      );
      console.log(
        '  Oracle created:',
        getSignatureFromTransaction(signedTransaction),
      );
    }

    // ── Step 2: Create per-outcome launches ───────────────────────────────
    // YES and NO launches are independent of each other and sent in parallel.
    await Promise.all(
      outcomes.map(async (outcome) => {
        console.log('');
        console.log(`Creating ${outcome.label} outcome launch...`);

        // entryId: 32 bytes, padded UTF-8 label (or use a hash in production)
        const entryId = new Uint8Array(32);
        entryId.set(new TextEncoder().encode(outcome.label).slice(0, 32));

        // launchId must equal entryId (validated by register_entry:
        // require!(launch.launch_id == args.entry_id))
        const launchId = entryId;
        const [launch] = await initializer.getLaunchAddress(
          namespace,
          launchId,
          deployment.initializerProgram,
        );
        const [launchAuthority] = await initializer.getLaunchAuthorityAddress(
          launch,
          deployment.initializerProgram,
        );
        const [feeLocker] = await initializer.getFeeLockerAddress(
          launch,
          deployment.initializerProgram,
        );

        const baseMint = await generateKeyPairSigner();
        const baseVault = await generateKeyPairSigner();
        const quoteVault = await generateKeyPairSigner();
        const metadataAccount = await initializer.getTokenMetadataAddress(
          baseMint.address,
        );

        console.log('  Launch:           ', launch);
        console.log('  Launch authority: ', launchAuthority);
        console.log('  Base mint:        ', baseMint.address);

        // ── Derive prediction market PDAs for remaining-accounts hash ────────
        // These are the accounts the migrator will receive during migration.
        // The instruction builder auto-appends them; we derive them here only
        // to compute migratorRemainingAccountsHash.
        const [market] = await predictionMigrator.getPredictionMarketAddress(
          oracleStateAddress,
          WSOL_MINT,
        );
        const [potVault] =
          await predictionMigrator.getPredictionPotVaultAddress(market);
        const [marketAuthority] =
          await predictionMigrator.getPredictionMarketAuthorityAddress(market);
        const [entryAddress] =
          await predictionMigrator.getPredictionEntryAddress(market, entryId);
        const [entryByMint] =
          await predictionMigrator.getPredictionEntryByMintAddress(
            market,
            baseMint.address,
          );

        // ── Encode migrator payloads ────────────────────────────────────────
        // Init payload → registerEntry; migrate payload → migrateEntry.
        const migratorInitPayload = predictionMigrator
          .getRegisterEntryInstructionDataEncoder()
          .encode({ entryId });

        const migratorMigratePayload = predictionMigrator
          .getMigrateEntryInstructionDataEncoder()
          .encode({ entryId });

        // ── Build the initializeLaunch instruction ───────────────────────────
        // The instruction builder automatically appends the 6 register_entry
        // remaining accounts for the prediction migrator.
        const ix = await initializer.createInitializeLaunchInstruction(
          {
            config,
            launch,
            launchAuthority,
            baseMint,
            quoteMint: WSOL_MINT,
            baseVault,
            quoteVault,
            feeLocker,
            payer,
            authority: payer,
            hookProgram: initializer.PREDICTION_HOOK_PROGRAM_ID,
            migratorProgram:
              predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
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
            curveVirtualBase: CURVE_VIRTUAL_BASE,
            curveVirtualQuote: CURVE_VIRTUAL_QUOTE,
            curveFeeBps: 100, // 1% swap fee
            curveKind: initializer.CURVE_KIND_XYK,
            curveParams: new Uint8Array([
              initializer.CURVE_PARAMS_FORMAT_XYK_V0,
            ]),
            allowBuy: true,
            allowSell: true,
            hookProgram: initializer.PREDICTION_HOOK_PROGRAM_ID,
            hookFlags: initializer.HF_BEFORE_SWAP,
            hookPayload: new Uint8Array(),
            migratorInitPayload,
            migratorMigratePayload,
            // Prediction hook reads oracle_state to check is_finalized.
            hookRemainingAccountsHash: initializer.computeRemainingAccountsHash(
              [oracleStateAddress],
            ),
            migratorInitRemainingAccountsHash:
              initializer.computeRemainingAccountsHash([
                oracleStateAddress,
                market,
                potVault,
                marketAuthority,
                entryAddress,
                entryByMint,
              ]),
            migratorRemainingAccountsHash:
              initializer.computeRemainingAccountsHash([
                oracleStateAddress,
                market,
                potVault,
                marketAuthority,
                entryAddress,
                entryByMint,
              ]),
            // ALTs compress account keys but not instruction data; keep
            // metadata strings short enough to fit the 1232-byte tx limit.
            metadataName: `${outcome.label} Token`,
            metadataSymbol: outcome.label,
            metadataUri: `https://example.com/${outcome.label.toLowerCase()}.json`,
            feeBeneficiaries: [{ wallet: baseMint.address, shareBps: 9500 }],
          },
          deployment.initializerProgram,
        );
        const lookupTable = await createLookupTableForInstruction({
          rpc,
          rpcSubscriptions,
          payer,
          instruction: ix,
          label: `${outcome.label} initialize_launch lookup table`,
        });

        const { value: latestBlockhash } = await rpc
          .getLatestBlockhash()
          .send();
        const transactionMessage =
          initializer.compressTransactionMessageWithLookupTable(
            pipe(
              createTransactionMessage({ version: 0 }),
              (tx) => setTransactionMessageFeePayerSigner(payer, tx),
              (tx) =>
                setTransactionMessageLifetimeUsingBlockhash(
                  latestBlockhash,
                  tx,
                ),
              (tx) => appendTransactionMessageInstructions([ix], tx),
            ),
            lookupTable,
          );
        const signedTransaction =
          await signTransactionMessageWithSigners(transactionMessage);
        await sendAndConfirmTransaction(
          signedTransaction as Parameters<typeof sendAndConfirmTransaction>[0],
          {
            commitment: 'confirmed',
          },
        );

        console.log(`  ${outcome.label} launch created!`);
        console.log(
          '  Transaction:',
          getSignatureFromTransaction(signedTransaction),
        );

        // Verify launch state
        const launchAccount = await initializer.fetchLaunch(rpc, launch, {
          programId: deployment.initializerProgram,
        });
        if (launchAccount) {
          console.log(
            '  Phase:              ',
            initializer.phaseLabel(launchAccount.phase),
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
            '  Migrates after:     ',
            MIN_RAISE_QUOTE.toString(),
            'lamports',
          );
        }
      }),
    );

    // ── Steps 4–6: Migration, resolution, and claim (overview) ───────────
    //
    // Once MIN_RAISE_QUOTE is reached, anyone can trigger migration. The initializer
    // CPI-invokes migrateEntry, burning unsold base tokens and moving SOL to potVault.
    //
    // After both entries migrate, the oracle authority resolves the market:
    //
    //   trustedOracle.getFinalizeInstruction({
    //     oracleAuthority: payer,
    //     oracleState: oracleStateAddress,
    //     winningMint: yesBaseMint,  // or noBaseMint
    //   })
    //
    // Winning token holders then claim their SOL share:
    //
    //   predictionMigrator.getClaimInstructionAsync({
    //     market, potVault, winnerMint, entryByMint,
    //     claimerWinnerAta, claimerQuoteAta, claimer, payer,
    //     burnAmount: claimerYesBalance,
    //   })

    console.log('');
    console.log('Prediction market setup complete.');
    console.log('  Oracle:', oracleStateAddress);
    console.log(
      '  Both YES and NO outcome launches are live in TRADING phase.',
    );
    console.log(
      '  Call trustedOracle.getFinalizeInstruction() to resolve after migration.',
    );
  } catch (error) {
    console.error('Error creating prediction market:', error);
    process.exit(1);
  }
}

main();
