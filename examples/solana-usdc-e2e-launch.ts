/**
 * Example: USDC E2E Launch — State Tracking Across Bonding Curve and Spot Market (Solana)
 *
 * Full lifecycle from launch creation to graduated CPMM pool:
 *
 *   1. Create XYK launch with CPMM migrator
 *   2. List all launches owned by this wallet (indexer-style enumeration)
 *   3. Preview a bonding curve buy without executing it
 *   4. Execute the buy on the bonding curve
 *   5. Migrate launch to CPMM pool
 *   6. Verify final launch state
 *   7. Read migrator state to confirm recipients and CPMM config
 *   8. Discover the graduated CPMM pool and read spot price
 */
import './env.js';

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { generateKeyPairSigner } from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import {
  cpmm,
  initializer,
  cpmmMigrator,
  createLaunch,
} from '../src/solana/index.js';
import { fetchLaunchFeeState } from '../src/solana/generated/initializer/accounts/launchFeeState.js';

import {
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
  DEVNET_USDC_MINT as USDC_MINT,
  assertBigintEqual,
  assertMigrationQuoteThreshold,
  assertSolanaExampleNetwork,
  assertTokenBalance,
  createSetComputeUnitLimitInstruction,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
  simulateInstructions,
} from './solanaExampleHelpers.js';

// ============================================================================
// Main
// ============================================================================

async function main() {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);

  // ── Token supply ─────────────────────────────────────────────────────────
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 200_000_000n * 10n ** BigInt(BASE_DECIMALS); // 20% to recipients
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS); //  5% seeds CPMM pool
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY; // 75%

  // Distribution split between creator (70%) and team (30%)
  const CREATOR_SHARE = (BASE_FOR_DISTRIBUTION * 70n) / 100n;
  const TEAM_SHARE = BASE_FOR_DISTRIBUTION - CREATOR_SHARE;

  const QUOTE_DECIMALS = 6; // USDC
  const START_MARKET_CAP_USD = 100_000;
  const END_MARKET_CAP_USD = 10_000_000;

  // ── Fee configuration ───────────────────────────────────────────────────
  const SWAP_FEE_BPS = DEFAULT_SWAP_FEE_BPS;

  // ── Graduation threshold and price floor ────────────────────────────────
  const minRaiseQuote = 100_000n; // 0.1 USDC
  const BUY_AMOUNT_IN = 200_000n; // 0.2 USDC; exceeds the migration threshold

  // ── Market cap → virtual reserves ────────────────────────────────────────
  const { start } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: START_MARKET_CAP_USD,
    endMarketCapUSD: END_MARKET_CAP_USD,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: 1,
  });

  // ── Step 1: Create launch ─────────────────────────────────────────────────
  console.log('Step 1: Creating XYK token launch...');

  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const metadata = DEFAULT_TEST_METADATA;

  const namespace = payer.address;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));
  const launchAddresses = await initializer.deriveCreateLaunchAddresses({
    deployment,
    namespace,
    launchId,
    baseMint,
    metadata,
  });
  const { launch, launchAuthority, launchFeeState } = launchAddresses;
  const initializerConfig = launchAddresses.config;

  const [payerQuoteAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: USDC_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await assertTokenBalance({
    rpc,
    owner: payer.address,
    mint: USDC_MINT,
    tokenAccount: payerQuoteAta,
    amount: BUY_AMOUNT_IN,
  });
  const recipients = [
    { wallet: payer.address, amount: CREATOR_SHARE },
    { wallet: payer.address, amount: TEAM_SHARE },
  ];

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
        quoteMint: USDC_MINT,
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
      },
      metadata,
      feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
    });
    if (!cpmmMigration) {
      throw new Error('CPMM migration accounts were not prepared');
    }
    const migrationAccounts = cpmmMigration;
    const cpmmConfig = migrationAccounts.cpmmConfig;
    const cpmmMigrationState = migrationAccounts.cpmmMigrationState;

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

    // ── Step 2: Enumerate launches by this wallet (indexer-style) ───────────
    console.log('Step 2: Listing launches owned by this wallet...');
    const ownedLaunches = await initializer.fetchLaunchesByAuthority(
      rpc,
      payer.address,
      { programId: deployment.initializerProgram },
    );
    console.log(`  Found ${ownedLaunches.length} launch(es)`);
    for (const { address: addr, account } of ownedLaunches) {
      console.log(
        `  ${addr}  phase=${initializer.phaseLabel(account.phase)}  quoteDeposited=${account.quoteDeposited}`,
      );
    }
    console.log('');

    // ── Step 3: Preview a curve buy without executing ────────────────────────
    console.log(
      'Step 3: Previewing bonding curve buy (read-only simulation)...',
    );
    const previewIx = initializer.createPreviewSwapExactInInstruction(
      {
        launch,
        launchFeeState,
        baseVault: baseVault.address,
        quoteVault: quoteVault.address,
        hookProgram: deployment.cpmmHookProgram,
      },
      {
        amountIn: BUY_AMOUNT_IN,
        tradeDirection: initializer.TRADE_DIRECTION_BUY,
      },
      deployment.initializerProgram,
    );

    const simulateResult = await simulateInstructions({
      rpc,
      payer,
      instructions: [previewIx],
    });

    if (simulateResult.returnData?.data) {
      const returnBytes = Uint8Array.from(
        atob(simulateResult.returnData.data[0]),
        (c) => c.charCodeAt(0),
      );
      const preview = initializer.decodePreviewSwapExactInResult(returnBytes);
      console.log(
        '  Amount in:  ',
        BUY_AMOUNT_IN.toString(),
        'USDC atoms (0.2 USDC)',
      );
      console.log(
        '  Amount out: ',
        preview.amountOut.toString(),
        'base atoms (estimated)',
      );
      console.log('  Fee paid:   ', preview.feePaid.toString(), 'USDC atoms');
    } else {
      console.log(
        '  Preview simulation returned no data (launch may need trading to be open)',
      );
    }
    console.log('');

    // ── Step 4: Execute the curve buy ────────────────────────────────────────
    // ATA creation and the curve buy are batched into a single transaction.
    // The payer's USDC ATA must already be funded on devnet.
    console.log('Step 4: Executing bonding curve buy...');

    const [userBaseAta] = await findAssociatedTokenPda({
      owner: payer.address,
      mint: baseMint.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [userQuoteAta] = await findAssociatedTokenPda({
      owner: payer.address,
      mint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const createBaseAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata: userBaseAta,
      owner: payer.address,
      mint: baseMint.address,
    });
    const createQuoteAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata: userQuoteAta,
      owner: payer.address,
      mint: USDC_MINT,
    });
    const swapIx = initializer.createCurveSwapExactInInstruction(
      {
        launch,
        launchAuthority,
        baseVault: baseVault.address,
        quoteVault: quoteVault.address,
        launchFeeState,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
        baseMint: baseMint.address,
        quoteMint: USDC_MINT,
        user: payer,
        hookProgram: deployment.cpmmHookProgram,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
      },
      {
        amountIn: BUY_AMOUNT_IN,
        minAmountOut: 1n, // accept any amount for the example; use preview.amountOut in prod
        tradeDirection: initializer.TRADE_DIRECTION_BUY,
      },
      deployment.initializerProgram,
    );

    {
      const signature = await sendInstructions({
        rpc,
        rpcSubscriptions,
        payer,
        instructions: [createBaseAtaIx, createQuoteAtaIx, swapIx],
      });

      console.log('  Curve buy confirmed:', signature);
    }

    const expectedQuoteFee = initializer.getCurveSwapFeeAmount(
      BUY_AMOUNT_IN,
      SWAP_FEE_BPS,
    );
    const feeStateAccount = await fetchLaunchFeeState(rpc, launchFeeState, {
      commitment: 'confirmed',
    });
    const feeState = feeStateAccount.data;
    assertBigintEqual(
      'cumulatedQuoteFees',
      feeState.cumulatedQuoteFees,
      expectedQuoteFee,
    );
    assertBigintEqual('cumulatedBaseFees', feeState.cumulatedBaseFees, 0n);
    const protocolQuoteFees =
      (expectedQuoteFee * BigInt(feeState.protocolFeeBps)) / 10_000n;
    const beneficiaryQuoteFees = expectedQuoteFee - protocolQuoteFees;
    const pendingQuoteFees = feeState.cumulatedQuoteFees;
    const { quoteVaultAmount, migrationQuoteAmount } =
      await assertMigrationQuoteThreshold({
        rpc,
        quoteVault: quoteVault.address,
        pendingQuoteFees,
        minRaiseQuote,
      });

    console.log('  Fee arithmetic verified:');
    console.log('    cumulated quote fees:', expectedQuoteFee.toString());
    console.log('    protocol quote fees: ', protocolQuoteFees.toString());
    console.log('    beneficiary fees:    ', beneficiaryQuoteFees.toString());
    console.log('    quote vault amount:  ', quoteVaultAmount.toString());
    console.log('    migration quote:     ', migrationQuoteAmount.toString());
    console.log('');

    // ── Step 5: Migrate launch to CPMM pool ─────────────────────────────────
    //
    // Anyone can call migrate_launch once quote_vault_amount - pending_quote_fees
    // is at least minRaiseQuote.
    // The migrator creates the canonical CPMM pool graph inline, then seeds
    // liquidity into it. The remaining accounts must match the hash committed
    // at launch creation.
    console.log('Step 5: Migrating launch to CPMM pool...');

    const migrateLaunchIxBase = initializer.createMigrateLaunchInstruction(
      {
        config: initializerConfig,
        launch,
        launchAuthority,
        baseMint: baseMint.address,
        quoteMint: USDC_MINT,
        baseVault: baseVault.address,
        quoteVault: quoteVault.address,
        launchFeeState,
        migratorProgram: deployment.cpmmMigratorProgram,
        payer,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        rent: SYSVAR_RENT_ADDRESS,
      },
      deployment.initializerProgram,
    );

    const migrateLaunchIx = {
      ...migrateLaunchIxBase,
      accounts: [
        ...(migrateLaunchIxBase.accounts ?? []),
        ...migrationAccounts.metas,
      ],
    };

    {
      const signature = await sendInstructions({
        rpc,
        rpcSubscriptions,
        payer,
        instructions: [
          createSetComputeUnitLimitInstruction(400_000),
          migrateLaunchIx,
        ],
      });

      console.log('  Migration confirmed:', signature);
    }
    console.log('');

    // ── Step 6: Verify final launch state ────────────────────────────────────
    console.log('Step 6: Verifying final launch phase...');
    const finalLaunch = await initializer.fetchLaunch(rpc, launch, {
      commitment: 'confirmed',
      programId: deployment.initializerProgram,
    });

    if (!finalLaunch) {
      throw new Error('Launch account not found after migration');
    }

    console.log(`  Final phase: ${initializer.phaseLabel(finalLaunch.phase)}`);
    console.log(`  Quote deposited: ${finalLaunch.quoteDeposited} USDC atoms`);
    console.log('');

    if (finalLaunch.phase === initializer.PHASE_MIGRATED) {
      // ── Step 7: Read migrator state ────────────────────────────────────────
      console.log('Step 7: Reading CPMM migrator state...');
      const migratorState = await cpmmMigrator.fetchCpmmMigratorState(
        rpc,
        cpmmMigrationState,
      );

      if (migratorState) {
        console.log('  CPMM config:  ', migratorState.cpmmConfig);
        console.log('  Is migrated:  ', migratorState.isMigrated);
        console.log('  Recipients:   ', migratorState.recipients.length);
        for (const r of migratorState.recipients) {
          console.log('    wallet:', r.wallet, ' amount:', r.amount.toString());
        }
      }
      console.log('');

      // ── Step 8: Discover graduated CPMM pool ──────────────────────────────
      console.log('Step 8: Looking up graduated CPMM pool...');
      const poolResult = await cpmm.getPoolByMints(
        rpc,
        baseMint.address,
        USDC_MINT,
        {
          commitment: 'confirmed',
          programId: deployment.cpmmProgram,
        },
      );

      if (poolResult) {
        const { address: poolAddress, account: pool } = poolResult;
        const price0 = cpmm.getSpotPrice0(pool); // base per USDC
        const price1 = cpmm.getSpotPrice1(pool); // USDC per base

        console.log('  Pool address: ', poolAddress);
        console.log('  token0 mint:  ', pool.token0Mint);
        console.log('  token1 mint:  ', pool.token1Mint);
        console.log('  reserve0:     ', pool.reserve0.toString());
        console.log('  reserve1:     ', pool.reserve1.toString());
        console.log('  Swap fee:     ', pool.swapFeeBps, 'bps');
        console.log('  Spot price0:  ', price0.toFixed(8), '(base/USDC)');
        console.log('  Spot price1:  ', price1.toFixed(8), '(USDC/base)');
      } else {
        console.log('  CPMM pool not found — may not be initialized yet');
      }
    } else {
      console.log(
        'Unexpected: launch not in MIGRATED phase after migrate_launch call.',
      );
    }

    console.log('');
    console.log('E2E tracking example complete.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
