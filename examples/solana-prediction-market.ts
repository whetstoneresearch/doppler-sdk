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

import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { generateKeyPairSigner } from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import {
  initializer,
  predictionMigrator,
  trustedOracle,
} from '../src/solana/index.js';
import {
  WSOL_MINT,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
} from './solanaExampleHelpers.js';

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

  console.log('Creating trusted oracle...');
  console.log('  Oracle state:', oracleStateAddress);

  try {
    const initOracleIx = trustedOracle.getInitializeOracleInstruction({
      oracleAuthority: payer,
      oracleState: oracleStateAddress,
      nonce: oracleNonce,
      quoteMint: WSOL_MINT,
    });

    const oracleSignature = await sendInstructions({
      rpc,
      rpcSubscriptions,
      payer,
      instructions: [initOracleIx],
    });
    console.log('  Oracle created:', oracleSignature);

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
        const baseMint = await generateKeyPairSigner();
        const baseVault = await generateKeyPairSigner();
        const quoteVault = await generateKeyPairSigner();
        const metadata = {
          metadataName: `${outcome.label} Token`,
          metadataSymbol: outcome.label,
          metadataUri: `https://example.com/${outcome.label.toLowerCase()}.json`,
        };
        const launchAddresses = await initializer.deriveCreateLaunchAddresses({
          deployment,
          namespace,
          launchId,
          baseMint,
          metadata,
        });
        const { launch, launchAuthority } = launchAddresses;

        console.log('  Launch:           ', launch);
        console.log('  Launch authority: ', launchAuthority);
        console.log('  Base mint:        ', baseMint.address);

        // ── Derive prediction market PDAs for remaining-accounts hash ────────
        // These are the accounts the migrator will receive during launch
        // registration and migration. The launch helper commits their hashes;
        // the low-level instruction builder appends the register_entry accounts.
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
        const predictionRemainingAccounts = [
          oracleStateAddress,
          market,
          potVault,
          marketAuthority,
          entryAddress,
          entryByMint,
        ];

        // ── Encode migrator payloads ────────────────────────────────────────
        // Init payload → registerEntry; migrate payload → migrateEntry.
        const migratorInitPayload = predictionMigrator
          .getRegisterEntryInstructionDataEncoder()
          .encode({ entryId });

        const migratorMigratePayload = predictionMigrator
          .getMigrateEntryInstructionDataEncoder()
          .encode({ entryId });

        const ix = await initializer.createInitializeLaunchInstruction(
          {
            config: launchAddresses.config,
            launch,
            launchAuthority,
            baseMint,
            quoteMint: WSOL_MINT,
            baseVault,
            quoteVault,
            launchFeeState: launchAddresses.launchFeeState,
            payer,
            authority: payer,
            hookProgram: initializer.PREDICTION_HOOK_PROGRAM_ID,
            migratorProgram:
              predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
            baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
            quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
            systemProgram: SYSTEM_PROGRAM_ADDRESS,
            rent: SYSVAR_RENT_ADDRESS,
            metadataAccount: launchAddresses.metadataAccount,
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
            swapFeeBps: 100,
            curveKind: initializer.CURVE_KIND_XYK,
            curveParams: new Uint8Array([
              initializer.CURVE_PARAMS_FORMAT_XYK_V0,
            ]),
            allowBuy: true,
            allowSell: true,
            hookFlags: initializer.HF_BEFORE_SWAP,
            hookPayload: new Uint8Array(),
            migratorInitPayload,
            migratorMigratePayload,
            hookRemainingAccountsHash: initializer.computeRemainingAccountsHash(
              [oracleStateAddress],
            ),
            migratorInitRemainingAccountsHash:
              initializer.computeRemainingAccountsHash(
                predictionRemainingAccounts,
              ),
            migratorRemainingAccountsHash:
              initializer.computeRemainingAccountsHash(
                predictionRemainingAccounts,
              ),
            feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
            metadataName: metadata.metadataName,
            metadataSymbol: metadata.metadataSymbol,
            metadataUri: metadata.metadataUri,
          },
          deployment.initializerProgram,
        );
        const launchSignature = await sendInitializeLaunchWithLookupTable({
          rpc,
          rpcSubscriptions,
          payer,
          instruction: ix,
          metadata,
          label: `${outcome.label} initialize_launch`,
        });

        console.log(`${outcome.label} launch created!`);
        console.log('  Transaction:', launchSignature);

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
