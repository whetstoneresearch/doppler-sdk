/**
 * Example: Create a Multicurve Pool with Graduation Market Cap
 *
 * This example demonstrates:
 * - Using withCurves() with market cap ranges (no tick math required)
 * - Setting graduationMarketCap to define when the pool can graduate/migrate
 * - Live ETH price fetching for accurate market cap calculations
 *
 * graduationMarketCap behavior:
 * - Must be >= the highest curve's end market cap (throws error otherwise)
 * - Warns if > 5x the highest curve's end (may be unintentional)
 * - Converts to farTick internally for the pool configuration
 * - If not specified, defaults to the highest curve's tickUpper
 *
 * Note: This is NOT a price cap - prices can exceed this value after graduation.
 * This is the market cap at which the pool can graduate (migrate or change status).
 */
import './env'

import { DopplerSDK } from '../src'
import { parseEther, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

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
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: baseSepolia, transport: http(rpcUrl), account })

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: baseSepolia.id })

  // Fetch current ETH price from CoinGecko
  console.log('Fetching current ETH price from CoinGecko...')
  const ethPriceUsd = await getEthPriceUsd()
  console.log('Current ETH price: $' + ethPriceUsd.toLocaleString())

  // Build multicurve using market cap ranges with a graduation target
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Graduation Market Cap Token',
      symbol: 'GMC',
      tokenURI: 'https://example.com/graduation-token.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale (90%)
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    // Use market cap ranges - no tick math needed!
    .withCurves({
      numerairePrice: ethPriceUsd,
      curves: [
        // Curve 1: Launch curve
        {
          marketCap: { start: 500_000, end: 1_500_000 }, // $500k - $1.5M
          numPositions: 10,
          shares: parseEther('0.3'), // 30%
        },
        // Curve 2: Growth phase
        {
          marketCap: { start: 1_000_000, end: 5_000_000 }, // $1M - $5M
          numPositions: 15,
          shares: parseEther('0.4'), // 40%
        },
        // Curve 3: Upper range - ends at $50M
        {
          marketCap: { start: 4_000_000, end: 50_000_000 }, // $4M - $50M
          numPositions: 10,
          shares: parseEther('0.3'), // 30%
        },
      ],
      // Set the graduation market cap at $100M
      // This is when the pool can graduate/migrate, NOT a price cap
      graduationMarketCap: 100_000_000, // $100M graduation target

      // Validation notes:
      // - Setting graduationMarketCap: 40_000_000 would THROW ERROR
      //   (must be >= highest curve end of $50M)
      //
      // - Setting graduationMarketCap: 300_000_000 would LOG WARNING
      //   ($300M is 6x > $50M, exceeds 5x threshold)
      //
      // - Setting graduationMarketCap: 100_000_000 is fine
      //   ($100M is 2x > $50M, within 5x threshold)
    })
    .withVesting({
      duration: BigInt(365 * 24 * 60 * 60), // 1 year vesting
      cliffDuration: 0,
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build()

  console.log('\nMulticurve Configuration:')
  console.log('  Token:', params.token.name, '(' + params.token.symbol + ')')
  console.log('  Curves:', params.pool.curves.length)
  console.log('  Far tick (from graduationMarketCap):', params.pool.farTick)

  console.log('\nMarket Cap Targets:')
  console.log('  Launch price: $500,000 market cap')
  console.log('  Highest curve end: $50,000,000')
  console.log('  Graduation target: $100,000,000')

  // Log curve details
  console.log('\nCurve Details (converted to ticks):')
  params.pool.curves.forEach((curve, i) => {
    console.log('  Curve ' + (i + 1) + ': ticks ' + curve.tickLower + ' -> ' + curve.tickUpper + ', ' + curve.numPositions + ' positions')
  })

  try {
    // Simulate to preview addresses
    const simulation = await sdk.factory.simulateCreateMulticurve(params)
    console.log('\nSimulation successful:')
    console.log('  Predicted token:', simulation.tokenAddress)
    console.log('  Predicted pool ID:', simulation.poolId)
    console.log('  Gas estimate:', simulation.gasEstimate?.toString())

    // Execute with guaranteed same addresses
    const result = await simulation.execute()

    console.log('\nMulticurve created successfully!')
    console.log('  Token address:', result.tokenAddress)
    console.log('  Pool ID:', result.poolId)
    console.log('  Transaction:', result.transactionHash)

    // Get the pool instance for monitoring
    const poolInstance = await sdk.getMulticurvePool(result.tokenAddress)
    const state = await poolInstance.getState()

    console.log('\nPool Info:')
    console.log('  Fee:', state.poolKey.fee)
    console.log('  Tick spacing:', state.poolKey.tickSpacing)
    console.log('  Far tick:', state.farTick)
    console.log('  Status:', state.status)

    console.log('\nThe pool can graduate when it reaches $100M market cap.')
    console.log('After graduation/migration, prices can continue to rise.')
  } catch (error) {
    console.error('\nError creating multicurve:', error)
    process.exit(1)
  }
}

main()
