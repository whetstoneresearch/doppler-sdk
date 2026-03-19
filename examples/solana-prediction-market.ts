/**
 * Example: Create a Prediction Market on Solana
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  trustedOracle  ─── holds the final resolution (who won?)              │ 
 * │       │                                                                 │
 * │  predictionMigrator ─── manages the market + entry/pot accounting      │
 * │       │                                                                 │
 * │  initializer (×2) ─── one XYK launch per outcome (YES / NO tokens)    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Lifecycle:
 *   1. Create a trusted oracle (authority + quote mint).
 *   2. For each outcome, call initializeLaunch with predictionMigrator as migratorProgram.
 *   3. Users trade outcome tokens on the bonding curve.
 *   4. Once minRaiseQuote is reached, migrateEntry burns unsold tokens and fills the pot.
 *   5. Oracle authority calls finalize(winningMint) to resolve the market.
 *   6. Winning token holders call claim() to receive their SOL share.
 */
import './env.js'

import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
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
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
} from '../src/solana/index.js'

import {
  predictionMigrator,
  trustedOracle,
} from '../src/solana/generated/index.js'

// ============================================================================
// Environment
// ============================================================================

const keypairJson = process.env.SOLANA_KEYPAIR
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const wsUrl = process.env.SOLANA_WS_URL ?? 'wss://api.devnet.solana.com'

if (!keypairJson) {
  throw new Error('SOLANA_KEYPAIR must be set (JSON array of 64 bytes)')
}

const SYSVAR_RENT: Address = address('SysvarRent111111111111111111111111111111111')

// WSOL mint — the quote token (SOL wrapped as SPL token so it can live in vaults).
const WSOL_MINT: Address = address('So11111111111111111111111111111111111111112')

// ============================================================================
// Helpers
// ============================================================================

/**
 * Derive the trustedOracle oracle state PDA.
 * Seeds: ["oracle_state", oracleAuthority, nonce_le_u64]
 */
async function getOracleStateAddress(
  oracleAuthority: Address,
  nonce: bigint,
): Promise<Address> {
  const nonceBytes = new Uint8Array(8)
  new DataView(nonceBytes.buffer).setBigUint64(0, nonce, true)

  const [oracleStateAddress] = await getProgramDerivedAddress({
    programAddress: trustedOracle.TRUSTED_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode('oracle')),
      getAddressEncoder().encode(oracleAuthority),
      nonceBytes,
    ],
  })
  return oracleStateAddress
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

  // ── Token supply parameters ─────────────────────────────────────────────
  //
  // Each outcome token ("YES" and "NO") has its own independent mint and
  // bonding curve.  The supply/curve parameters here are the same for both
  // to keep the example simple, but they could differ per outcome.
  const BASE_DECIMALS = 6
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS) // 1 B
  const BASE_FOR_DISTRIBUTION = 0n // no creator distribution for prediction tokens
  const BASE_FOR_LIQUIDITY = 0n
  const BASE_FOR_CURVE = BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY

  // Opening XYK price at ~50% implied probability (0.5 SOL per token at SOL=$150).
  // Adjust curveVirtualQuote to shift the opening probability.
  const CURVE_VIRTUAL_BASE = BASE_FOR_CURVE
  const CURVE_VIRTUAL_QUOTE = 500_000_000n // 0.5 SOL

  // Graduation threshold: launch migrates once this many lamports are raised.
  const MIN_RAISE_QUOTE = 10_000_000_000n // 10 SOL per entry

  const outcomes = [
    { label: 'YES' },
    { label: 'NO' },
  ]

  // ── Step 1: Create the trusted oracle ───────────────────────────────────
  //
  // The oracle is the on-chain record that will eventually be resolved with
  // the winning outcome mint.  Any wallet can be the oracleAuthority — in
  // production, use a multisig or a program-controlled authority.
  const oracleNonce = BigInt(Date.now())
  const oracleStateAddress = await getOracleStateAddress(payer.address, oracleNonce)

  // namespace must equal oracleStateAddress (validated by register_entry:
  // require_keys_eq!(launch.namespace, oracle.key()))
  const namespace = oracleStateAddress
  const [config] = await initializer.getConfigAddress()

  console.log('Creating trusted oracle...')
  console.log('  Oracle state:', oracleStateAddress)

  try {
    const initOracleIx = trustedOracle.getInitializeOracleInstruction({
      oracleAuthority: payer,
      oracleState: oracleStateAddress,
      nonce: oracleNonce,
      quoteMint: WSOL_MINT,
    })

    {
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()
      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        msg => setTransactionMessageFeePayer(payer.address, msg),
        msg => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
        msg => appendTransactionMessageInstructions([initOracleIx], msg),
      )
      const signedTx = await signTransactionMessageWithSigners(txMessage)
      await sendAndConfirm(signedTx, { commitment: 'confirmed' })
      console.log('  Oracle created:', getSignatureFromTransaction(signedTx))
    }

    // ── Step 2: Create per-outcome launches ───────────────────────────────
    for (const outcome of outcomes) {
      console.log('')
      console.log(`Creating ${outcome.label} outcome launch...`)

      // entryId: 32 bytes, padded UTF-8 label (or use a hash in production)
      const entryId = new Uint8Array(32)
      entryId.set(new TextEncoder().encode(outcome.label).slice(0, 32))

      // launchId must equal entryId (validated by register_entry:
      // require!(launch.launch_id == args.entry_id))
      const launchId = entryId
      const [launch] = await initializer.getLaunchAddress(namespace, launchId)
      const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch)

      const baseMint = await generateKeyPairSigner()
      const baseVault = await generateKeyPairSigner()
      const quoteVault = await generateKeyPairSigner()
      const metadataAccount = await initializer.getTokenMetadataAddress(baseMint.address)

      // ── Derive remaining accounts for register_entry CPI ────────────────
      // Seeds sourced from programs/prediction_migrator/src/constants.rs
      const predProg = predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS

      const [market] = await getProgramDerivedAddress({
        programAddress: predProg,
        seeds: [new TextEncoder().encode('market'), getAddressEncoder().encode(oracleStateAddress)],
      })
      const [marketAuthority] = await getProgramDerivedAddress({
        programAddress: predProg,
        seeds: [new TextEncoder().encode('market_authority'), getAddressEncoder().encode(market)],
      })
      const [potVault] = await getProgramDerivedAddress({
        programAddress: predProg,
        seeds: [new TextEncoder().encode('pot_vault'), getAddressEncoder().encode(market)],
      })
      const [entryAddress] = await getProgramDerivedAddress({
        programAddress: predProg,
        seeds: [
          new TextEncoder().encode('entry'),
          getAddressEncoder().encode(oracleStateAddress),
          getBytesEncoder().encode(entryId),
        ],
      })
      const [entryByMint] = await getProgramDerivedAddress({
        programAddress: predProg,
        seeds: [
          new TextEncoder().encode('entry_by_mint'),
          getAddressEncoder().encode(oracleStateAddress),
          getAddressEncoder().encode(baseMint.address),
        ],
      })

      console.log('  Launch:           ', launch)
      console.log('  Launch authority: ', launchAuthority)
      console.log('  Base mint:        ', baseMint.address)
      console.log('  Entry PDA:        ', entryAddress)

      // ── Encode migrator calldatas ────────────────────────────────────────
      // Init calldata → registerEntry; migrate calldata → migrateEntry.
      const migratorInitCalldata = predictionMigrator
        .getRegisterEntryInstructionDataEncoder()
        .encode({ entryId })

      const migratorMigrateCalldata = predictionMigrator
        .getMigrateEntryInstructionDataEncoder()
        .encode({ entryId })

      // ── Build the initializeLaunch instruction ───────────────────────────
      // The ALT covers tokenProgram, systemProgram, rent, config, WSOL_MINT, and
      // the prediction migrator program (index 8), keeping the transaction within
      // the 1232-byte limit despite the 6 register_entry remaining accounts.
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
          migratorProgram: predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
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
          curveVirtualBase: CURVE_VIRTUAL_BASE,
          curveVirtualQuote: CURVE_VIRTUAL_QUOTE,
          curveFeeBps: 100, // 1% swap fee
          curveKind: initializer.CURVE_KIND_XYK,
          curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
          allowBuy: 1,
          allowSell: 1,
          sentinelProgram: SYSTEM_PROGRAM_ID, // no sentinel hook
          sentinelFlags: 0,
          sentinelCalldata: new Uint8Array(),
          migratorProgram: predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
          migratorInitCalldata,
          migratorMigrateCalldata,
          sentinelRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
          migratorRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
          metadataName: outcome.label,
          metadataSymbol: outcome.label,
          metadataUri: `https://example.com/prediction/${outcome.label.toLowerCase()}.json`,
        },
      )

      // Append register_entry remaining accounts:
      // [oracle, market, pot_vault, market_authority, entry, entry_by_mint]
      const ix = {
        ...ixBase,
        accounts: [
          ...(ixBase.accounts ?? []),
          { address: oracleStateAddress, role: ACCOUNT_ROLE_READONLY },
          { address: market,             role: ACCOUNT_ROLE_WRITABLE },
          { address: potVault,           role: ACCOUNT_ROLE_WRITABLE },
          { address: marketAuthority,    role: ACCOUNT_ROLE_READONLY },
          { address: entryAddress,       role: ACCOUNT_ROLE_WRITABLE },
          { address: entryByMint,        role: ACCOUNT_ROLE_WRITABLE },
        ],
      }

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()
      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        msg => setTransactionMessageFeePayer(payer.address, msg),
        msg => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
        msg => appendTransactionMessageInstructions([ix], msg),
      )
      const signedTx = await signTransactionMessageWithSigners(txMessage)
      await sendAndConfirm(signedTx, { commitment: 'confirmed' })

      console.log(`  ${outcome.label} launch created!`)
      console.log('  Transaction:', getSignatureFromTransaction(signedTx))

      // Verify launch state
      const launchAccount = await initializer.fetchLaunch(rpc, launch)
      if (launchAccount) {
        const phaseLabel =
          launchAccount.phase === initializer.PHASE_TRADING  ? 'TRADING'  :
          launchAccount.phase === initializer.PHASE_MIGRATED ? 'MIGRATED' :
          launchAccount.phase === initializer.PHASE_ABORTED  ? 'ABORTED'  :
          String(launchAccount.phase)

        console.log('  Phase:              ', phaseLabel)
        console.log('  Curve virtual base: ', launchAccount.curveVirtualBase.toString())
        console.log('  Curve virtual quote:', launchAccount.curveVirtualQuote.toString())
        console.log('  Migrates after:     ', MIN_RAISE_QUOTE.toString(), 'lamports')
      }
    }

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

    console.log('')
    console.log('Prediction market setup complete.')
    console.log('  Oracle:', oracleStateAddress)
    console.log('  Both YES and NO outcome launches are live in TRADING phase.')
    console.log('  Call trustedOracle.getFinalizeInstruction() to resolve after migration.')
  } catch (error) {
    console.error('Error creating prediction market:', error)
    process.exit(1)
  }
}

main()
