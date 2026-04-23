/**
 * Example: Advanced E2E Launch — State Tracking Across Bonding Curve and Spot Market (Solana)
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
  getSyncNativeInstruction,
} from '@solana-program/token';
import {
  SYSTEM_PROGRAM_ADDRESS,
  getTransferSolInstruction,
} from '@solana-program/system';
import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  AccountRole,
  type Address,
} from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import { cpmm, initializer, cpmmMigrator } from '../src/solana/index.js';
import { SYSVAR_INSTRUCTIONS_ADDRESS } from '../src/solana/core/constants.js';

// ============================================================================
// Environment
// ============================================================================

const keypairJson = process.env.SOLANA_KEYPAIR;
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const wsUrl = process.env.SOLANA_WS_URL ?? 'wss://api.devnet.solana.com';

if (!keypairJson) {
  throw new Error('SOLANA_KEYPAIR must be set (JSON array of 64 bytes)');
}

// WSOL mint — pools use the wrapped SPL mint since native SOL can't live in token vaults.
const WSOL_MINT: Address =
  'So11111111111111111111111111111111111111112' as Address;

// ============================================================================
// Price feed
// ============================================================================

async function getSolPriceUsd(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
  );
  const data = await response.json();
  return data.solana.usd;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const payer = await createKeyPairSignerFromBytes(
    new Uint8Array(JSON.parse(keypairJson as string)),
  );

  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

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
  const CURVE_FEE_BPS = 200; // 2% swap fee during the bonding curve phase — stays in the quote vault, compounding into the curve
  const CPMM_SWAP_FEE_BPS = 100; // 1% swap fee on the graduated CPMM pool
  const CPMM_SWAP_FEE_SPLIT_BPS = 5000; // 50% of CPMM swap fees claimable by LP holders; remaining 50% compounds into the pool

  // ── Graduation threshold and price floor ────────────────────────────────
  const MIN_SOL_RAISE = 0.1; // devnet testing threshold
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

  const namespace = payer.address;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));

  const [launch] = await initializer.getLaunchAddress(namespace, launchId);
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
  const [initializerConfig] = await initializer.getConfigAddress();
  const [cpmmConfig] = await cpmm.getConfigAddress();
  const [cpmmMigratorState] =
    await cpmmMigrator.getCpmmMigratorStateAddress(launch);

  console.log('Derived addresses:');
  console.log('  Launch:          ', launch);
  console.log('  Launch authority:', launchAuthority);
  console.log('  Initializer config:', initializerConfig);
  console.log('  CPMM config:     ', cpmmConfig);
  console.log('  CPMM migrator state:', cpmmMigratorState);
  console.log('');

  // ── CPMM migration remaining accounts ────────────────────────────────────
  // Migrations commit the canonical CPMM graph that will be created/used
  // during migrate_launch: pool, authority, vault PDAs, protocol position,
  // launch LP position, program, and payout ATAs.
  const poolInit = await cpmm.getPoolInitAddresses(baseMint.address, WSOL_MINT);
  const pool = poolInit.pool[0];
  const poolAuthority = poolInit.authority[0];
  const protocolPosition = poolInit.protocolPosition[0];
  const poolVault0 = poolInit.vault0[0];
  const poolVault1 = poolInit.vault1[0];
  const [launchLpPosition] = await cpmm.getPositionAddress(
    pool,
    launchAuthority,
    0n,
  );

  const [payerBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
    cpmmConfig: cpmmConfig,
    initialSwapFeeBps: CPMM_SWAP_FEE_BPS,
    initialFeeSplitBps: CPMM_SWAP_FEE_SPLIT_BPS,
    recipients: [
      { wallet: payer.address, amount: CREATOR_SHARE },
      { wallet: payer.address, amount: TEAM_SHARE }, // use payer as team wallet on devnet
    ],
    minRaiseQuote,
    minMigrationPriceQ64Opt: null,
  });

  const migratorMigrateCalldata = cpmmMigrator.encodeMigrateCalldata({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  });

  // ── Build, sign, and send ────────────────────────────────────────────────
  console.log('Building launch instruction...');
  try {
    const ix = await initializer.createInitializeLaunchInstruction(
      {
        config: initializerConfig,
        launch,
        launchAuthority,
        baseMint,
        quoteMint: WSOL_MINT,
        baseVault,
        quoteVault,
        payer,
        authority: payer,
        migratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
        cpmmConfig,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        rent: SYSVAR_RENT_ADDRESS,
        metadataAccount,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_ADDRESS,
        addressLookupTable: initializer.DOPPLER_DEVNET_ALT,
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
        curveFeeBps: CURVE_FEE_BPS,
        curveKind: initializer.CURVE_KIND_XYK,
        curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
        allowBuy: true,
        allowSell: true,
        sentinelProgram: initializer.CPMM_SENTINEL_PROGRAM_ID,
        sentinelFlags: initializer.SF_BEFORE_SWAP,
        sentinelCalldata: new Uint8Array(),
        migratorInitCalldata,
        migratorMigrateCalldata,
        sentinelRemainingAccountsHash:
          initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
        // Commits the accounts that must be passed as remaining accounts to
        // migrate_launch: state, cpmm_config, pool, pool_authority, pool_vault0,
        // pool_vault1, protocol_position, launch_lp_position, cpmm_program,
        // admin_base_ata, creator_ata, team_ata
        migratorRemainingAccountsHash: initializer.computeRemainingAccountsHash(
          [
            cpmmMigratorState,
            cpmmConfig,
            pool,
            poolAuthority,
            poolVault0,
            poolVault1,
            protocolPosition,
            launchLpPosition,
            cpmm.CPMM_PROGRAM_ID,
            payerBaseAta, // admin_base_ata (unsold curve tokens)
            payerBaseAta, // creator recipient ATA (CREATOR_SHARE → payer)
            payerBaseAta, // team recipient ATA (TEAM_SHARE → payer)
          ],
        ),
        metadataName: 'E2E Token',
        metadataSymbol: 'E2ETK',
        metadataUri: 'https://example.com/e2e-token.json',
      },
    );

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const transactionMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(payer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([ix], tx),
    );

    const signedTransaction =
      await signTransactionMessageWithSigners(transactionMessage);

    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });
    await sendAndConfirmTransaction(signedTransaction, {
      commitment: 'confirmed',
    });

    console.log('');
    console.log('Token launch created successfully!');
    console.log('  Launch address:', launch);
    console.log('  Base mint:     ', baseMint.address);
    console.log(
      '  Transaction:   ',
      getSignatureFromTransaction(signedTransaction),
    );

    // ── Step 2: Enumerate launches by this wallet (indexer-style) ───────────
    console.log('Step 2: Listing launches owned by this wallet...');
    const ownedLaunches = await initializer.fetchLaunchesByAuthority(
      rpc,
      payer.address,
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
    const BUY_AMOUNT_IN = 200_000_000n; // 0.2 SOL — exceeds 0.1 SOL graduation threshold

    const previewIx = initializer.createPreviewSwapExactInInstruction(
      { launch, baseVault: baseVault.address, quoteVault: quoteVault.address },
      { amountIn: BUY_AMOUNT_IN, direction: initializer.DIRECTION_BUY },
    );

    // simulateTransaction is the idiomatic way to run a read-only instruction.
    const { value: previewBlockhash } = await rpc.getLatestBlockhash().send();

    const previewMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(payer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(previewBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([previewIx], tx),
    );

    const signedPreview =
      await signTransactionMessageWithSigners(previewMessage);

    const { value: simulateResult } = await rpc
      .simulateTransaction(getBase64EncodedWireTransaction(signedPreview), {
        encoding: 'base64',
        replaceRecentBlockhash: true,
      })
      .send();

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

    // ── Step 4: Execute the curve buy ────────────────────────────────────────
    // ATA creation, WSOL deposit, and the curve buy are batched into a single
    // transaction — instructions execute sequentially so the ATAs exist and are
    // funded before the swap runs.
    console.log('Step 4: Executing bonding curve buy...');

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

    const RENT_WSOL_ATA = 2_039_280n; // minimum lamports for a token account

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
      amount: BUY_AMOUNT_IN + RENT_WSOL_ATA,
    });

    const syncNativeIx = getSyncNativeInstruction({ account: userQuoteAta });

    const swapIx = initializer.createCurveSwapExactInInstruction(
      {
        config: initializerConfig,
        launch,
        launchAuthority,
        baseVault: baseVault.address,
        quoteVault: quoteVault.address,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
        baseMint: baseMint.address,
        quoteMint: WSOL_MINT,
        user: payer,
        sentinelProgram: initializer.CPMM_SENTINEL_PROGRAM_ID,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_ADDRESS,
      },
      {
        amountIn: BUY_AMOUNT_IN,
        minAmountOut: 1n, // accept any amount for the example; use preview.amountOut in prod
        direction: initializer.DIRECTION_BUY,
      },
    );

    {
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(payer, tx),
        (tx) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) =>
          appendTransactionMessageInstructions(
            [
              createBaseAtaIx,
              createQuoteAtaIx,
              transferSolIx,
              syncNativeIx,
              swapIx,
            ],
            tx,
          ),
      );

      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);

      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      });

      console.log(
        '  Curve buy confirmed:',
        getSignatureFromTransaction(signedTransaction),
      );
    }
    console.log('');

    // ── Step 5: Migrate launch to CPMM pool ─────────────────────────────────
    //
    // Anyone can call migrate_launch once quoteDeposited >= minRaiseQuote.
    // The migrator creates the canonical CPMM pool graph inline, then seeds
    // liquidity into it. The remaining accounts must match the hash committed
    // at launch creation.
    console.log('Step 5: Migrating launch to CPMM pool...');

    const migrateLaunchIxBase = initializer.createMigrateLaunchInstruction({
      config: initializerConfig,
      launch,
      launchAuthority,
      baseMint: baseMint.address,
      quoteMint: WSOL_MINT,
      baseVault: baseVault.address,
      quoteVault: quoteVault.address,
      migratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
      payer,
      baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
      quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      rent: SYSVAR_RENT_ADDRESS,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_ADDRESS,
    });

    const migrateLaunchIx = {
      ...migrateLaunchIxBase,
      accounts: [
        ...(migrateLaunchIxBase.accounts ?? []),
        { address: cpmmMigratorState, role: AccountRole.WRITABLE },
        { address: cpmmConfig, role: AccountRole.READONLY },
        { address: pool, role: AccountRole.WRITABLE },
        { address: poolAuthority, role: AccountRole.READONLY },
        { address: poolVault0, role: AccountRole.WRITABLE },
        { address: poolVault1, role: AccountRole.WRITABLE },
        { address: protocolPosition, role: AccountRole.WRITABLE },
        { address: launchLpPosition, role: AccountRole.WRITABLE },
        { address: cpmm.CPMM_PROGRAM_ID, role: AccountRole.READONLY }, // cpmm program
        { address: payerBaseAta, role: AccountRole.WRITABLE }, // admin_base_ata (unsold curve tokens)
        { address: payerBaseAta, role: AccountRole.WRITABLE }, // creator recipient ATA (CREATOR_SHARE → payer)
        { address: payerBaseAta, role: AccountRole.WRITABLE }, // team recipient ATA (TEAM_SHARE → payer)
      ],
    };

    {
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(payer, tx),
        (tx) =>
          setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions([migrateLaunchIx], tx),
      );

      const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);

      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      });

      console.log(
        '  Migration confirmed:',
        getSignatureFromTransaction(signedTransaction),
      );
    }
    console.log('');

    // ── Step 6: Verify final launch state ────────────────────────────────────
    console.log('Step 6: Verifying final launch phase...');
    const finalLaunch = await initializer.fetchLaunch(rpc, launch, {
      commitment: 'confirmed',
    });

    if (!finalLaunch) {
      throw new Error('Launch account not found after migration');
    }

    console.log(`  Final phase: ${initializer.phaseLabel(finalLaunch.phase)}`);
    console.log(`  Quote deposited: ${finalLaunch.quoteDeposited} lamports`);
    console.log('');

    if (finalLaunch.phase === initializer.PHASE_MIGRATED) {
      // ── Step 7: Read migrator state ────────────────────────────────────────
      console.log('Step 7: Reading CPMM migrator state...');
      const migratorState = await cpmmMigrator.fetchCpmmMigratorState(
        rpc,
        cpmmMigratorState,
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
        WSOL_MINT,
        { commitment: 'confirmed' },
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
        console.log('  Spot price0:  ', price0.toFixed(8), '(base/WSOL)');
        console.log('  Spot price1:  ', price1.toFixed(8), '(WSOL/base)');
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
