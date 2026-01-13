/**
 * Unified Market Cap Test Script
 *
 * Creates test tokens for all auction types (static, dynamic, multi) with all quote tokens (ETH, USDC, USDT).
 * Supports both Base mainnet and Base Sepolia for testing.
 *
 * Usage:
 *   pnpx tsx examples/create-test-market-cap.ts --type static --quote eth --chain base
 *   pnpx tsx examples/create-test-market-cap.ts --type dynamic --quote usdc --chain baseSepolia
 *   pnpx tsx examples/create-test-market-cap.ts --type multi --quote usdt
 *
 * Environment:
 *   PRIVATE_KEY     - Wallet private key
 *   DRY_RUN         - Set to 'false' to execute (default: true)
 *   ALCHEMY_API_KEY - Optional Alchemy API key for reliable RPC
 */
import './env'

import {
  parseEther,
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Chain,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import {
  StaticAuctionBuilder,
  DynamicAuctionBuilder,
  MulticurveBuilder,
  CHAIN_IDS,
  DopplerSDK,
  DAY_SECONDS,
  getAirlockBeneficiary,
} from '../src'
import { GraphQLClient, gql } from 'graphql-request'

// ============================================================
// CHAIN CONFIGURATION
// ============================================================
type ChainName = 'base' | 'baseSepolia'

interface ChainConfig {
  chain: Chain
  chainId: number
  rpcUrl: string
  alchemyRpcUrl: (key: string) => string
  indexerUrl: string
  addresses: {
    weth: Address
    usdc: Address
    usdt: Address
  }
}

const CHAIN_CONFIGS: Record<ChainName, ChainConfig> = {
  base: {
    chain: base,
    chainId: CHAIN_IDS.BASE,
    rpcUrl: 'https://mainnet.base.org',
    alchemyRpcUrl: (key) => `https://base-mainnet.g.alchemy.com/v2/${key}`,
    indexerUrl: 'https://indexer-prod.marble.live/graphql',
    addresses: {
      weth: '0x4200000000000000000000000000000000000006' as Address,
      usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address,
      usdt: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2' as Address,
    },
  },
  baseSepolia: {
    chain: baseSepolia,
    chainId: CHAIN_IDS.BASE_SEPOLIA,
    rpcUrl: 'https://sepolia.base.org',
    alchemyRpcUrl: (key) => `https://base-sepolia.g.alchemy.com/v2/${key}`,
    indexerUrl: 'https://testnet-indexer.doppler.lol/',
    addresses: {
      weth: '0x4200000000000000000000000000000000000006' as Address,
      usdc: '0x036cbd53842c5426634e7929541ec2318f3dcf7e' as Address,
      usdt: '0x323e78f944a9a1fcf3a10efcc5319dbb0bb6e673' as Address,
    },
  },
}

// ============================================================
// CONFIGURATION (Matching UI Defaults)
// ============================================================
const TOKEN_NAME = 'TEST'
const TOKEN_SYMBOL = 'TEST'
const TOTAL_SUPPLY = parseEther('1000000000') // 1B tokens
const NUM_TOKENS_TO_SELL = parseEther('900000000') // 90% - 900M

// Market Cap Defaults (using values that work reliably)
// Note: UI default minMarketCap is $1k but this can cause tick range issues
const UI_DEFAULTS = {
  static: {
    startMarketCap: 500_000, // $500k
    endMarketCap: 75_000_000, // $75M
  },
  dynamic: {
    startMarketCap: 500_000, // $500k (Dutch auction starts high)
    minMarketCap: 50_000, // $50k floor (safer than $1k which causes tick issues)
    minProceedsUSD: 6_000, // $6k converted to quote
    maxProceedsUSD: 12_000, // $12k converted to quote
    durationDays: 7,
    numPdSlugs: 15,
  },
  multi: {
    startMarketCap: 500_000, // $500k
    endMarketCap: 5_000_000, // $5M
  },
}

// ============================================================
// QUOTE TOKEN CONFIG
// ============================================================
type QuoteType = 'eth' | 'usdc' | 'usdt'

interface QuoteConfig {
  address: Address
  decimals: number
  price: number
  symbol: string
}

function getQuoteConfig(quote: QuoteType, chainConfig: ChainConfig): QuoteConfig {
  const { addresses } = chainConfig
  const configs: Record<QuoteType, QuoteConfig> = {
    eth: {
      address: addresses.weth,
      decimals: 18,
      price: 3000, // ~$3000 ETH
      symbol: 'ETH',
    },
    usdc: {
      address: addresses.usdc,
      decimals: 6,
      price: 1,
      symbol: 'USDC',
    },
    usdt: {
      address: addresses.usdt,
      decimals: 6,
      price: 1,
      symbol: 'USDT',
    },
  }
  return configs[quote]
}

// ============================================================
// AUCTION BUILDERS (Matching UI)
// ============================================================

// Matching the UI's DOPPLER_INTEGRATOR_ADDRESS
const DOPPLER_INTEGRATOR_ADDRESS = '0x21E2ce70511e4FE542a97708e89520471DAa7A66' as Address

// Default vesting duration (matching UI DEFAULT_V3_VESTING_DURATION = 90 days)
const DEFAULT_VESTING_DURATION = 90 * 24 * 60 * 60 // 90 days in seconds

// Default pre-mint amount (matching UI DEFAULT_V3_PRE_MINT = 0.02 ETH worth = ~$60)
const DEFAULT_PRE_MINT = parseEther('0.02')

function buildStaticAuction(
  quoteConfig: QuoteConfig,
  userAddress: Address,
  chainId: number
): ReturnType<typeof StaticAuctionBuilder.forChain> {
  const timestamp = Date.now()

  const builder = StaticAuctionBuilder.forChain(chainId)
    .tokenConfig({
      name: `${TOKEN_NAME} ${quoteConfig.symbol} Static ${timestamp}`,
      symbol: TOKEN_SYMBOL,
      tokenURI: `ipfs://test-static-${quoteConfig.symbol.toLowerCase()}-${timestamp}`,
    })
    .saleConfig({
      initialSupply: TOTAL_SUPPLY,
      numTokensToSell: NUM_TOKENS_TO_SELL,
      numeraire: quoteConfig.address,
    })
    .withMarketCapRange({
      marketCap: {
        start: UI_DEFAULTS.static.startMarketCap,
        end: UI_DEFAULTS.static.endMarketCap,
      },
      numerairePrice: quoteConfig.price,
      numeraireDecimals: quoteConfig.decimals,
    })
    .withIntegrator(DOPPLER_INTEGRATOR_ADDRESS) // Match UI
    .withMigration({ type: 'uniswapV2' })
    .withGovernance({ type: 'noOp' })
    .withUserAddress(userAddress)

  // Add vesting to use LockableV3Initializer like the UI does
  builder.withVesting({
    duration: DEFAULT_VESTING_DURATION,
    recipients: [userAddress],
    amounts: [DEFAULT_PRE_MINT],
  })

  return builder
}

function buildDynamicAuction(
  quoteConfig: QuoteConfig,
  userAddress: Address,
  chainId: number
): ReturnType<typeof DynamicAuctionBuilder.forChain> {
  const timestamp = Date.now()
  const isStablecoin = quoteConfig.decimals === 6

  // Convert USD proceeds to quote token amount (matching UI logic)
  const minProceeds = isStablecoin
    ? BigInt(UI_DEFAULTS.dynamic.minProceedsUSD) * 10n ** 6n
    : parseEther((UI_DEFAULTS.dynamic.minProceedsUSD / quoteConfig.price).toString())
  const maxProceeds = isStablecoin
    ? BigInt(UI_DEFAULTS.dynamic.maxProceedsUSD) * 10n ** 6n
    : parseEther((UI_DEFAULTS.dynamic.maxProceedsUSD / quoteConfig.price).toString())

  return DynamicAuctionBuilder.forChain(chainId)
    .tokenConfig({
      name: `${TOKEN_NAME} ${quoteConfig.symbol} Dynamic ${timestamp}`,
      symbol: TOKEN_SYMBOL,
      tokenURI: `ipfs://test-dynamic-${quoteConfig.symbol.toLowerCase()}-${timestamp}`,
    })
    .saleConfig({
      initialSupply: TOTAL_SUPPLY,
      numTokensToSell: NUM_TOKENS_TO_SELL,
      numeraire: quoteConfig.address,
    })
    .withMarketCapRange({
      marketCap: {
        start: UI_DEFAULTS.dynamic.startMarketCap,
        min: UI_DEFAULTS.dynamic.minMarketCap,
      },
      numerairePrice: quoteConfig.price,
      numeraireDecimals: quoteConfig.decimals,
      minProceeds,
      maxProceeds,
      numPdSlugs: UI_DEFAULTS.dynamic.numPdSlugs,
      duration: UI_DEFAULTS.dynamic.durationDays * DAY_SECONDS,
    })
    .withIntegrator(DOPPLER_INTEGRATOR_ADDRESS) // Match UI
    .withMigration({ type: 'uniswapV2' })
    .withGovernance({ type: 'noOp' })
    .withUserAddress(userAddress)
}

interface BeneficiaryData {
  beneficiary: Address
  shares: bigint
}

function buildMulticurveAuction(
  quoteConfig: QuoteConfig,
  userAddress: Address,
  airlockBeneficiary: BeneficiaryData,
  chainId: number
): ReturnType<typeof MulticurveBuilder.forChain> {
  const timestamp = Date.now()
  const isStablecoin = quoteConfig.decimals === 6

  // Reduce positions for stablecoins to avoid TickLiquidityOverflow
  // (120 was causing overflow, 40 should be safe)
  const numPositions = isStablecoin ? 40 : 10

  return MulticurveBuilder.forChain(chainId)
    .tokenConfig({
      name: `${TOKEN_NAME} ${quoteConfig.symbol} Multi ${timestamp}`,
      symbol: TOKEN_SYMBOL,
      tokenURI: `ipfs://test-multi-${quoteConfig.symbol.toLowerCase()}-${timestamp}`,
    })
    .saleConfig({
      initialSupply: TOTAL_SUPPLY,
      numTokensToSell: NUM_TOKENS_TO_SELL,
      numeraire: quoteConfig.address,
    })
    .withCurves({
      fee: 10000, // 1% (matching working example)
      numerairePrice: quoteConfig.price,
      numeraireDecimals: quoteConfig.decimals,
      curves: [
        {
          marketCap: {
            start: UI_DEFAULTS.multi.startMarketCap,
            end: UI_DEFAULTS.multi.endMarketCap,
          },
          numPositions,
          shares: parseEther('1.0'), // 100% single curve
        },
      ],
      // Must include airlock beneficiary (fetched dynamically)
      beneficiaries: [
        { beneficiary: userAddress, shares: parseEther('0.95') },
        airlockBeneficiary,
      ],
    })
    .withMigration({ type: 'noOp' }) // Multicurve uses noOp migration
    .withGovernance({ type: 'noOp' })
    .withUserAddress(userAddress)
}

// ============================================================
// VALIDATION
// ============================================================
interface PoolData {
  address: string
  price: string
  marketCapUsd: string
  quoteToken: { address: string; symbol: string }
  baseToken: { address: string; symbol: string }
  type: string
  asset?: { marketCapUsd: string }
}

const GET_TOKEN = gql`
  query Token($address: String!, $chainId: Float!) {
    token(address: $address, chainId: $chainId) {
      name
      symbol
      pool {
        address
        price
        marketCapUsd
        type
        quoteToken {
          address
          symbol
        }
      }
    }
  }
`

interface TokenResponse {
  token: {
    name: string
    symbol: string
    pool: {
      address: string
      price: string
      marketCapUsd: string
      type: string
      quoteToken: { address: string; symbol: string }
    }
  } | null
}

async function validateMarketCap(
  tokenAddress: string,
  auctionType: string,
  quoteConfig: QuoteConfig,
  chainConfig: ChainConfig,
  chainName: ChainName
): Promise<void> {
  console.log('')
  console.log('='.repeat(60))
  console.log('MARKET CAP VALIDATION')
  console.log('='.repeat(60))

  const client = new GraphQLClient(chainConfig.indexerUrl)

  try {
    const response = await client.request<TokenResponse>(GET_TOKEN, {
      address: tokenAddress.toLowerCase(),
      chainId: chainConfig.chainId,
    })

    if (!response.token || !response.token.pool) {
      console.log('Token not found in indexer yet.')
      return
    }

    const { token } = response
    const pool = token.pool
    const marketCap = pool.marketCapUsd
      ? Number(formatUnits(BigInt(pool.marketCapUsd), 18))
      : 0
    const price = pool.price ? Number(formatUnits(BigInt(pool.price), 18)) : 0

    console.log(`Token: ${token.name} (${token.symbol})`)
    console.log(`Pool: ${pool.address}`)
    console.log(`Type: ${pool.type}`)
    console.log(`Quote Token: ${pool.quoteToken.symbol} (${pool.quoteToken.address})`)
    console.log('')
    console.log('--- Market Cap Results ---')
    console.log(`Market Cap: $${marketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
    console.log(`Price: ${price}`)
    console.log('')

    // Expected market cap based on type
    const expectedStartMcap =
      auctionType === 'static'
        ? UI_DEFAULTS.static.startMarketCap
        : auctionType === 'dynamic'
          ? UI_DEFAULTS.dynamic.startMarketCap
          : UI_DEFAULTS.multi.startMarketCap

    console.log(`Expected Start MCap: ~$${expectedStartMcap.toLocaleString()}`)

    // Check for issues
    if (marketCap === 0) {
      console.log('')
      console.log('WARNING: Market cap is 0!')
    } else {
      const ratio = marketCap / expectedStartMcap
      if (ratio > 0.5 && ratio < 2) {
        console.log('OK - Market cap is within expected range')
      } else {
        console.log(`WARNING: Ratio is ${ratio.toFixed(2)} (expected ~1.0)`)
      }
    }
  } catch (error) {
    console.error('Error querying indexer:', error)
  }
}

// ============================================================
// MAIN
// ============================================================
type AuctionType = 'static' | 'dynamic' | 'multi'

function parseArgs(): { type: AuctionType; quote: QuoteType; chain: ChainName } {
  const args = process.argv.slice(2)

  let auctionType: AuctionType = 'dynamic'
  let quoteType: QuoteType = 'eth'
  let chainName: ChainName = 'base'

  const typeIdx = args.indexOf('--type')
  if (typeIdx !== -1 && args[typeIdx + 1]) {
    const t = args[typeIdx + 1]
    if (t === 'static' || t === 'dynamic' || t === 'multi') {
      auctionType = t
    }
  }

  const quoteIdx = args.indexOf('--quote')
  if (quoteIdx !== -1 && args[quoteIdx + 1]) {
    const q = args[quoteIdx + 1]
    if (q === 'eth' || q === 'usdc' || q === 'usdt') {
      quoteType = q
    }
  }

  const chainIdx = args.indexOf('--chain')
  if (chainIdx !== -1 && args[chainIdx + 1]) {
    const c = args[chainIdx + 1]
    if (c === 'base' || c === 'baseSepolia') {
      chainName = c
    }
  }

  // Legacy flags
  if (args.includes('--usdc')) quoteType = 'usdc'
  if (args.includes('--usdt')) quoteType = 'usdt'
  if (args.includes('--eth')) quoteType = 'eth'
  if (args.includes('--sepolia')) chainName = 'baseSepolia'

  return { type: auctionType, quote: quoteType, chain: chainName }
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable required')
    console.error('')
    console.error('Usage:')
    console.error(
      '  PRIVATE_KEY=0x... pnpx tsx examples/create-test-market-cap.ts --type static --quote eth --chain base'
    )
    console.error(
      '  PRIVATE_KEY=0x... pnpx tsx examples/create-test-market-cap.ts --type dynamic --quote usdc --chain baseSepolia'
    )
    console.error(
      '  PRIVATE_KEY=0x... pnpx tsx examples/create-test-market-cap.ts --type multi --quote usdt'
    )
    process.exit(1)
  }

  const { type: auctionType, quote: quoteType, chain: chainName } = parseArgs()
  const chainConfig = CHAIN_CONFIGS[chainName]
  const quoteConfig = getQuoteConfig(quoteType, chainConfig)

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const userAddress = account.address

  console.log('='.repeat(60))
  console.log(`Creating ${auctionType.toUpperCase()} Auction with ${quoteConfig.symbol}`)
  console.log('='.repeat(60))
  console.log('')
  console.log('--- Configuration ---')
  console.log(`Chain: ${chainName} (${chainConfig.chainId})`)
  console.log(`Token Name: ${TOKEN_NAME}`)
  console.log(`Token Symbol: ${TOKEN_SYMBOL}`)
  console.log(`Total Supply: ${formatUnits(TOTAL_SUPPLY, 18)} tokens`)
  console.log(`Tokens to Sell: ${formatUnits(NUM_TOKENS_TO_SELL, 18)} (90%)`)
  console.log('')
  console.log('--- Quote Token ---')
  console.log(`Symbol: ${quoteConfig.symbol}`)
  console.log(`Address: ${quoteConfig.address}`)
  console.log(`Decimals: ${quoteConfig.decimals}`)
  console.log(`Price: $${quoteConfig.price}`)
  console.log('')
  console.log('--- Market Cap Range ---')
  if (auctionType === 'static') {
    console.log(`Start: $${UI_DEFAULTS.static.startMarketCap.toLocaleString()}`)
    console.log(`End: $${UI_DEFAULTS.static.endMarketCap.toLocaleString()}`)
  } else if (auctionType === 'dynamic') {
    console.log(`Start: $${UI_DEFAULTS.dynamic.startMarketCap.toLocaleString()} (high price)`)
    console.log(`Min: $${UI_DEFAULTS.dynamic.minMarketCap.toLocaleString()} (floor)`)
    console.log(`Duration: ${UI_DEFAULTS.dynamic.durationDays} days`)
  } else {
    console.log(`Start: $${UI_DEFAULTS.multi.startMarketCap.toLocaleString()}`)
    console.log(`End: $${UI_DEFAULTS.multi.endMarketCap.toLocaleString()}`)
  }
  console.log('')
  console.log(`User Address: ${userAddress}`)
  console.log('')

  // Setup clients - prefer Alchemy for reliability
  const alchemyKey = process.env.ALCHEMY_API_KEY
  const rpcUrl = alchemyKey
    ? chainConfig.alchemyRpcUrl(alchemyKey)
    : process.env.RPC_URL || chainConfig.rpcUrl
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(rpcUrl),
  })

  // Build the auction
  let params: ReturnType<
    | ReturnType<typeof StaticAuctionBuilder.forChain>['build']
    | ReturnType<typeof DynamicAuctionBuilder.forChain>['build']
    | ReturnType<typeof MulticurveBuilder.forChain>['build']
  >

  if (auctionType === 'static') {
    params = buildStaticAuction(quoteConfig, userAddress, chainConfig.chainId).build()
    console.log('--- Static Auction Parameters ---')
    console.log(`Start Tick: ${(params as any).pool.startTick}`)
    console.log(`End Tick: ${(params as any).pool.endTick}`)
    console.log(`Fee: ${(params as any).pool.fee}`)
    console.log(`Num Positions: ${(params as any).pool.numPositions}`)
  } else if (auctionType === 'dynamic') {
    params = buildDynamicAuction(quoteConfig, userAddress, chainConfig.chainId).build()
    console.log('--- Dynamic Auction Parameters ---')
    console.log(`Start Tick: ${(params as any).auction.startTick}`)
    console.log(`End Tick: ${(params as any).auction.endTick}`)
    console.log(`Duration: ${(params as any).auction.duration / DAY_SECONDS} days`)
    console.log(`Epoch Length: ${(params as any).auction.epochLength / 3600} hours`)
    console.log(`Gamma: ${(params as any).auction.gamma}`)
    console.log(`Fee: ${(params as any).pool.fee}`)
    console.log(`Tick Spacing: ${(params as any).pool.tickSpacing}`)
  } else {
    // Fetch airlock beneficiary dynamically for multicurve
    console.log('Fetching airlock beneficiary...')
    const airlockBeneficiary = await getAirlockBeneficiary(publicClient)
    console.log(`Airlock Beneficiary: ${airlockBeneficiary.beneficiary}`)
    params = buildMulticurveAuction(quoteConfig, userAddress, airlockBeneficiary, chainConfig.chainId).build()
    console.log('--- Multicurve Parameters ---')
    console.log(`Curves: ${(params as any).pool.curves.length}`)
    ;(params as any).pool.curves.forEach((curve: any, i: number) => {
      console.log(
        `  Curve ${i}: tickLower=${curve.tickLower}, tickUpper=${curve.tickUpper}, positions=${curve.numPositions}`
      )
    })
  }
  console.log('')

  const sdk = new DopplerSDK({
    chainId: chainConfig.chainId,
    publicClient,
    walletClient,
  })

  console.log('Simulating transaction...')
  console.log('')

  let tokenAddress: string

  try {
    if (auctionType === 'static') {
      const simulation = await sdk.factory.simulateCreateStaticAuction(params as any)
      tokenAddress = simulation.asset
      console.log('--- Simulation Result ---')
      console.log(`Token Address: ${simulation.asset}`)
      console.log(`Pool Address: ${simulation.pool}`)
    } else if (auctionType === 'dynamic') {
      const simulation = await sdk.factory.simulateCreateDynamicAuction(params as any)
      tokenAddress = simulation.tokenAddress
      console.log('--- Simulation Result ---')
      console.log(`Token Address: ${simulation.tokenAddress}`)
      console.log(`Hook Address: ${simulation.hookAddress}`)
      console.log(`Pool ID: ${simulation.poolId}`)
    } else {
      const simulation = await sdk.factory.simulateCreateMulticurve(params as any)
      tokenAddress = simulation.tokenAddress
      console.log('--- Simulation Result ---')
      console.log(`Token Address: ${simulation.tokenAddress}`)
      console.log(`Pool ID: ${simulation.poolId}`)
    }

    console.log('')

    const dryRun = process.env.DRY_RUN !== 'false'

    if (dryRun) {
      console.log('Ready to deploy. Set DRY_RUN=false to execute.')
      console.log('')
      console.log('DRY RUN - No transaction executed')
      console.log('')
      console.log('To execute:')
      console.log(
        `  DRY_RUN=false pnpx tsx examples/create-test-market-cap.ts --type ${auctionType} --quote ${quoteType} --chain ${chainName}`
      )
    } else {
      console.log('Executing transaction...')

      let txHash: string
      let actualTokenAddress: Address

      if (auctionType === 'static') {
        const result = await sdk.factory.createStaticAuction(params as any)
        txHash = result.transactionHash
        actualTokenAddress = result.tokenAddress
      } else if (auctionType === 'dynamic') {
        const result = await sdk.factory.createDynamicAuction(params as any)
        txHash = result.transactionHash
        actualTokenAddress = result.tokenAddress
      } else {
        const result = await sdk.factory.createMulticurve(params as any)
        txHash = result.transactionHash
        actualTokenAddress = result.tokenAddress
      }

      console.log('')
      console.log('--- Transaction Result ---')
      console.log(`Transaction Hash: ${txHash}`)
      console.log(`Token Address (simulated): ${tokenAddress}`)
      console.log(`Token Address (actual): ${actualTokenAddress}`)
      if (tokenAddress.toLowerCase() !== actualTokenAddress.toLowerCase()) {
        console.log('⚠️  WARNING: Simulated address differs from actual address!')
      }
      console.log('')
      const explorerUrl = chainName === 'baseSepolia'
        ? `https://sepolia.basescan.org/tx/${txHash}`
        : `https://basescan.org/tx/${txHash}`
      console.log(`View on BaseScan: ${explorerUrl}`)
      console.log('')

      // Wait for indexer
      console.log('Waiting 15 seconds for indexer to process...')
      await new Promise((resolve) => setTimeout(resolve, 15000))

      // Validate using ACTUAL token address, not simulated
      await validateMarketCap(actualTokenAddress, auctionType, quoteConfig, chainConfig, chainName)
    }
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

main().catch(console.error)
