/**
 * Example: Create a Multicurve Pool using Market Cap Ranges
 *
 * This example demonstrates:
 * - Configuring a V4 multicurve pool using dollar-denominated market cap ranges
 * - Fetching live ETH price from CoinGecko for accurate market cap calculations
 * - No tick math required - just specify market caps in USD
 * - Overlapping curves for extra liquidity at key thresholds
 *
 * Key concept: Define curves by their market cap ranges. The SDK handles all
 * tick calculations internally based on token supply and numeraire price.
 *
 * Key requirement: saleConfig() must be called before withCurves()
 */

import { DopplerSDK } from '../src'
import { parseEther, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY must be set')

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

  // Fetch current ETH price from CoinGecko
  console.log('Fetching current ETH price from CoinGecko...')
  const ethPriceUsd = await getEthPriceUsd()
  console.log(`Current ETH price: $${ethPriceUsd.toLocaleString()}`)
  console.log('')

  // Build multicurve using market cap ranges
  // No tick math required - just specify market caps in USD
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'TEST',
      symbol: 'TEST',
      tokenURI: 'https://example.com/sample.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale (90%)
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    // Use market cap ranges - no tick math needed!
    // The first curve's start market cap is the launch price
    .withCurves({
      numerairePrice: ethPriceUsd, // Live ETH price from CoinGecko
      curves: [
        // Curve 1: Launch curve - starts at $500k market cap
        {
          marketCap: { start: 500_000, end: 1_500_000 }, // $500k - $1.5M (launch price)
          numPositions: 10,
          shares: parseEther('0.3'), // 30% of tokens
        },
        // Curve 2: Overlaps with first curve at $1M for extra liquidity
        {
          marketCap: { start: 1_000_000, end: 5_000_000 }, // $1M - $5M
          numPositions: 15,
          shares: parseEther('0.4'), // 40% of tokens
        },
        // Curve 3: Upper range with overlap at $4-5M
        {
          marketCap: { start: 4_000_000, end: 50_000_000 }, // $4M - $50M
          numPositions: 10,
          shares: parseEther('0.3'), // 30% of tokens
        },
      ],
      // Optional overrides:
      // fee: FEE_TIERS.LOW,      // 500 (0.05%) - default
      // tickSpacing: 10,         // Derived from fee if not provided
      // tokenDecimals: 18,
      // numeraireDecimals: 18,
      // beneficiaries: [         // Optional fee streaming recipients
      //   { beneficiary: account.address, shares: parseEther('1') }
      // ],
    })
    .withVesting({
      duration: BigInt(365 * 24 * 60 * 60), // 1 year vesting
      cliffDuration: 0,
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' }) // V2 migration for simplicity
    .withUserAddress(account.address)
    .build()

  console.log('Build params:')
  console.log(JSON.stringify(params, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))
  console.log('')

  console.log('Creating multicurve pool with market cap targets...')
  console.log('Token:', params.token.name, `(${params.token.symbol})`)
  console.log(`Launch market cap: $500,000 (at ETH = $${ethPriceUsd.toLocaleString()})`)
  console.log('Curves:', params.pool.curves.length, 'configured')

  // Log curve details
  params.pool.curves.forEach((curve, i) => {
    console.log(`  Curve ${i + 1}: ticks ${curve.tickLower} -> ${curve.tickUpper}, ${curve.numPositions} positions`)
  })

  try {
    // Simulate to preview addresses and get executable
    const simulation = await sdk.factory.simulateCreateMulticurve(params)
    console.log('\nPredicted addresses:')
    console.log('Token:', simulation.asset)
    console.log('Pool:', simulation.pool)
    console.log('Gas estimate:', simulation.gasEstimate)

    // Execute with guaranteed same addresses (uses same salt from simulation)
    const result = await simulation.execute()

    console.log('\nMulticurve pool created successfully!')
    console.log('Token address:', result.tokenAddress, result.tokenAddress === simulation.asset ? '(matches)' : '(MISMATCH)')
    console.log('Pool address:', result.poolAddress, result.poolAddress === simulation.pool ? '(matches)' : '(MISMATCH)')
    console.log('Transaction:', result.transactionHash)

    // Get the pool instance for monitoring
    const poolInstance = await sdk.getMulticurvePool(result.poolAddress)
    const state = await poolInstance.getState()

    console.log('\nPool Info:')
    console.log('Fee:', state.poolKey.fee)
    console.log('Tick spacing:', state.poolKey.tickSpacing)
    console.log('Status:', state.status)
  } catch (error) {
    console.error('\nError creating multicurve:', error)
    process.exit(1)
  }
}

main()
