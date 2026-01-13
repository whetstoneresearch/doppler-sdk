import './env'
import { GraphQLClient, gql } from 'graphql-request'

// Indexer URLs
const INDEXER_URLS = {
  base: 'https://indexer.doppler.lol/',
  baseSepolia: 'https://testnet-indexer.doppler.lol/',
}

// Chain IDs
const CHAIN_IDS = {
  base: 8453,
  baseSepolia: 84532,
}

interface PoolData {
  address: string
  chainId: number
  tick?: number
  sqrtPrice: string
  liquidity: string
  createdAt: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  price?: string
  fee: number
  type: string
  dollarLiquidity: string
  volumeUsd: string
  percentDayChange?: number
  isToken0?: boolean
  marketCapUsd?: string
  asset?: {
    marketCapUsd: string
    migrated: boolean
    migratedAt: string | null
    v2Pool: string | null
  }
}

interface PoolsResponse {
  pools: {
    items: PoolData[]
  }
}

const GET_POOLS_BY_BASE_TOKEN = gql`
  query GetPoolsByBaseToken($baseTokenAddress: String!, $chainId: Float!) {
    pools(
      where: {
        baseToken_: { address: $baseTokenAddress }
        chainId: $chainId
      }
      limit: 5
      orderBy: "createdAt"
      orderDirection: "desc"
    ) {
      items {
        address
        chainId
        tick
        sqrtPrice
        liquidity
        createdAt
        baseToken { address name symbol }
        quoteToken { address name symbol }
        price
        fee
        type
        dollarLiquidity
        volumeUsd
        percentDayChange
        isToken0
        marketCapUsd
        asset {
          marketCapUsd
          migrated
          migratedAt
          v2Pool
        }
      }
    }
  }
`

const GET_POOL_BY_ADDRESS = gql`
  query GetPoolByAddress($poolAddress: String!, $chainId: Float!) {
    pools(
      where: {
        address: $poolAddress
        chainId: $chainId
      }
      limit: 1
    ) {
      items {
        address
        chainId
        tick
        sqrtPrice
        liquidity
        createdAt
        baseToken { address name symbol }
        quoteToken { address name symbol }
        price
        fee
        type
        dollarLiquidity
        volumeUsd
        percentDayChange
        isToken0
        marketCapUsd
        asset {
          marketCapUsd
          migrated
          migratedAt
          v2Pool
        }
      }
    }
  }
`

function formatBigNumber(value: string | undefined, decimals: number = 18): string {
  if (!value) return 'N/A'
  try {
    const num = BigInt(value)
    const divisor = BigInt(10 ** decimals)
    const whole = num / divisor
    const fraction = num % divisor
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4)
    return `${whole.toLocaleString()}.${fractionStr}`
  } catch {
    return value
  }
}

function formatUsd(value: string | undefined): string {
  if (!value) return 'N/A'
  try {
    const num = BigInt(value)
    // Market cap is stored with 18 decimals
    const usdValue = Number(num) / 10**18
    return `$${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } catch {
    return value
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Usage: pnpx tsx examples/validate-market-cap-indexer.ts <TOKEN_OR_POOL_ADDRESS> [--chain base|baseSepolia] [--type token|pool]')
    console.log('')
    console.log('Examples:')
    console.log('  pnpx tsx examples/validate-market-cap-indexer.ts 0x1234... --chain baseSepolia')
    console.log('  pnpx tsx examples/validate-market-cap-indexer.ts 0x1234... --chain base --type pool')
    process.exit(1)
  }

  const address = args[0].toLowerCase()
  const chainArg = args.includes('--chain') ? args[args.indexOf('--chain') + 1] : 'baseSepolia'
  const typeArg = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'token'

  const chain = chainArg as keyof typeof INDEXER_URLS
  if (!INDEXER_URLS[chain]) {
    console.error(`Invalid chain: ${chainArg}. Must be one of: ${Object.keys(INDEXER_URLS).join(', ')}`)
    process.exit(1)
  }

  const indexerUrl = INDEXER_URLS[chain]
  const chainId = CHAIN_IDS[chain]

  console.log('============================================================')
  console.log('Market Cap Validation - Doppler Indexer')
  console.log('============================================================')
  console.log(`Chain: ${chain} (${chainId})`)
  console.log(`Indexer: ${indexerUrl}`)
  console.log(`Address: ${address}`)
  console.log(`Query Type: ${typeArg}`)
  console.log('')

  const client = new GraphQLClient(indexerUrl)

  try {
    let response: PoolsResponse

    if (typeArg === 'pool') {
      console.log('Querying by pool address...')
      response = await client.request<PoolsResponse>(GET_POOL_BY_ADDRESS, {
        poolAddress: address,
        chainId,
      })
    } else {
      console.log('Querying by token address (baseToken)...')
      response = await client.request<PoolsResponse>(GET_POOLS_BY_BASE_TOKEN, {
        baseTokenAddress: address,
        chainId,
      })
    }

    const pools = response.pools.items

    if (pools.length === 0) {
      console.log('')
      console.log('No pools found for this address.')
      console.log('This could mean:')
      console.log('  1. The token/pool was just created and indexer hasn\'t processed it yet')
      console.log('  2. The address is incorrect')
      console.log('  3. The chain is incorrect')
      console.log('')
      console.log('Try waiting 30-60 seconds and running again.')
      process.exit(0)
    }

    console.log(`Found ${pools.length} pool(s)`)
    console.log('')

    for (const pool of pools) {
      console.log('============================================================')
      console.log(`Pool: ${pool.address}`)
      console.log('============================================================')
      console.log('')
      console.log('--- Token Info ---')
      console.log(`Base Token: ${pool.baseToken.symbol} (${pool.baseToken.address})`)
      console.log(`Quote Token: ${pool.quoteToken.symbol} (${pool.quoteToken.address})`)
      console.log(`Type: ${pool.type}`)
      console.log(`Is Token0: ${pool.isToken0}`)
      console.log('')
      console.log('--- Price & Market Cap ---')
      console.log(`Price (raw): ${pool.price}`)
      console.log(`Price (formatted): ${formatBigNumber(pool.price, 18)}`)
      console.log('')
      console.log(`Pool marketCapUsd (raw): ${pool.marketCapUsd}`)
      console.log(`Pool marketCapUsd (formatted): ${formatUsd(pool.marketCapUsd)}`)
      console.log('')

      if (pool.asset) {
        console.log('--- Asset Data ---')
        console.log(`Asset marketCapUsd (raw): ${pool.asset.marketCapUsd}`)
        console.log(`Asset marketCapUsd (formatted): ${formatUsd(pool.asset.marketCapUsd)}`)
        console.log(`Migrated: ${pool.asset.migrated}`)
        if (pool.asset.migratedAt) {
          console.log(`Migrated At: ${new Date(Number(pool.asset.migratedAt) * 1000).toISOString()}`)
        }
        if (pool.asset.v2Pool) {
          console.log(`V2 Pool: ${pool.asset.v2Pool}`)
        }
      } else {
        console.log('--- Asset Data ---')
        console.log('No asset data found (asset may not be linked)')
      }

      console.log('')
      console.log('--- Pool Metrics ---')
      console.log(`Liquidity (raw): ${pool.liquidity}`)
      console.log(`Dollar Liquidity: ${formatUsd(pool.dollarLiquidity)}`)
      console.log(`Volume USD: ${formatUsd(pool.volumeUsd)}`)
      console.log(`Fee: ${pool.fee}`)
      console.log(`Tick: ${pool.tick}`)
      console.log(`Sqrt Price: ${pool.sqrtPrice}`)
      console.log(`Created At: ${new Date(Number(pool.createdAt) * 1000).toISOString()}`)
      console.log('')

      // Check for market cap issues
      const poolMarketCap = pool.marketCapUsd ? BigInt(pool.marketCapUsd) : 0n
      const assetMarketCap = pool.asset?.marketCapUsd ? BigInt(pool.asset.marketCapUsd) : 0n

      if (poolMarketCap === 0n && assetMarketCap === 0n) {
        console.log('⚠️  WARNING: Market cap is 0!')
        console.log('')
        console.log('Possible causes:')
        console.log('  1. Price is 0 or undefined')
        console.log('  2. Quote token not recognized (check getQuoteInfo.ts)')
        console.log('  3. Decimal mismatch in calculation')
        console.log('  4. Pool just created and metrics not yet calculated')
      } else if (poolMarketCap > 0n || assetMarketCap > 0n) {
        console.log('✓ Market cap is non-zero')
      }
      console.log('')
    }

  } catch (error) {
    console.error('Error querying indexer:', error)
    process.exit(1)
  }
}

main().catch(console.error)
