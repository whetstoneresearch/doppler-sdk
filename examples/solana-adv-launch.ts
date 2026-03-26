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
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  address,
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

// WSOL mint — pools use the wrapped SPL mint since native SOL can't live in token vaults.
const WSOL_MINT: Address =
  'So11111111111111111111111111111111111111112' as Address;

// CPMM AmmConfig for the graduated pool (devnet)
const CPMM_CONFIG: Address = address(
  'HERFT6LYhVjCBW4M8BGYgs3KHMMj9Z2TMNu479Jjjm8o',
);

// Team/treasury wallet that receives a share of base tokens at graduation.
// Replace with a real multisig/treasury address in production.
// Must not be the default pubkey (11111...); using payer here for devnet testing.

// ============================================================================
// Helpers
// ============================================================================

async function getAtaAddress(wallet: Address, mint: Address): Promise<Address> {
  const enc = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [
      enc.encode(wallet),
      enc.encode(TOKEN_PROGRAM_ADDRESS),
      enc.encode(mint),
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

  // ── Token supply and allocation ─────────────────────────────────────────
  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 200_000_000n * 10n ** BigInt(BASE_DECIMALS); // 20% to recipients
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS); //  5% seeds CPMM pool
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY; // 75%

  const QUOTE_DECIMALS = 9; // WSOL

  // Distribution split between creator (70%) and team (30%)
  const CREATOR_SHARE = (BASE_FOR_DISTRIBUTION * 70n) / 100n;
  const TEAM_SHARE = BASE_FOR_DISTRIBUTION - CREATOR_SHARE;

  // ── Fee configuration ───────────────────────────────────────────────────
  const CURVE_FEE_BPS = 200; // 2% swap fee on the bonding curve
  const CPMM_SWAP_FEE_BPS = 100; // 1% swap fee on the graduated CPMM pool
  const CPMM_FEE_SPLIT_BPS = 8000; // 80% of CPMM fees distributed to LP holders

  // ── Graduation threshold and price floor ────────────────────────────────
  const MIN_RAISE_SOL = 50;
  const minRaiseQuote = BigInt(MIN_RAISE_SOL) * 1_000_000_000n;

  // Optional: refuse graduation if spot price (reserve1/reserve0 in raw units)
  // at migration time is below this Q64.64 value.
  // Example: require at least 0.001 WSOL per 1 base atom → numberToQ64(0.001).
  // Set to null to allow graduation at any price.
  const minMigrationPriceQ64Opt = null;

  // ── Live SOL price → curve virtual reserves ─────────────────────────────
  const solPriceUsd = await (async () => {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    );
    return ((await r.json()) as { solana: { usd: number } }).solana.usd;
  })();

  const { start: startParams } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: 100_000,
    endMarketCapUSD: 10_000_000,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: solPriceUsd,
  });

  console.log('Token allocation:');
  console.log('  Bonding curve:  ', BASE_FOR_CURVE.toString(), 'atoms (75%)');
  console.log(
    '  Distribution:   ',
    BASE_FOR_DISTRIBUTION.toString(),
    'atoms (20%)',
  );
  console.log('    Creator:      ', CREATOR_SHARE.toString());
  console.log('    Team:         ', TEAM_SHARE.toString());
  console.log(
    '  CPMM liquidity: ',
    BASE_FOR_LIQUIDITY.toString(),
    'atoms (5%)',
  );
  console.log('');
  console.log('Fee configuration:');
  console.log('  Curve fee:      ', CURVE_FEE_BPS, 'bps');
  console.log('  CPMM swap fee:  ', CPMM_SWAP_FEE_BPS, 'bps');
  console.log('  CPMM LP split:  ', CPMM_FEE_SPLIT_BPS, 'bps');
  console.log('');

  // ── Generate keypairs and derive PDAs ───────────────────────────────────
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

  // Both recipients use payer on devnet; swap for real wallets in production.
  const payerBaseAta = await getAtaAddress(payer.address, baseMint.address);

  console.log('Derived addresses:');
  console.log('  Config:          ', config);
  console.log('  Launch:          ', launch);
  console.log('  Launch authority:', launchAuthority);
  console.log('  Base mint:       ', baseMint.address);
  console.log('');

  // ── Encode migrator calldatas ────────────────────────────────────────────
  // migratorInitCalldata registers graduation params; migratorMigrateCalldata
  // is forwarded at migration. minRaiseQuote is the graduation threshold.
  const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
    cpmmConfig: CPMM_CONFIG,
    initialSwapFeeBps: CPMM_SWAP_FEE_BPS,
    initialFeeSplitBps: CPMM_FEE_SPLIT_BPS,
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
        curveFeeBps: CURVE_FEE_BPS,
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
        // admin_base_ata, creator_ata, team_ata
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
            payerBaseAta, // creator recipient ATA (CREATOR_SHARE → payer)
            payerBaseAta, // team recipient ATA (TEAM_SHARE → payer)
          ],
        ),
        metadataName: 'Advanced Token',
        metadataSymbol: 'ADVTK',
        metadataUri: 'https://example.com/advanced-token.json',
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
      (msg) => setTransactionMessageFeePayer(payer.address, msg),
      (msg) =>
        setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
      (msg) => appendTransactionMessageInstructions([ix], msg),
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);
    const signature = getSignatureFromTransaction(signedTx);

    await sendAndConfirm(signedTx, { commitment: 'confirmed' });

    console.log('');
    console.log('Launch created!');
    console.log('  Launch address:', launch);
    console.log('  Base mint:     ', baseMint.address);
    console.log('  Transaction:   ', signature);

    // ── Verify launch state ──────────────────────────────────────────────
    const launchAccount = await initializer.fetchLaunch(rpc, launch);
    if (launchAccount) {
      console.log('');
      console.log('Launch account verified:');
      console.log(
        '  Phase:              ',
        launchAccount.phase === initializer.PHASE_TRADING
          ? 'TRADING'
          : String(launchAccount.phase),
      );
      console.log('  Curve fee:          ', launchAccount.curveFeeBps, 'bps');
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
      console.log('  Graduates at:       ', MIN_RAISE_SOL, 'SOL raised');
    }
  } catch (error) {
    console.error('Error creating launch:', error);
    process.exit(1);
  }
}

main();
