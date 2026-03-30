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
  throw new Error(
    'SOLANA_KEYPAIR must be set (JSON array of 64 bytes, e.g. from `solana-keygen new --outfile key.json`)',
  );
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

  // ── Token supply parameters ────────────────────────────────────────────────
  // This example puts the entire supply on the bonding curve (no creator
  // distribution or CPMM liquidity allocation). See solana-adv-launch.ts for
  // an example with custom token allocations and fee configuration.
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);

  const QUOTE_DECIMALS = 9; // WSOL
  const START_MARKET_CAP_USD = 100_000;
  const END_MARKET_CAP_USD = 10_000_000;

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

  // admin_base_ata receives any unsold curve tokens at migration.
  const [payerBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  // ── Encode CPMM migrator calldata ──────────────────────────────────────────
  // migratorInitCalldata registers graduation params; migratorMigrateCalldata
  // is forwarded at migration. minRaiseQuote is the graduation threshold.
  const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
    cpmmConfig: cpmmConfig,
    initialSwapFeeBps: 100, // 1% swap fee on the graduated CPMM pool
    initialFeeSplitBps: 8000, // 80% of CPMM swap fees claimable by LP holders; remaining 20% compounds into the pool
    recipients: [],
    minRaiseQuote,
    minMigrationPriceQ64Opt: null, // no minimum graduation price floor
  });

  const migratorMigrateCalldata = cpmmMigrator.encodeMigrateCalldata({
    baseForDistribution: 0n,
    baseForLiquidity: 0n,
  });

  // ── Build, sign, and send ────────────────────────────────────────────────
  // addressLookupTable compresses the 7 constant accounts (tokenProgram,
  // systemProgram, rent, migratorProgram, quoteMint, metadataProgram, config)
  // to 1-byte ALT indices, keeping the transaction within the 1232-byte limit
  // even with V4 on-chain metadata.
  //
  // The cpmmMigratorState account is forwarded as a remaining account so the
  // register_launch CPI can write the launch's graduation parameters.
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
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
        // Opening price: virtualQuote / (baseForCurve + virtualBase)
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        curveFeeBps: 200, // 2% swap fee during the bonding curve phase — stays in the quote vault, compounding into the curve
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
        // migrate_launch in this order: state, cpmm_config, pool, pool_authority,
        // pool_vault0, pool_vault1, protocol_position, launch_lp_position,
        // cpmm_program, admin_base_ata
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
            payerBaseAta, // admin_base_ata (receives any unsold curve tokens)
          ],
        ),
        metadataName: 'TEST',
        metadataSymbol: 'TEST',
        metadataUri: 'https://example.com/sample.json',
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

    // ── Verify launch state ──────────────────────────────────────
    const launchAccount = await initializer.fetchLaunch(rpc, launch);
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
