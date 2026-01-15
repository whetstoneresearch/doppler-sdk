/**
 * Example: Create a Multicurve Pool with Graduation Market Cap (Rehype)
 *
 * This example demonstrates:
 * - Using withCurves() with market cap ranges (no tick math required)
 * - Setting graduationMarketCap in withRehypeDopplerHook() to define when the pool can graduate
 * - Live ETH price fetching for accurate market cap calculations
 *
 * IMPORTANT: graduationMarketCap is only available for rehype pools.
 * If you don't need rehype, omit graduationMarketCap - the pool will use the highest curve's tickUpper.
 *
 * graduationMarketCap behavior:
 * - Must be within the curve boundaries (>= lowest start, <= highest end)
 * - Converts to farTick internally for the pool configuration
 * - Reuses numerairePrice from withCurves() for the conversion
 *
 * Note: This is NOT a price cap - prices can exceed this value after graduation.
 * This is the market cap at which the pool can graduate (migrate or change status).
 */
import './env'

import { DopplerSDK, WAD, getAddresses } from '../src'
import { parseEther, createPublicClient, createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

// RehypeDopplerHook deployed on Base Sepolia
const REHYPE_DOPPLER_HOOK_ADDRESS = '0x636a756cee08775cc18780f52dd90b634f18ad37' as Address
const BUYBACK_DESTINATION = '0x0000000000000000000000000000000000000007' as Address

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
  const addresses = getAddresses(baseSepolia.id)

  // Fetch current ETH price from CoinGecko
  console.log('Fetching current ETH price from CoinGecko...')
  const ethPriceUsd = await getEthPriceUsd()
  console.log('Current ETH price: $' + ethPriceUsd.toLocaleString())

  // Get the Airlock owner address (required beneficiary with minimum 5% shares)
  const airlockOwnerAbi = [
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }
  ] as const

  const airlockOwner = await publicClient.readContract({
    address: addresses.airlock,
    abi: airlockOwnerAbi,
    functionName: 'owner',
  }) as Address

  // Beneficiaries for fee collection (required for rehype)
  const beneficiaries = [
    { beneficiary: BUYBACK_DESTINATION, shares: 950_000_000_000_000_000n }, // 95%
    { beneficiary: airlockOwner, shares: 50_000_000_000_000_000n },          // 5%
  ]

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
      numeraire: addresses.weth,
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
      beneficiaries,
    })
    // Configure rehype with graduationMarketCap
    // graduationMarketCap is rehype-only - it uses numerairePrice from withCurves()
    .withRehypeDopplerHook({
      hookAddress: REHYPE_DOPPLER_HOOK_ADDRESS,
      buybackDestination: BUYBACK_DESTINATION,
      customFee: 3000, // 0.3%
      assetBuybackPercentWad: WAD / 4n,      // 25%
      numeraireBuybackPercentWad: WAD / 4n,  // 25%
      beneficiaryPercentWad: WAD / 4n,       // 25%
      lpPercentWad: WAD / 4n,                // 25%
      // Set the graduation market cap at $40M (must be within curve boundaries)
      // This uses numerairePrice from withCurves() to convert to tick
      graduationMarketCap: 40_000_000, // $40M graduation target
    })
    .withVesting({
      duration: BigInt(365 * 24 * 60 * 60), // 1 year vesting
      cliffDuration: 0,
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
    .withNoOpMigrator(addresses.noOpMigrator!)
    .build()

  console.log('\nMulticurve Configuration:')
  console.log('  Token:', params.token.name, '(' + params.token.symbol + ')')
  console.log('  Curves:', params.pool.curves.length)
  console.log('  Far tick (from graduationMarketCap):', params.dopplerHook?.farTick)

  console.log('\nMarket Cap Targets:')
  console.log('  Launch price: $500,000 market cap')
  console.log('  Highest curve end: $50,000,000')
  console.log('  Graduation target: $40,000,000')

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

    console.log('\nThe pool can graduate when it reaches $40M market cap.')
    console.log('After graduation, prices can continue to rise.')
  } catch (error) {
    console.error('\nError creating multicurve:', error)
    process.exit(1)
  }
}

main()
