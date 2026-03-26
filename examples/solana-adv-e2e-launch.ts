/**
 * Example: Advanced E2E Launch — State Tracking Across Bonding Curve and Spot Market (Solana)
 *
 * Full lifecycle from launch creation to graduated CPMM pool:
 *
 *   1. Create XYK launch with CPMM migrator
 *   2. List all launches owned by this wallet (indexer-style enumeration)
 *   3. Preview a bonding curve buy without executing it
 *   4. Execute the buy on the bonding curve
 *   5. Poll launch phase until graduation (MIGRATED)
 *   6. Read migrator state to confirm recipients and CPMM config
 *   7. Discover the graduated CPMM pool and read spot price
 */
import './env.js';

import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
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
import {
  TOKEN_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import { cpmm, initializer, cpmmMigrator } from '../src/solana/index.js';

// ============================================================================
// Environment
// ============================================================================

const keypairJson = process.env.SOLANA_KEYPAIR;
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const wsUrl = process.env.SOLANA_WS_URL ?? 'wss://api.devnet.solana.com';

if (!keypairJson) {
  throw new Error('SOLANA_KEYPAIR must be set (JSON array of 64 bytes)');
}

const WSOL_MINT: Address =
  'So11111111111111111111111111111111111111112' as Address;
const CPMM_CONFIG: Address = address(
  'HERFT6LYhVjCBW4M8BGYgs3KHMMj9Z2TMNu479Jjjm8o',
);

// ============================================================================
// Helpers
// ============================================================================

/** Derive the ATA address for a wallet + mint. */
async function getAtaAddress(wallet: Address, mint: Address): Promise<Address> {
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [
      getAddressEncoder().encode(wallet),
      getAddressEncoder().encode(TOKEN_PROGRAM_ADDRESS),
      getAddressEncoder().encode(mint),
    ],
  });
  return ata;
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
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  // ── Token supply ─────────────────────────────────────────────────────────
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 100_000_000n * 10n ** BigInt(BASE_DECIMALS); // 10% to creator
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS); //  5% seeds CPMM pool
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY;

  const QUOTE_DECIMALS = 9; // WSOL

  // ── Market cap → virtual reserves ────────────────────────────────────────
  console.log('Fetching current SOL price from CoinGecko...');
  const solPriceUsd: number = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
  )
    .then((r) => r.json())
    .then((d: { solana: { usd: number } }) => d.solana.usd);
  console.log(`SOL price: $${solPriceUsd.toLocaleString()}`);
  console.log('');

  const { start: startParams } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: 100_000,
    endMarketCapUSD: 10_000_000,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: solPriceUsd,
  });

  const minRaiseQuote = 100_000_000n; // 0.1 SOL graduation threshold for devnet testing

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

  const [config] = await initializer.getConfigAddress();
  const [launch] = await initializer.getLaunchAddress(namespace, launchId);
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
  const [cpmmMigratorState] =
    await cpmmMigrator.getCpmmMigratorStateAddress(launch);

  // ── CPMM migration remaining accounts ────────────────────────────────────
  // Pool vault keypairs must be generated here so their addresses can be
  // committed in migratorRemainingAccountsHash. Save these keypairs — they
  // must be passed as signers in the migrate_launch transaction.
  void cpmm.sortMints(baseMint.address, WSOL_MINT); // establish canonical token0/1
  const poolVault0 = await generateKeyPairSigner(); // vault for canonical token0
  const poolVault1 = await generateKeyPairSigner(); // vault for canonical token1

  const [pool] = await cpmm.getPoolAddress(baseMint.address, WSOL_MINT);
  const [poolAuthority] = await cpmm.getPoolAuthorityAddress(pool);
  const [protocolPosition] = await cpmm.getProtocolPositionAddress(pool);
  const [launchLpPosition] = await cpmm.getPositionAddress(
    pool,
    launchAuthority,
    0n,
  );

  const payerBaseAta = await getAtaAddress(payer.address, baseMint.address);

  const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
    cpmmConfig: CPMM_CONFIG,
    initialSwapFeeBps: 30,
    initialFeeSplitBps: 5000,
    recipients: [{ wallet: payer.address, amount: BASE_FOR_DISTRIBUTION }],
    minRaiseQuote,
    minMigrationPriceQ64Opt: null,
  });

  const migratorMigrateCalldata = cpmmMigrator.encodeMigrateCalldata({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  });

  try {
    const ixBase = initializer.createInitializeLaunchInstruction(
      {
        config,
        launch,
        launchAuthority,
        baseMint,
        quoteMint: WSOL_MINT,
        baseVault,
        quoteVault,
        payer,
        authority: payer,
        migratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        rent: SYSVAR_RENT_ADDRESS,
        metadataAccount,
        addressLookupTable: initializer.DOPPLER_DEVNET_ALT,
      },
      {
        namespace,
        launchId,
        baseDecimals: BASE_DECIMALS,
        baseTotalSupply: BASE_TOTAL_SUPPLY,
        baseForDistribution: BASE_FOR_DISTRIBUTION,
        baseForLiquidity: BASE_FOR_LIQUIDITY,
        curveVirtualBase: startParams.curveVirtualBase,
        curveVirtualQuote: startParams.curveVirtualQuote,
        curveFeeBps: 100,
        curveKind: initializer.CURVE_KIND_XYK,
        curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
        allowBuy: 1,
        allowSell: 1,
        sentinelProgram: SYSTEM_PROGRAM_ADDRESS,
        sentinelFlags: 0,
        sentinelCalldata: new Uint8Array(),
        migratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
        migratorInitCalldata,
        migratorMigrateCalldata,
        sentinelRemainingAccountsHash:
          initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
        // Commits the accounts that must be passed as remaining accounts to
        // migrate_launch: state, cpmm_config, pool, pool_authority, pool_vault0,
        // pool_vault1, protocol_position, launch_lp_position, cpmm_program,
        // admin_base_ata, recipient_ata_0
        migratorRemainingAccountsHash: initializer.computeRemainingAccountsHash(
          [
            cpmmMigratorState,
            CPMM_CONFIG,
            pool,
            poolAuthority,
            poolVault0.address,
            poolVault1.address,
            protocolPosition,
            launchLpPosition,
            cpmm.CPMM_PROGRAM_ID,
            payerBaseAta, // admin_base_ata
            payerBaseAta, // recipient ATA (BASE_FOR_DISTRIBUTION → payer)
          ],
        ),
        metadataName: 'E2E Token',
        metadataSymbol: 'E2ETK',
        metadataUri: 'https://example.com/e2e-token.json',
      },
    );

    // Append cpmmMigratorState as remaining account for the register_launch CPI.
    const ix = {
      ...ixBase,
      accounts: [
        ...(ixBase.accounts ?? []),
        { address: cpmmMigratorState, role: AccountRole.WRITABLE },
      ],
    };

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    const txMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (msg) => setTransactionMessageFeePayerSigner(payer, msg),
      (msg) =>
        setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
      (msg) => appendTransactionMessageInstructions([ix], msg),
    );
    const signedTx = await signTransactionMessageWithSigners(txMessage);
    await sendAndConfirm(signedTx, { commitment: 'confirmed' });

    console.log('  Launch:', launch);
    console.log('  Base mint:', baseMint.address);
    console.log('  Transaction:', getSignatureFromTransaction(signedTx));
    console.log('');

    // ── Step 2: Enumerate launches by this wallet (indexer-style) ───────────
    console.log('Step 2: Listing launches owned by this wallet...');
    const ownedLaunches = await initializer.fetchLaunchesByAuthority(
      rpc,
      payer.address,
    );
    console.log(`  Found ${ownedLaunches.length} launch(es)`);
    for (const { address: addr, account } of ownedLaunches) {
      const phaseLabel =
        account.phase === initializer.PHASE_TRADING
          ? 'TRADING'
          : account.phase === initializer.PHASE_MIGRATED
            ? 'MIGRATED'
            : account.phase === initializer.PHASE_ABORTED
              ? 'ABORTED'
              : String(account.phase);
      console.log(
        `  ${addr}  phase=${phaseLabel}  quoteDeposited=${account.quoteDeposited}`,
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
    const previewTxMsg = pipe(
      createTransactionMessage({ version: 0 }),
      (msg) => setTransactionMessageFeePayerSigner(payer, msg),
      (msg) =>
        setTransactionMessageLifetimeUsingBlockhash(previewBlockhash, msg),
      (msg) => appendTransactionMessageInstructions([previewIx], msg),
    );
    const signedPreviewTx =
      await signTransactionMessageWithSigners(previewTxMsg);
    const { value: simulateResult } = await rpc
      .simulateTransaction(getBase64EncodedWireTransaction(signedPreviewTx), {
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
        'lamports (0.01 SOL)',
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
    console.log('Step 4: Executing bonding curve buy...');

    const userBaseAta = await getAtaAddress(payer.address, baseMint.address);
    const userQuoteAta = await getAtaAddress(payer.address, WSOL_MINT);

    // Create base ATA (receives bought tokens) and WSOL ATA (pays for swap).
    // CreateIdempotent (byte 1) is safe to call even if the ATA already exists.
    const RENT_WSOL_ATA = 2_039_280n; // minimum lamports for a token account
    const createBaseAtaIx = {
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      accounts: [
        { address: payer.address, role: AccountRole.WRITABLE_SIGNER },
        { address: userBaseAta, role: AccountRole.WRITABLE },
        { address: payer.address, role: AccountRole.READONLY },
        { address: baseMint.address, role: AccountRole.READONLY },
        { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ],
      data: new Uint8Array([1]), // CreateIdempotent
    };
    const createQuoteAtaIx = {
      programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      accounts: [
        { address: payer.address, role: AccountRole.WRITABLE_SIGNER },
        { address: userQuoteAta, role: AccountRole.WRITABLE },
        { address: payer.address, role: AccountRole.READONLY },
        { address: WSOL_MINT, role: AccountRole.READONLY },
        { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ],
      data: new Uint8Array([1]), // CreateIdempotent
    };
    // SystemProgram::transfer — deposit SOL into WSOL ATA so SyncNative can update balance
    const transferData = new Uint8Array(12);
    new DataView(transferData.buffer).setUint32(0, 2, true); // instruction index 2 = transfer
    new DataView(transferData.buffer).setBigUint64(
      4,
      BUY_AMOUNT_IN + RENT_WSOL_ATA,
      true,
    );
    const transferSolIx = {
      programAddress: SYSTEM_PROGRAM_ADDRESS,
      accounts: [
        { address: payer.address, role: AccountRole.WRITABLE_SIGNER },
        { address: userQuoteAta, role: AccountRole.WRITABLE },
      ],
      data: transferData,
    };
    // Token::SyncNative — sync lamport balance to WSOL token account balance
    const syncNativeIx = {
      programAddress: TOKEN_PROGRAM_ADDRESS,
      accounts: [{ address: userQuoteAta, role: AccountRole.WRITABLE }],
      data: new Uint8Array([17]), // SyncNative discriminant
    };

    {
      const { value: setupBlockhash } = await rpc.getLatestBlockhash().send();
      const setupTxMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (msg) => setTransactionMessageFeePayerSigner(payer, msg),
        (msg) =>
          setTransactionMessageLifetimeUsingBlockhash(setupBlockhash, msg),
        (msg) =>
          appendTransactionMessageInstructions(
            [createBaseAtaIx, createQuoteAtaIx, transferSolIx, syncNativeIx],
            msg,
          ),
      );
      const signedSetupTx =
        await signTransactionMessageWithSigners(setupTxMessage);
      await sendAndConfirm(signedSetupTx, { commitment: 'confirmed' });
      console.log('  ATAs ready:', getSignatureFromTransaction(signedSetupTx));
    }

    const minAmountOut = 1n; // accept any amount for the example; use preview.amountOut in prod

    const swapIx = initializer.createCurveSwapExactInInstruction(
      {
        config,
        launch,
        launchAuthority,
        baseVault: baseVault.address,
        quoteVault: quoteVault.address,
        userBaseAccount: userBaseAta,
        userQuoteAccount: userQuoteAta,
        baseMint: baseMint.address,
        quoteMint: WSOL_MINT,
        user: payer,
      },
      {
        amountIn: BUY_AMOUNT_IN,
        minAmountOut,
        direction: initializer.DIRECTION_BUY,
      },
    );

    const { value: swapBlockhash } = await rpc.getLatestBlockhash().send();
    const swapTxMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (msg) => setTransactionMessageFeePayerSigner(payer, msg),
      (msg) => setTransactionMessageLifetimeUsingBlockhash(swapBlockhash, msg),
      (msg) => appendTransactionMessageInstructions([swapIx], msg),
    );
    const signedSwapTx = await signTransactionMessageWithSigners(swapTxMessage);
    await sendAndConfirm(signedSwapTx, { commitment: 'confirmed' });

    console.log(
      '  Curve buy confirmed:',
      getSignatureFromTransaction(signedSwapTx),
    );
    console.log('');

    // ── Step 5: Migrate launch to CPMM pool ──────────────────────────────────
    //
    // Anyone can call migrate_launch once quoteDeposited >= minRaiseQuote.
    // The remaining accounts must match the hash committed at launch creation.
    // Pool vault keypairs must sign because CPMM's initialize_pool requires it.
    console.log('Step 5: Migrating launch to CPMM pool...');

    const migrateLaunchIxBase = initializer.createMigrateLaunchInstruction({
      config,
      launch,
      launchAuthority,
      baseMint: baseMint.address,
      quoteMint: WSOL_MINT,
      baseVault: baseVault.address,
      quoteVault: quoteVault.address,
      migratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
      payer,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      rent: SYSVAR_RENT_ADDRESS,
    });

    const migrateLaunchIx = {
      ...migrateLaunchIxBase,
      accounts: [
        ...(migrateLaunchIxBase.accounts ?? []),
        { address: cpmmMigratorState, role: AccountRole.WRITABLE },
        { address: CPMM_CONFIG, role: AccountRole.READONLY },
        { address: pool, role: AccountRole.WRITABLE },
        { address: poolAuthority, role: AccountRole.READONLY },
        {
          address: poolVault0.address,
          role: AccountRole.WRITABLE_SIGNER,
          signer: poolVault0,
        },
        {
          address: poolVault1.address,
          role: AccountRole.WRITABLE_SIGNER,
          signer: poolVault1,
        },
        { address: protocolPosition, role: AccountRole.WRITABLE },
        { address: launchLpPosition, role: AccountRole.WRITABLE },
        { address: cpmm.CPMM_PROGRAM_ID, role: AccountRole.READONLY }, // cpmm program
        { address: payerBaseAta, role: AccountRole.WRITABLE }, // admin_base_ata (unsold curve tokens)
        { address: payerBaseAta, role: AccountRole.WRITABLE }, // recipient ATA (BASE_FOR_DISTRIBUTION)
      ],
    };

    const { value: migrateBlockhash } = await rpc.getLatestBlockhash().send();
    const migrateTxMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (msg) => setTransactionMessageFeePayerSigner(payer, msg),
      (msg) =>
        setTransactionMessageLifetimeUsingBlockhash(migrateBlockhash, msg),
      (msg) => appendTransactionMessageInstructions([migrateLaunchIx], msg),
    );
    const signedMigrateTx =
      await signTransactionMessageWithSigners(migrateTxMessage);
    await sendAndConfirm(signedMigrateTx, { commitment: 'confirmed' });

    console.log(
      '  Migration confirmed:',
      getSignatureFromTransaction(signedMigrateTx),
    );
    console.log('');

    // ── Step 6: Verify final launch state ────────────────────────────────────
    console.log('Step 6: Verifying final launch phase...');
    const finalLaunch = await initializer.fetchLaunch(rpc, launch, {
      commitment: 'confirmed',
    });

    if (!finalLaunch) {
      throw new Error('Launch account not found after migration');
    }

    const finalPhase =
      finalLaunch.phase === initializer.PHASE_TRADING
        ? 'TRADING'
        : finalLaunch.phase === initializer.PHASE_MIGRATED
          ? 'MIGRATED'
          : finalLaunch.phase === initializer.PHASE_ABORTED
            ? 'ABORTED'
            : String(finalLaunch.phase);

    console.log(`  Final phase: ${finalPhase}`);
    console.log(`  Quote deposited: ${finalLaunch.quoteDeposited} lamports`);
    console.log('');

    if (finalLaunch.phase === initializer.PHASE_MIGRATED) {
      // ── Step 7: Read migrator state ────────────────────────────────────────
      console.log('Step 7: Reading CPMM migrator state...');
      const [migratorStateAddress] =
        await cpmmMigrator.getCpmmMigratorStateAddress(launch);
      const migratorState = await cpmmMigrator.fetchCpmmMigratorState(
        rpc,
        migratorStateAddress,
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
