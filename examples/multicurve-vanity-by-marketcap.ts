/**
 * Example: Create a Multicurve Pool (V4) with a Vanity Token Address Suffix
 *
 * This example demonstrates:
 * - Building a multicurve pool using USD market cap ranges (no tick math)
 * - Mining a CREATE2 salt so the token address ends with a chosen hex suffix
 * - Launching the multicurve pool using the mined salt (preserved via _createParams)
 *
 * Env:
 * - PRIVATE_KEY (required)
 * - RPC_URL (optional; defaults to Base Sepolia default)
 * - VANITY_SUFFIX (optional; default "beef", 1-4 hex chars recommended)
 * - VANITY_PREFIX (optional; default empty)
 * - MAX_ITERATIONS (optional; default 1_000_000)
 * - START_SALT (optional; default 0; useful to continue searching after a failure)
 * - MAX_PREFLIGHT_ATTEMPTS (optional; default 10; number of mine+simulate retries)
 * - DRY_RUN (optional; if set to "1"/"true", stops after preflight simulation)
 * - TOKEN_NAME (optional; default includes timestamp to avoid collisions)
 * - TOKEN_SYMBOL (optional; default "VNY")
 * - TOKEN_URI (optional; default example.com)
 */
import './env'

import { DopplerSDK, getAddresses, mineTokenAddress, airlockAbi } from '../src'
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

function parseBigIntEnv(name: string, fallback: bigint): bigint {
  const v = process.env[name]
  if (!v) return fallback
  try {
    return BigInt(v)
  } catch {
    throw new Error(`Invalid ${name}; expected a bigint-compatible string`)
  }
}

function parseBoolEnv(name: string, fallback = false): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase()
  if (!v) return fallback
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

function normalizeHexFragment(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, '')
}

function expectedIterations(prefix?: string, suffix?: string): number | null {
  const p = prefix ? normalizeHexFragment(prefix) : ''
  const s = suffix ? normalizeHexFragment(suffix) : ''
  const chars = (p ? p.length : 0) + (s ? s.length : 0)
  if (chars <= 0) return null
  const exp = 16 ** chars
  return Number.isFinite(exp) ? exp : null
}

/**
 * Fetch current ETH price in USD from CoinGecko
 */
async function getEthPriceUsd(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
  )
  const data = await response.json()
  return data.ethereum.usd
}

async function main() {
  const vanityPrefix = (process.env.VANITY_PREFIX ?? '').trim()
  const vanitySuffix = (process.env.VANITY_SUFFIX ?? 'beef').trim()
  const maxIterations = parseNumberEnv('MAX_ITERATIONS', 1_000_000)
  const startSalt = parseBigIntEnv('START_SALT', 0n)
  const maxPreflightAttempts = parseNumberEnv('MAX_PREFLIGHT_ATTEMPTS', 10)
  const dryRun = parseBoolEnv('DRY_RUN', false)

  const tokenName = (process.env.TOKEN_NAME ?? `VANITY_${Date.now()}`).trim()
  const tokenSymbol = (process.env.TOKEN_SYMBOL ?? 'VNY').trim()
  const tokenURI = (process.env.TOKEN_URI ?? 'https://example.com/sample.json').trim()

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
  const airlockAddress =
    (addresses.airlock as Address) ??
    (process.env.AIRLOCK as Address | undefined)
  if (!airlockAddress) throw new Error('Airlock address not configured')

  // Fetch current ETH price from CoinGecko
  console.log('Fetching current ETH price from CoinGecko...')
  const ethPriceUsd = await getEthPriceUsd()
  console.log(`Current ETH price: $${ethPriceUsd.toLocaleString()}`)
  console.log('')

  // Build multicurve using market cap ranges (same shape as multicurve-by-marketcap.ts)
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: tokenName,
      symbol: tokenSymbol,
      tokenURI: tokenURI,
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale (90%)
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    .withCurves({
      numerairePrice: ethPriceUsd,
      curves: [
        {
          marketCap: { start: 500_000, end: 1_500_000 },
          numPositions: 10,
          shares: parseEther('0.3'),
        },
        {
          marketCap: { start: 1_000_000, end: 5_000_000 },
          numPositions: 15,
          shares: parseEther('0.4'),
        },
        {
          marketCap: { start: 4_000_000, end: 6_000_000 },
          numPositions: 10,
          shares: parseEther('0.2'),
        },
        {
          marketCap: { start: 6_000_000, end: 'max' },
          numPositions: 1,
          shares: parseEther('0.1'),
        },
      ],
    })
    .withVesting({
      duration: BigInt(365 * 24 * 60 * 60),
      cliffDuration: 0,
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build()

  console.log('Vanity mining config:')
  console.log('  prefix:', vanityPrefix || '(none)')
  console.log('  suffix:', vanitySuffix)
  console.log('  maxIterations:', maxIterations)
  console.log('  startSalt:', startSalt.toString())
  console.log('  maxPreflightAttempts:', maxPreflightAttempts)
  console.log('  dryRun:', dryRun)
  console.log('  tokenName:', tokenName)
  console.log('  tokenSymbol:', tokenSymbol)

  const expected = expectedIterations(
    vanityPrefix || undefined,
    vanitySuffix || undefined,
  )
  if (expected !== null) {
    console.log('  expected tries (rough):', Math.round(expected).toLocaleString())
    if (maxIterations < expected) {
      console.log('')
      console.log(
        `[NOTE] This prefix+suffix combo is likely to fail with MAX_ITERATIONS=${maxIterations}.`,
      )
      console.log(
        `       Try increasing MAX_ITERATIONS (e.g. ${Math.min(
          Math.max(Math.round(expected * 5), 1_000_000),
          25_000_000,
        ).toLocaleString()}) or remove VANITY_PREFIX.`,
      )
    }
  }
  console.log('')

  // Multicurve encoder generates a random salt internally; override it with our mined salt.
  const createParams = sdk.factory.encodeCreateMulticurveParams(params)

  let mined: ReturnType<typeof mineTokenAddress> | undefined
  let vanityCreateParams: typeof createParams | undefined
  let currentStartSalt = startSalt

  for (let attempt = 1; attempt <= maxPreflightAttempts; attempt++) {
    mined = mineTokenAddress({
      prefix: vanityPrefix,
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

    // Preflight: simulate the exact airlock.create() call with the vanity salt.
    // This can revert if the CREATE2 address is already taken or params are invalid.
    try {
      const sim = await publicClient.simulateContract({
        address: airlockAddress,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...vanityCreateParams }],
        account: account.address,
      })
      const simResult = sim.result as readonly unknown[] | undefined
      const simulatedTokenAddress =
        (simResult?.[0] as Address | undefined) ?? undefined
      if (!simulatedTokenAddress) {
        throw new Error('simulateContract returned no token address')
      }
      if (
        simulatedTokenAddress.toLowerCase() !== mined.tokenAddress.toLowerCase()
      ) {
        throw new Error(
          `miner computed ${mined.tokenAddress} but simulation predicts ${simulatedTokenAddress}`,
        )
      }

      console.log('  preflight: OK (simulation matches mined address)')
      console.log('')
      break
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log('  preflight: REVERTED, will try next salt window')
      console.log('  error:', msg.split('\n')[0])
      console.log('')

      // Continue search from the next salt value after the one we just tested.
      currentStartSalt = BigInt(mined.salt) + 1n
      mined = undefined
      vanityCreateParams = undefined
    }
  }

  if (!mined || !vanityCreateParams) {
    throw new Error(
      `Preflight failed after ${maxPreflightAttempts} attempts. ` +
        `Try increasing MAX_PREFLIGHT_ATTEMPTS, increasing MAX_ITERATIONS, changing TOKEN_NAME, or setting START_SALT.`,
    )
  }

  if (dryRun) {
    console.log('DRY_RUN enabled; stopping after preflight.')
    return
  }

  console.log('Creating multicurve pool with vanity salt...')
  const result = await sdk.factory.createMulticurve(params, {
    _createParams: vanityCreateParams,
  })

  console.log('\nMulticurve pool created successfully!')
  console.log('Token address:', result.tokenAddress)
  console.log('Pool ID:', result.poolId)
  console.log('Transaction:', result.transactionHash)

  // Sanity check vanity constraint
  const deployedHex = result.tokenAddress.slice(2).toLowerCase()
  if (!deployedHex.endsWith(vanitySuffix.toLowerCase().replace(/^0x/, ''))) {
    console.warn(
      `\n[DopplerSDK] WARNING: deployed token does not end with requested suffix ${vanitySuffix}`,
    )
  }

  // Fetch state for monitoring
  const poolInstance = await sdk.getMulticurvePool(result.tokenAddress)
  const state = await poolInstance.getState()
  console.log('\nPool Info:')
  console.log('Fee:', state.poolKey.fee)
  console.log('Tick spacing:', state.poolKey.tickSpacing)
  console.log('Status:', state.status)
}

main().catch((error) => {
  console.error('\nError creating multicurve vanity launch:', error)
  process.exit(1)
})
