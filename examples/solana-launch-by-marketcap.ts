/**
 * Example: Create an XYK Token Launch using Market Cap Range (Solana)
 *
 * Demonstrates:
 * - Fetching a live SOL price and converting a market cap range to XYK virtual reserves
 * - Building and sending an initializeLaunch transaction
 * - Verifying the resulting launch account state
 */
import './env.js'

import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  type Address,
} from '@solana/kit'

import {
  initializer,
  cpmmMigrator,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  marketCapToCurveParams,
  validateMarketCapParameters,
  ACCOUNT_ROLE_WRITABLE,
} from '../src/solana/index.js'

// ============================================================================
// Environment
// ============================================================================

const keypairJson = process.env.SOLANA_KEYPAIR
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const wsUrl = process.env.SOLANA_WS_URL ?? 'wss://api.devnet.solana.com'

if (!keypairJson) {
  throw new Error('SOLANA_KEYPAIR must be set (JSON array of 64 bytes, e.g. from `solana-keygen new --outfile key.json`)')
}

const SYSVAR_RENT: Address = address('SysvarRent111111111111111111111111111111111')

// WSOL mint — pools use the wrapped SPL mint since native SOL can't live in token vaults.
const WSOL_MINT: Address = address('So11111111111111111111111111111111111111112')

// CPMM AmmConfig address that the graduated pool will use (devnet)
const CPMM_CONFIG: Address = address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL')

// ============================================================================
// Price feed
// ============================================================================

async function getSolPriceUsd(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
  )
  const data = await response.json()
  return data.solana.usd
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const payer = await createKeyPairSignerFromBytes(
    new Uint8Array(JSON.parse(keypairJson as string))
  )

  const rpc = createSolanaRpc(rpcUrl)
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl)
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })

  // ── Token supply parameters ────────────────────────────────────────────────
  // 1B total supply: 900M for the bonding curve, 100M for creator at graduation.
  const BASE_DECIMALS = 6
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS)
  const BASE_FOR_DISTRIBUTION = 100_000_000n * 10n ** BigInt(BASE_DECIMALS)
  const BASE_FOR_LIQUIDITY = 0n
  const BASE_FOR_CURVE = BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY

  const QUOTE_DECIMALS = 9 // SOL

  // ── Fetch live SOL price ────────────────────────────────────────────────────
  console.log('Fetching current SOL price from CoinGecko...')
  const solPriceUsd = await getSolPriceUsd()
  console.log(`Current SOL price: $${solPriceUsd.toLocaleString()}`)
  console.log('')

  // ── Validate market cap parameters ────────────────────────────────────────
  const { valid, warnings } = validateMarketCapParameters(
    100_000,
    BASE_TOTAL_SUPPLY,
    BASE_DECIMALS,
  )
  if (!valid) {
    for (const w of warnings) console.warn('Warning:', w)
  }

  // ── Convert market cap range → XYK curve virtual reserves ─────────────────
  // startParams sets the opening spot price; graduation is triggered by minRaiseQuote.
  const { start: startParams } = marketCapToCurveParams({
    startMarketCapUSD: 100_000,
    endMarketCapUSD: 10_000_000,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: solPriceUsd,
  })

  console.log('Computed curve virtual reserves (opening price):')
  console.log('  curveVirtualBase: ', startParams.curveVirtualBase.toString())
  console.log('  curveVirtualQuote:', startParams.curveVirtualQuote.toString())
  console.log(`  Market cap range: $100,000 → $10,000,000 (at SOL = $${solPriceUsd.toLocaleString()})`)
  console.log('')

  // ── Generate new keypairs for base token accounts ──────────────────────────
  const baseMint   = await generateKeyPairSigner()
  const baseVault  = await generateKeyPairSigner()
  const quoteVault = await generateKeyPairSigner()
  const metadataAccount = await initializer.getTokenMetadataAddress(baseMint.address)

  // ── Derive PDAs ─────────────────────────────────────────────────────────────
  // Date.now() as launchId ensures each run creates a distinct launch.
  const namespace = payer.address
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()))

  const [config] = await initializer.getConfigAddress()
  const [launch] = await initializer.getLaunchAddress(namespace, launchId)
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch)
  const [cpmmMigratorState] = await cpmmMigrator.getCpmmMigratorStateAddress(launch)

  console.log('Derived addresses:')
  console.log('  Config:          ', config)
  console.log('  Launch:          ', launch)
  console.log('  Launch authority:', launchAuthority)
  console.log('  Base mint:       ', baseMint.address)
  console.log('')

  // ── Encode CPMM migrator calldata ──────────────────────────────────────────
  // migratorInitCalldata registers graduation params; migratorMigrateCalldata
  // is forwarded at migration. minRaiseQuote is the graduation threshold.
  const MIN_RAISE_SOL = 50
  const minRaiseQuote = BigInt(MIN_RAISE_SOL) * 1_000_000_000n

  const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
    cpmmConfig: CPMM_CONFIG,
    initialSwapFeeBps: 30,    // 0.3% fee on the graduated CPMM pool
    initialFeeSplitBps: 5000, // 50% of fees distributed to LP holders
    recipients: [
      { wallet: payer.address, amount: BASE_FOR_DISTRIBUTION },
    ],
    minRaiseQuote,
    minMigrationPriceQ64Opt: null, // no minimum graduation price floor
  })

  const migratorMigrateCalldata = cpmmMigrator.encodeMigrateCalldata({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  })

  // ── Build the initializeLaunch instruction ─────────────────────────────────
  // addressLookupTable compresses the 7 constant accounts (tokenProgram,
  // systemProgram, rent, migratorProgram, quoteMint, metadataProgram, config)
  // to 1-byte ALT indices, keeping the transaction within the 1232-byte limit
  // even with V4 on-chain metadata.
  //
  // The cpmmMigratorState account is forwarded as a remaining account so the
  // register_launch CPI can write the launch's graduation parameters.
  console.log('Building launch instruction...')
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
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SYSTEM_PROGRAM_ID,
      rent: SYSVAR_RENT,
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
      curveVirtualBase: startParams.curveVirtualBase,
      curveVirtualQuote: startParams.curveVirtualQuote,
      curveFeeBps: 100, // 1% swap fee during the bonding curve phase
      curveKind: initializer.CURVE_KIND_XYK,
      curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
      allowBuy: 1,
      allowSell: 1,
      sentinelProgram: SYSTEM_PROGRAM_ID, // no sentinel hook
      sentinelFlags: 0,
      sentinelCalldata: new Uint8Array(),
      migratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
      migratorInitCalldata,
      migratorMigrateCalldata,
      sentinelRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
      migratorRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
      metadataName: 'TEST',
      metadataSymbol: 'TEST',
      metadataUri: 'https://example.com/sample.json',
    },
  )

  // Append cpmmMigratorState as remaining account for the register_launch CPI.
  const ix = {
    ...ixBase,
    accounts: [
      ...(ixBase.accounts ?? []),
      { address: cpmmMigratorState, role: ACCOUNT_ROLE_WRITABLE },
    ],
  }

  // ── Build, sign, and send ──────────────────────────────────────────────────
  console.log('Creating XYK token launch...')
  try {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

    const txMessage = pipe(
      createTransactionMessage({ version: 0 }),
      msg => setTransactionMessageFeePayer(payer.address, msg),
      msg => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
      msg => appendTransactionMessageInstructions([ix], msg),
    )

    const signedTx = await signTransactionMessageWithSigners(txMessage)
    const signature = getSignatureFromTransaction(signedTx)

    await sendAndConfirm(signedTx, { commitment: 'confirmed' })

    console.log('')
    console.log('Token launch created successfully!')
    console.log('  Launch address:', launch)
    console.log('  Base mint:     ', baseMint.address)
    console.log('  Transaction:   ', signature)

    // ── Fetch and verify launch state ──────────────────────────────────────
    const launchAccount = await initializer.fetchLaunch(rpc, launch)
    if (launchAccount) {
      const phaseLabel =
        launchAccount.phase === initializer.PHASE_TRADING   ? 'TRADING' :
        launchAccount.phase === initializer.PHASE_MIGRATED  ? 'MIGRATED' :
        launchAccount.phase === initializer.PHASE_ABORTED   ? 'ABORTED' :
        String(launchAccount.phase)

      console.log('')
      console.log('Launch account verified:')
      console.log('  Phase:              ', phaseLabel)
      console.log('  Base mint:          ', launchAccount.baseMint)
      console.log('  Base total supply:  ', launchAccount.baseTotalSupply.toString())
      console.log('  Curve virtual base: ', launchAccount.curveVirtualBase.toString())
      console.log('  Curve virtual quote:', launchAccount.curveVirtualQuote.toString())
      console.log('  Quote deposited:    ', launchAccount.quoteDeposited.toString(), 'lamports')
      console.log(`  Graduation at:       ${MIN_RAISE_SOL} SOL raised`)

      if (launchAccount.phase === initializer.PHASE_MIGRATED) {
        console.log('')
        console.log('Launch has graduated — CPMM pool is live.')
      } else {
        console.log('')
        console.log('Launch is active. Will graduate once', MIN_RAISE_SOL, 'SOL is raised.')
      }
    }
  } catch (error) {
    console.error('Error creating launch:', error)
    process.exit(1)
  }
}

main()
