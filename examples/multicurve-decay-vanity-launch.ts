/**
 * Example: Decay Multicurve Auction with Vanity "beef" Suffix
 *
 * This example demonstrates the full builder flow used by production apps:
 * - Standard token config
 * - Integrator address for fee attribution
 * - Market-cap curves with beneficiaries (fee streaming)
 * - Decay initializer (anti-sniping start fee that decays to a terminal fee)
 * - Multi-recipient vesting (1-year linear vest split between deployer & advisor)
 * - NoOp migration + governance (locked liquidity with beneficiary fee streams)
 * - CREATE2 salt mining for a vanity token address suffix ("beef")
 *
 * Notes:
 * - `noOp` migration requires beneficiaries (otherwise graduation reverts)
 * - `withDecay.startFee` must be >= the terminal fee from `withCurves.fee`
 * - Vesting amounts must total <= initialSupply − numTokensToSell (here 100M)
 * - DERC20 caps vesting at 20% of supply per address and 20% total
 * - The decay multicurve initializer must be whitelisted on the target chain
 *
 * Env:
 * - PRIVATE_KEY (required)
 * - RPC_URL (optional; defaults to Base Sepolia)
 * - VANITY_SUFFIX (optional; default "beef")
 * - MAX_ITERATIONS (optional; default 1_000_000)
 * - MAX_PREFLIGHT_ATTEMPTS (optional; default 10)
 * - DRY_RUN (optional; if "true", stops after preflight simulation)
 * - NUMERAIRE_PRICE_USD (optional; default 3000)
 */
import './env'

import { DopplerSDK, WAD, getAddresses, mineTokenAddress, airlockAbi } from '../src'
import {
  parseEther,
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY must be set')

function parseNumberEnv(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${name}; expected a positive finite number`)
  }
  return n
}

function parseBoolEnv(name: string, fallback = false): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase()
  if (!v) return fallback
  return v === '1' || v === 'true' || v === 'yes'
}

async function main() {
  const vanitySuffix = (process.env.VANITY_SUFFIX ?? 'beef').trim()
  const maxIterations = parseNumberEnv('MAX_ITERATIONS', 1_000_000)
  const maxPreflightAttempts = parseNumberEnv('MAX_PREFLIGHT_ATTEMPTS', 10)
  const dryRun = parseBoolEnv('DRY_RUN', false)
  const numerairePriceUsd = parseNumberEnv('NUMERAIRE_PRICE_USD', 3_000)

  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account,
  })

  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  })

  const addresses = getAddresses(baseSepolia.id)
  const airlockAddress = addresses.airlock as Address
  if (!airlockAddress) throw new Error('Airlock address not configured')

  // ── Build the auction params ──────────────────────────────────────────
  //
  // This mirrors the pattern used by production apps (e.g. Bankr):
  //   tokenConfig  → standard DERC20
  //   saleConfig   → 1B supply, 900M for sale
  //   withIntegrator → fee attribution address
  //   withCurves   → two market-cap tiers + beneficiaries for fee streaming
  //   withDecay    → 80% anti-sniping fee decaying over 2 minutes
  //   withVesting  → 1-year linear vest of non-sold tokens to deployer + advisor
  //   noOp migration + governance → locked liquidity, fees stream to beneficiaries

  const INITIAL_SUPPLY = 1_000_000_000n * WAD    // 1 billion tokens
  const NUM_TOKENS_TO_SELL = 900_000_000n * WAD   // 900 million for sale (90%)
  const FEE_BPS = 12_000                          // terminal fee: 1.2%
  const TICK_SPACING = 200

  const startTime = Math.floor(Date.now() / 1000) + 30 // 30 seconds from now

  // The airlock owner MUST be included as a beneficiary with at least 5% shares.
  // Without this the contract reverts with InvalidProtocolOwnerBeneficiary.
  const airlockBeneficiary = await sdk.getAirlockBeneficiary() // 5% (default)
  console.log('Airlock owner beneficiary:', airlockBeneficiary.beneficiary, `(${airlockBeneficiary.shares} shares)`)

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'standard',
      name: 'TEST',
      symbol: 'TEST',
      tokenURI: 'ipfs://vanity-decay-example.json',
    })
    .saleConfig({
      initialSupply: INITIAL_SUPPLY,
      numTokensToSell: NUM_TOKENS_TO_SELL,
      numeraire: addresses.weth,
    })
    .withIntegrator('0xF60633D02690e2A15A54AB919925F3d038Df163e')
    .withCurves({
      numerairePrice: numerairePriceUsd,
      fee: FEE_BPS,
      tickSpacing: TICK_SPACING,
      beneficiaries: [
        {
          beneficiary: account.address,        // deployer receives 95% of fee streams
          shares: parseEther('0.95'),
        },
        airlockBeneficiary,                    // protocol owner receives 5% (required)
      ],
      curves: [
        {
          marketCap: { start: 20_000, end: 1_200_000_000 },
          numPositions: 1,
          shares: parseEther('0.99'),
        },
        {
          marketCap: { start: 1_200_000_000, end: 'max' },
          numPositions: 1,
          shares: parseEther('0.01'),
        },
      ],
    })
    .withDecay({
      startTime,
      startFee: 800_000,       // 80% anti-sniping start fee
      durationSeconds: 120,    // decays to terminal fee over 2 minutes
    })
    .withVesting({
      duration: BigInt(365 * 24 * 60 * 60),  // 1-year linear vest
      recipients: [
        account.address,                                          // creator: 7%
        '0x0000000000000000000000000000000000000001' as Address,   // advisor:  3%
      ],
      amounts: [
        70_000_000n * WAD,   // 70M tokens to creator
        30_000_000n * WAD,   // 30M tokens to advisor
      ],
    })
    .withMigration({ type: 'noOp' })
    .withGovernance({ type: 'noOp' })
    .withUserAddress(account.address)
    .build()

  // ── Mine a vanity CREATE2 salt ────────────────────────────────────────

  console.log('Auction config:')
  console.log('  token:', `${params.token.name} (${params.token.symbol})`)
  console.log('  integrator:', params.integrator)
  console.log('  terminal fee:', FEE_BPS, `(${FEE_BPS / 10_000}%)`)
  console.log('  decay: 80% → terminal over 120s')
  console.log('  vesting: 100M tokens over 1 year (70M deployer + 30M advisor)')
  console.log('  migration: noOp (locked)')
  console.log('  governance: noOp')
  console.log('')

  console.log('Vanity mining config:')
  console.log('  suffix:', vanitySuffix)
  console.log('  maxIterations:', maxIterations)
  console.log('  maxPreflightAttempts:', maxPreflightAttempts)
  console.log('  dryRun:', dryRun)

  const hexChars = vanitySuffix.replace(/^0x/, '').length
  const expectedTries = 16 ** hexChars
  console.log('  expected tries (rough):', expectedTries.toLocaleString())
  console.log('')

  const createParams = sdk.factory.encodeCreateMulticurveParams(params)

  // Log the resolved module addresses so we can diagnose whitelisting issues
  console.log('Resolved modules (from createParams):')
  console.log('  airlock:', airlockAddress)
  console.log('  tokenFactory:', createParams.tokenFactory)
  console.log('  poolInitializer:', createParams.poolInitializer)
  console.log('  liquidityMigrator:', createParams.liquidityMigrator)
  console.log('  governanceFactory:', createParams.governanceFactory)
  console.log('  integrator:', createParams.integrator)
  console.log('  numeraire:', createParams.numeraire)
  console.log('  initialSupply:', createParams.initialSupply.toString())
  console.log('  numTokensToSell:', createParams.numTokensToSell.toString())
  console.log('')

  let mined: ReturnType<typeof mineTokenAddress> | undefined
  let vanityCreateParams: typeof createParams | undefined
  let currentStartSalt = 0n

  for (let attempt = 1; attempt <= maxPreflightAttempts; attempt++) {
    mined = mineTokenAddress({
      prefix: '',
      suffix: vanitySuffix,
      tokenFactory: createParams.tokenFactory,
      initialSupply: createParams.initialSupply,
      recipient: airlockAddress,
      owner: airlockAddress,
      tokenData: createParams.tokenFactoryData,
      maxIterations,
      startSalt: currentStartSalt,
    })

    vanityCreateParams = { ...createParams, salt: mined.salt }

    console.log(`Mined vanity salt (attempt ${attempt}/${maxPreflightAttempts}):`)
    console.log('  tokenAddress:', mined.tokenAddress)
    console.log('  salt:', mined.salt)
    console.log('  iterations:', mined.iterations)

    // Preflight: simulate the exact airlock.create() call with the vanity salt
    try {
      const sim = await publicClient.simulateContract({
        address: airlockAddress,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...vanityCreateParams }],
        account: account.address,
      })
      const simResult = sim.result as readonly unknown[] | undefined
      const simulatedTokenAddress = (simResult?.[0] as Address | undefined) ?? undefined
      if (!simulatedTokenAddress) {
        throw new Error('simulateContract returned no token address')
      }
      if (simulatedTokenAddress.toLowerCase() !== mined.tokenAddress.toLowerCase()) {
        throw new Error(
          `miner computed ${mined.tokenAddress} but simulation predicts ${simulatedTokenAddress}`,
        )
      }

      console.log('  preflight: OK (simulation matches mined address)')
      console.log('')
      break
    } catch (e: unknown) {
      console.log('  preflight: REVERTED')

      // Extract as much detail as possible from viem's error chain
      const err = e as Record<string, unknown>
      const shortMessage = err.shortMessage ?? err.message ?? String(e)
      console.log('  shortMessage:', String(shortMessage).split('\n')[0])

      // Viem wraps the inner cause which often has the revert reason / data
      const cause = err.cause as Record<string, unknown> | undefined
      if (cause) {
        if (cause.reason) console.log('  revert reason:', cause.reason)
        if (cause.data) console.log('  revert data:', cause.data)
        if (cause.shortMessage) console.log('  cause:', String(cause.shortMessage).split('\n')[0])
        // Sometimes there's a nested cause (e.g. RPC error)
        const innerCause = cause.cause as Record<string, unknown> | undefined
        if (innerCause) {
          if (innerCause.reason) console.log('  inner reason:', innerCause.reason)
          if (innerCause.data) console.log('  inner data:', innerCause.data)
          if (innerCause.shortMessage) console.log('  inner cause:', String(innerCause.shortMessage).split('\n')[0])
          if (innerCause.message) console.log('  inner message:', String(innerCause.message).split('\n')[0])
        }
      }

      // Log details field if present (often contains the raw RPC error)
      if (err.details) console.log('  details:', String(err.details).split('\n')[0])

      // On first revert, also dump the full error for maximum visibility
      if (attempt === 1) {
        console.log('  --- full error (first attempt only) ---')
        console.log(' ', String(err.message ?? e).slice(0, 500))
        console.log('  ---')
      }

      console.log('')

      currentStartSalt = BigInt(mined.salt) + 1n
      mined = undefined
      vanityCreateParams = undefined
    }
  }

  if (!mined || !vanityCreateParams) {
    throw new Error(
      `Preflight failed after ${maxPreflightAttempts} attempts. ` +
        'All simulations reverted — check the module addresses above and ensure they are whitelisted on the target chain. ' +
        'Try increasing MAX_PREFLIGHT_ATTEMPTS or MAX_ITERATIONS.',
    )
  }

  if (dryRun) {
    console.log('DRY_RUN enabled; stopping after preflight.')
    return
  }

  // ── Execute ───────────────────────────────────────────────────────────

  console.log('Creating decay multicurve pool with vanity salt...')
  const result = await sdk.factory.createMulticurve(params, {
    _createParams: vanityCreateParams,
  })

  console.log('')
  console.log('Decay multicurve created!')
  console.log('Token address:', result.tokenAddress)
  console.log('Pool ID:', result.poolId)
  console.log('Transaction:', result.transactionHash)

  // Verify the vanity suffix
  const deployedHex = result.tokenAddress.slice(2).toLowerCase()
  const normalizedSuffix = vanitySuffix.toLowerCase().replace(/^0x/, '')
  if (deployedHex.endsWith(normalizedSuffix)) {
    console.log(`Vanity suffix "${vanitySuffix}" confirmed!`)
  } else {
    console.warn(`WARNING: deployed token does not end with "${vanitySuffix}"`)
  }

  // Read back pool state
  const pool = await sdk.getMulticurvePool(result.tokenAddress)
  const state = await pool.getState()
  console.log('')
  console.log('Pool info:')
  console.log('  fee:', state.poolKey.fee)
  console.log('  tickSpacing:', state.poolKey.tickSpacing)
  console.log('  status:', state.status)

  const feeSchedule = await pool.getFeeSchedule()
  console.log('  feeSchedule:', feeSchedule)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
