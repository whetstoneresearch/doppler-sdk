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
 *   • curveFeeBps        — swap fee during the bonding curve phase
 *   • initialSwapFeeBps  — swap fee on the graduated CPMM pool
 *   • initialFeeSplitBps — fraction of CPMM fees distributed to LP holders
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
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
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
  const CURVE_FEE_BPS = 200; // 2% swap fee on the bonding curve — stays in the quote vault, compounding into the curve
  const CPMM_SWAP_FEE_BPS = 100; // 1% swap fee on the graduated CPMM pool
  const CPMM_SWAP_FEE_SPLIT_BPS = 8000; // 80% of CPMM swap fees claimable by LP holders; remaining 20% compounds into the pool

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
  // Pool vault keypairs must be generated here so their addresses can be
  // committed in migratorRemainingAccountsHash. Save these keypairs — they
  // must be passed as signers in the migrate_launch transaction.
  // The CPMM program initializes vault0 for token0 and vault1 for token1
  // during pool initialization; the keypairs themselves are arbitrary.
  const poolVault0 = await generateKeyPairSigner();
  const poolVault1 = await generateKeyPairSigner();

  const [pool] = await cpmm.getPoolAddress(baseMint.address, WSOL_MINT);
  const [poolAuthority] = await cpmm.getPoolAuthorityAddress(pool);
  const [protocolPosition] = await cpmm.getProtocolPositionAddress(pool);
  const [launchLpPosition] = await cpmm.getPositionAddress(
    pool,
    launchAuthority,
    0n,
  );

  // Both recipients use payer on devnet; swap for real wallets in production.
  const [payerBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // ── Encode migrator calldatas ────────────────────────────────────────────
  // migratorInitCalldata registers graduation params; migratorMigrateCalldata
  // is forwarded at migration. minRaiseQuote is the graduation threshold.
  const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
    cpmmConfig: cpmmConfig,
    initialSwapFeeBps: CPMM_SWAP_FEE_BPS,
    initialFeeSplitBps: CPMM_SWAP_FEE_SPLIT_BPS,
    recipients: [
      { wallet: payer.address, amount: CREATOR_SHARE },
      { wallet: payer.address, amount: TEAM_SHARE }, // use payer as team wallet for devnet
    ],
    minRaiseQuote,
    minMigrationPriceQ64Opt,
  });

  const migratorMigrateCalldata = cpmmMigrator.encodeMigrateCalldata({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  });

  // ── Build, sign, and send ────────────────────────────────────────────────
  console.log('Creating advanced XYK token launch...');
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
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        curveFeeBps: CURVE_FEE_BPS,
        curveKind: initializer.CURVE_KIND_XYK,
        curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
        allowBuy: true,
        allowSell: true,
        sentinelProgram: initializer.CPMM_SENTINEL_PROGRAM_ID,
        sentinelFlags: initializer.SF_BEFORE_SWAP | initializer.SF_AFTER_SWAP,
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
            poolVault0.address,
            poolVault1.address,
            protocolPosition,
            launchLpPosition,
            cpmm.CPMM_PROGRAM_ID,
            payerBaseAta, // admin_base_ata
            payerBaseAta, // creator recipient ATA (CREATOR_SHARE → payer)
            payerBaseAta, // team recipient ATA (TEAM_SHARE → payer)
          ],
        ),
        metadataName: 'Advanced Token',
        metadataSymbol: 'ADVTK',
        metadataUri: 'https://example.com/advanced-token.json',
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

    // ── Verify launch state ──────────────────────────────────────────────
    const launchAccount = await initializer.fetchLaunch(rpc, launch);
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
      console.log('  Curve fee:          ', launchAccount.curveFeeBps, 'bps');
    }
  } catch (error) {
    console.error('Error creating launch:', error);
    process.exit(1);
  }
}

main();
