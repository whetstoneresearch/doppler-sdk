/**
 * Example: Cosigner-Gated Initializer Swap E2E (Solana)
 *
 * Full lifecycle from launch creation through migration, where the bonding
 * curve is gated by a readonly cosigner and the graduated CPMM pool is not:
 *
 *   1. Create XYK launch with CPMM migrator
 *   2. Preview a bonding curve buy without executing it
 *   3. Prove an unsigned bonding-curve buy fails, then execute it with the cosigner
 *   4. Migrate launch to CPMM pool
 *   5. Verify final launch state
 *   6. Read migrator state to confirm recipients and CPMM config
 *   7. Discover the graduated CPMM pool and read spot price
 *   8. Execute a CPMM swap without a cosigner
 *
 * Uses the cosigner_hook deployment to reject pre-migration swaps unless a
 * configured readonly cosigner signs the transaction.
 */
import './env.js';

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getSyncNativeInstruction,
} from '@solana-program/token';
import {
  SYSTEM_PROGRAM_ADDRESS,
  getTransferSolInstruction,
} from '@solana-program/system';
import { generateKeyPairSigner } from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import {
  cosignerHook,
  cpmm,
  cpmmMigrator,
  initializer,
} from '../src/solana/index.js';
import {
  DEFAULT_CPMM_FEE_SPLIT_BPS,
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
  WSOL_MINT,
  assertSimulationRejected,
  assertSolanaExampleNetwork,
  createSetComputeUnitLimitInstruction,
  createSolanaClientsFromEnv,
  fetchActiveCosigners,
  getSolPriceUsd,
  getSolanaCpmmDeploymentFromEnv,
  getTokenAccountRentLamports,
  loadCosigner,
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
  const [cosignerConfig] = await cosignerHook.getCosignerHookConfigAddress(
    deployment.cosignerHookProgram,
  );
  const cosigner = await loadCosigner();

  console.log('Checking cosigner hook config...');
  const activeCosigners = await fetchActiveCosigners({
    rpc,
    cosignerHookProgram: deployment.cosignerHookProgram,
    cosignerConfig,
  });
  if (!activeCosigners.has(cosigner.address.toString())) {
    throw new Error(
      `COSIGNER_KEYPAIR resolves to ${cosigner.address}, which is not registered in cosigner hook config ${cosignerConfig}`,
    );
  }
  console.log('  Cosigner hook config verified');
  console.log('');

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

  const QUOTE_DECIMALS = 9; // WSOL
  const START_MARKET_CAP_USD = 100_000;
  const END_MARKET_CAP_USD = 10_000_000;

  // ── Fee configuration ───────────────────────────────────────────────────
  const SWAP_FEE_BPS = DEFAULT_SWAP_FEE_BPS;
  const CPMM_SWAP_FEE_BPS = SWAP_FEE_BPS;
  const CPMM_SWAP_FEE_SPLIT_BPS = DEFAULT_CPMM_FEE_SPLIT_BPS; // migrated launch fees route through LaunchFeeState
  const INITIALIZER_HOOK_FLAGS =
    initializer.HF_BEFORE_SWAP | initializer.HF_FORWARD_READONLY_SIGNERS;
  const COSIGN_GATE_SECONDS = Number(process.env.COSIGN_GATE_SECONDS ?? 300);
  // ── Graduation threshold and price floor ────────────────────────────────
  const MIN_SOL_RAISE = 0.1; // low example threshold
  const minRaiseQuote = BigInt(MIN_SOL_RAISE * 1_000_000_000);

  // ── Market cap → virtual reserves ────────────────────────────────────────
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

  // ── Step 1: Create launch ─────────────────────────────────────────────────
  console.log('Step 1: Creating XYK token launch...');

  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const metadataAccount = await initializer.getTokenMetadataAddress(
    baseMint.address,
  );

  const namespace = cosignerConfig;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));
  const {
    signedHookRemainingAccounts,
    unsignedHookRemainingAccounts,
    hookRemainingAccountsHash,
  } = cosignerHook.getCosignerHookRemainingAccounts({ namespace, cosigner });
  const cosignGateExpiresAt = BigInt(
    Math.floor(Date.now() / 1_000) + COSIGN_GATE_SECONDS,
  );
  const hookPayload = cosignerHook.encodeCosignerGateExpiryPayload({
    mode: cosignerHook.GATE_EXPIRY_UNIX_TIMESTAMP,
    value: cosignGateExpiresAt,
    cosigner: cosigner.address,
  });

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
  console.log('  Initializer program:', deployment.initializerProgram);
  console.log('  CPMM program:       ', deployment.cpmmProgram);
  console.log('  CPMM migrator:      ', deployment.cpmmMigratorProgram);
  console.log('  Cosigner hook:      ', deployment.cosignerHookProgram);
  console.log('  Cosigner config:    ', cosignerConfig);
  console.log('  Active cosigners:   ', Array.from(activeCosigners).join(', '));
  console.log('  Signing cosigner:   ', cosigner.address);
  console.log('  Cosign gate expiry: ', cosignGateExpiresAt.toString());
  console.log('');

  const migratorInitPayload = cpmmMigrator.encodeRegisterLaunchPayload({
    cpmmConfig: cpmmConfig,
    initialSwapFeeBps: CPMM_SWAP_FEE_BPS,
    initialFeeSplitBps: CPMM_SWAP_FEE_SPLIT_BPS,
    recipients: [
      { wallet: payer.address, amount: CREATOR_SHARE },
      { wallet: payer.address, amount: TEAM_SHARE }, // use payer as team wallet in this example
    ],
    minRaiseQuote,
    minMigrationPriceQ64Opt: null,
    migratedPoolHookConfig: null,
  });

  const migratorMigratePayload = cpmmMigrator.encodeMigratePayload({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  });

  // ── Build, sign, and send ────────────────────────────────────────────────
  console.log('Building launch instruction...');
  try {
    const metadata = DEFAULT_TEST_METADATA;

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
        hookProgram: deployment.cosignerHookProgram,
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
        hookFlags: INITIALIZER_HOOK_FLAGS,
        hookPayload,
        migratorInitPayload,
        migratorMigratePayload,
        hookRemainingAccountsHash,
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

    // ── Step 2: Preview a curve buy without executing ────────────────────────
    console.log(
      'Step 2: Previewing bonding curve buy (read-only simulation)...',
    );
    const BUY_AMOUNT_IN = 200_000_000n; // 0.2 SOL — exceeds 0.1 SOL graduation threshold

    const previewIx = initializer.createPreviewSwapExactInInstruction(
      {
        launch,
        launchFeeState,
        baseVault: baseVault.address,
        quoteVault: quoteVault.address,
        hookProgram: deployment.cosignerHookProgram,
        remainingAccounts: signedHookRemainingAccounts,
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
        'lamports (0.2 SOL)',
      );
      console.log(
        '  Amount out: ',
        preview.amountOut.toString(),
        'base atoms (estimated)',
      );
      console.log('  Fee paid:   ', preview.feePaid.toString(), 'lamports');
    } else {
      console.log(
        '  Preview simulation returned no data (launch may need trading to be open)',
      );
    }
    console.log('');

    // ── Step 3: Execute the curve buy ────────────────────────────────────────
    // ATA creation, WSOL deposit, and the curve buy are batched into a single
    // transaction — instructions execute sequentially so the ATAs exist and are
    // funded before the swap runs.
    console.log('Step 3: Executing bonding curve buy...');

    const [userBaseAta] = await findAssociatedTokenPda({
      owner: payer.address,
      mint: baseMint.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [userQuoteAta] = await findAssociatedTokenPda({
      owner: payer.address,
      mint: WSOL_MINT,
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
      mint: WSOL_MINT,
    });
    const transferSolIx = getTransferSolInstruction({
      source: payer,
      destination: userQuoteAta,
      amount: BUY_AMOUNT_IN + getTokenAccountRentLamports(),
    });

    const syncNativeIx = getSyncNativeInstruction({ account: userQuoteAta });

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
        quoteMint: WSOL_MINT,
        user: payer,
        hookProgram: deployment.cosignerHookProgram,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        remainingAccounts: signedHookRemainingAccounts,
      },
      {
        amountIn: BUY_AMOUNT_IN,
        minAmountOut: 1n, // accept any amount for the example; use preview.amountOut in prod
        tradeDirection: initializer.TRADE_DIRECTION_BUY,
      },
      deployment.initializerProgram,
    );

    const unsignedSwapIx = initializer.createCurveSwapExactInInstruction(
      {
        launch,
        launchAuthority,
        baseVault: baseVault.address,
        quoteVault: quoteVault.address,
        launchFeeState,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
        baseMint: baseMint.address,
        quoteMint: WSOL_MINT,
        user: payer,
        hookProgram: deployment.cosignerHookProgram,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        remainingAccounts: unsignedHookRemainingAccounts,
      },
      {
        amountIn: BUY_AMOUNT_IN,
        minAmountOut: 1n,
        tradeDirection: initializer.TRADE_DIRECTION_BUY,
      },
      deployment.initializerProgram,
    );

    // This intentionally omits the cosigner signer account. The initializer
    // hook is configured to reject this pre-migration swap.
    const unsignedCurveResult = await simulateInstructions({
      rpc,
      payer,
      instructions: [
        createBaseAtaIx,
        createQuoteAtaIx,
        transferSolIx,
        syncNativeIx,
        unsignedSwapIx,
      ],
    });
    assertSimulationRejected(
      'Unsigned bonding curve buy',
      unsignedCurveResult.err,
    );

    {
      const signature = await sendInstructions({
        rpc,
        rpcSubscriptions,
        payer,
        instructions: [
          createBaseAtaIx,
          createQuoteAtaIx,
          transferSolIx,
          syncNativeIx,
          swapIx,
        ],
      });

      console.log('  Cosigned curve buy confirmed:', signature);
    }
    console.log('');

    // ── Step 4: Migrate launch to CPMM pool ─────────────────────────────────
    //
    // Anyone can call migrate_launch once quote_vault_amount - pending_quote_fees
    // is at least minRaiseQuote.
    // The migrator creates the canonical CPMM pool graph inline, then seeds
    // liquidity into it. The remaining accounts must match the hash committed
    // at launch creation.
    console.log('Step 4: Migrating launch to CPMM pool...');

    const migrateLaunchIxBase = initializer.createMigrateLaunchInstruction(
      {
        config: initializerConfig,
        launch,
        launchAuthority,
        baseMint: baseMint.address,
        quoteMint: WSOL_MINT,
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

    // ── Step 5: Verify final launch state ────────────────────────────────────
    console.log('Step 5: Verifying final launch phase...');
    const finalLaunch = await initializer.fetchLaunch(rpc, launch, {
      commitment: 'confirmed',
      programId: deployment.initializerProgram,
    });

    if (!finalLaunch) {
      throw new Error('Launch account not found after migration');
    }

    console.log(`  Final phase: ${initializer.phaseLabel(finalLaunch.phase)}`);
    console.log(`  Quote deposited: ${finalLaunch.quoteDeposited} lamports`);
    console.log('');

    if (finalLaunch.phase === initializer.PHASE_MIGRATED) {
      // ── Step 6: Read migrator state ────────────────────────────────────────
      console.log('Step 6: Reading CPMM migrator state...');
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

      // ── Step 7: Discover graduated CPMM pool ──────────────────────────────
      console.log('Step 7: Looking up graduated CPMM pool...');
      const poolResult = await cpmm.getPoolByMints(
        rpc,
        baseMint.address,
        WSOL_MINT,
        {
          commitment: 'confirmed',
          programId: deployment.cpmmProgram,
        },
      );

      if (poolResult) {
        const { address: poolAddress, account: pool } = poolResult;
        const price0 = cpmm.getSpotPrice0(pool); // base per WSOL
        const price1 = cpmm.getSpotPrice1(pool); // WSOL per base

        console.log('  Pool address: ', poolAddress);
        console.log('  token0 mint:  ', pool.token0Mint);
        console.log('  token1 mint:  ', pool.token1Mint);
        console.log('  reserve0:     ', pool.reserve0.toString());
        console.log('  reserve1:     ', pool.reserve1.toString());
        console.log('  Swap fee:     ', pool.swapFeeBps, 'bps');
        console.log('  Hook program: ', pool.hookProgram);
        console.log('  Hook flags:   ', pool.hookFlags);
        if (
          pool.hookProgram !== SYSTEM_PROGRAM_ADDRESS ||
          pool.hookFlags !== 0
        ) {
          throw new Error(
            `Migrated pool hook mismatch: got program ${pool.hookProgram} flags ${pool.hookFlags}, expected no CPMM hook`,
          );
        }
        console.log('  Spot price0:  ', price0.toFixed(8), '(base/WSOL)');
        console.log('  Spot price1:  ', price1.toFixed(8), '(WSOL/base)');

        // ── Step 8: Execute a post-migration CPMM swap without a cosigner ──
        console.log('Step 8: Executing ungated CPMM swap...');

        const tradeDirection = pool.token0Mint === baseMint.address ? 0 : 1;
        const CPMM_SWAP_AMOUNT_IN = 1_000_000n; // 1 base token at 6 decimals
        const quote = cpmm.getSwapQuote(
          pool,
          CPMM_SWAP_AMOUNT_IN,
          tradeDirection,
        );
        const minAmountOut = (quote.amountOut * 9_500n) / 10_000n; // 5% example slippage

        const userToken0 =
          pool.token0Mint === baseMint.address ? userBaseAta : userQuoteAta;
        const userToken1 =
          pool.token1Mint === baseMint.address ? userBaseAta : userQuoteAta;

        const cpmmSwapIx = cpmm.createSwapInstruction({
          config: cpmmConfig,
          pool: poolAddress,
          authority: pool.authority,
          vault0: pool.vault0,
          vault1: pool.vault1,
          token0Mint: pool.token0Mint,
          token1Mint: pool.token1Mint,
          userToken0,
          userToken1,
          user: payer,
          amountIn: CPMM_SWAP_AMOUNT_IN,
          minAmountOut,
          tradeDirection,
          programId: deployment.cpmmProgram,
        });

        {
          const signature = await sendInstructions({
            rpc,
            rpcSubscriptions,
            payer,
            instructions: [
              createSetComputeUnitLimitInstruction(400_000),
              cpmmSwapIx,
            ],
          });

          console.log('  Ungated CPMM swap confirmed:', signature);
        }
      } else {
        console.log('  CPMM pool not found — may not be initialized yet');
      }
    } else {
      console.log(
        'Unexpected: launch not in MIGRATED phase after migrate_launch call.',
      );
    }

    console.log('');
    console.log('Cosigner-gated initializer swap E2E example complete.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
