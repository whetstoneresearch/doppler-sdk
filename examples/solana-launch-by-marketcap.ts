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

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
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
  // 1B total supply: 75% bonding curve, 20% recipients at graduation, 5% seeds CPMM pool.
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 200_000_000n * 10n ** BigInt(BASE_DECIMALS); // 20% to recipients
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS); //  5% seeds CPMM pool
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY; // 75%

  // Distribution split between creator (70%) and team (30%)
  const CREATOR_SHARE = (BASE_FOR_DISTRIBUTION * 70n) / 100n;
  const TEAM_SHARE = BASE_FOR_DISTRIBUTION - CREATOR_SHARE;

  const QUOTE_DECIMALS = 9; // SOL

  // ── Fetch live SOL price ────────────────────────────────────────────────────
  console.log('Fetching current SOL price from CoinGecko...');
  const solPriceUsd = await getSolPriceUsd();
  console.log(`Current SOL price: $${solPriceUsd.toLocaleString()}`);
  console.log('');

  // ── Validate market cap parameters ────────────────────────────────────────
  const { valid, warnings } = cpmm.validateMarketCapParameters(
    100_000,
    BASE_TOTAL_SUPPLY,
    BASE_DECIMALS,
  );
  if (!valid) {
    for (const w of warnings) console.warn('Warning:', w);
  }

  // ── Convert market cap range → XYK curve virtual reserves ─────────────────
  // start sets the opening spot price; graduation is triggered by minRaiseQuote.
  const { start } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: 100_000,
    endMarketCapUSD: 10_000_000,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: solPriceUsd,
  });

  console.log('Computed curve virtual reserves (opening price):');
  console.log('  curveVirtualBase: ', start.curveVirtualBase.toString());
  console.log('  curveVirtualQuote:', start.curveVirtualQuote.toString());
  console.log(
    `  Market cap range: $100,000 → $10,000,000 (at SOL = $${solPriceUsd.toLocaleString()})`,
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

  const [initializerConfig] = await initializer.getConfigAddress();
  const [cpmmConfig] = await cpmm.getConfigAddress();
  const [launch] = await initializer.getLaunchAddress(namespace, launchId);
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
  const [cpmmMigratorState] =
    await cpmmMigrator.getCpmmMigratorStateAddress(launch);

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

  // admin_base_ata receives unsold curve tokens at migration.
  // Both recipients use payer on devnet; swap for real wallets in production.
  const [payerBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  console.log('Derived addresses:');
  console.log('  Initializer config:', initializerConfig);
  console.log('  Launch:          ', launch);
  console.log('  Launch authority:', launchAuthority);
  console.log('  Base mint:       ', baseMint.address);
  console.log('');

  // ── Encode CPMM migrator calldata ──────────────────────────────────────────
  // migratorInitCalldata registers graduation params; migratorMigrateCalldata
  // is forwarded at migration. minRaiseQuote is the graduation threshold.
  const MIN_RAISE_SOL = 50;
  const minRaiseQuote = BigInt(MIN_RAISE_SOL) * 1_000_000_000n;

  const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
    cpmmConfig: cpmmConfig,
    initialSwapFeeBps: 100, // 1% swap fee on the graduated CPMM pool
    initialFeeSplitBps: 8000, // 80% of CPMM fees distributed to LP holders
    recipients: [
      { wallet: payer.address, amount: CREATOR_SHARE },
      { wallet: payer.address, amount: TEAM_SHARE }, // use payer as team wallet on devnet
    ],
    minRaiseQuote,
    minMigrationPriceQ64Opt: null, // no minimum graduation price floor
  });

  const migratorMigrateCalldata = cpmmMigrator.encodeMigrateCalldata({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  });

  // ── Build the initializeLaunch instruction ─────────────────────────────────
  // addressLookupTable compresses the 7 constant accounts (tokenProgram,
  // systemProgram, rent, migratorProgram, quoteMint, metadataProgram, config)
  // to 1-byte ALT indices, keeping the transaction within the 1232-byte limit
  // even with V4 on-chain metadata.
  //
  // The cpmmMigratorState account is forwarded as a remaining account so the
  // register_launch CPI can write the launch's graduation parameters.
  console.log('Building launch instruction...');
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
      // Opening price: virtualQuote / (baseForCurve + virtualBase)
      curveVirtualBase: start.curveVirtualBase,
      curveVirtualQuote: start.curveVirtualQuote,
      curveFeeBps: 200, // 2% swap fee during the bonding curve phase
      curveKind: initializer.CURVE_KIND_XYK,
      curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
      allowBuy: true,
      allowSell: true,
      sentinelProgram: initializer.CPMM_SENTINEL_PROGRAM_ID,
      sentinelFlags: initializer.SF_BEFORE_SWAP | initializer.SF_AFTER_SWAP,
      sentinelCalldata: new Uint8Array(),
      migratorInitCalldata,
      migratorMigrateCalldata,
      sentinelRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
      // Commits the accounts that must be passed as remaining accounts to
      // migrate_launch in this order: state, cpmm_config, pool, pool_authority,
      // pool_vault0, pool_vault1, protocol_position, launch_lp_position,
      // cpmm_program, admin_base_ata, creator_ata, team_ata
      migratorRemainingAccountsHash: initializer.computeRemainingAccountsHash([
        cpmmMigratorState,
        cpmmConfig,
        pool,
        poolAuthority,
        poolVault0.address,
        poolVault1.address,
        protocolPosition,
        launchLpPosition,
        cpmm.CPMM_PROGRAM_ID,
        payerBaseAta, // admin_base_ata (unsold curve tokens)
        payerBaseAta, // creator recipient ATA (CREATOR_SHARE → payer)
        payerBaseAta, // team recipient ATA (TEAM_SHARE → payer)
      ]),
      metadataName: 'TEST',
      metadataSymbol: 'TEST',
      metadataUri: 'https://example.com/sample.json',
    },
  );

  // ── Build, sign, and send ──────────────────────────────────────────────────
  console.log('Creating XYK token launch...');
  try {
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

    // ── Fetch and verify launch state ──────────────────────────────────────
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
      console.log(`  Graduation at:       ${MIN_RAISE_SOL} SOL raised`);

      if (launchAccount.phase === initializer.PHASE_MIGRATED) {
        console.log('');
        console.log('Launch has graduated — CPMM pool is live.');
      } else {
        console.log('');
        console.log(
          'Launch is active. Will graduate once',
          MIN_RAISE_SOL,
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
