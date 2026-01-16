/**
 * Example: Create a Multicurve Pool with RehypeDopplerHook using Market Cap Ranges
 *
 * This example demonstrates the recommended way to configure a RehypeDopplerHook:
 * - Using withCurves() with market cap ranges (no tick math required)
 * - Setting graduationMarketCap to define when the pool can graduate
 * - Configuring advanced fee distribution (buybacks, beneficiaries, LPs)
 * - Live ETH price fetching for accurate market cap calculations
 *
 * This is the easiest path for most users who want custom fee distribution
 * without dealing with raw tick values.
 *
 * For power-user configuration with raw ticks, see:
 * - examples/multicurve-with-rehype-hook.ts
 */
import './env'

import { DopplerSDK, getAddresses } from '../src'
import { parseEther, createPublicClient, createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

// RehypeDopplerHook deployed on Base Sepolia
const REHYPE_DOPPLER_HOOK_ADDRESS = '0x636a756cee08775cc18780f52dd90b634f18ad37' as Address

// Destination address for buyback tokens
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

  // Fetch current ETH price
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

  console.log('Airlock owner:', airlockOwner)

  // Define beneficiaries (required for RehypeDopplerHook)
  // Airlock owner must have >= 5% shares
  const beneficiaries = [
    { beneficiary: BUYBACK_DESTINATION, shares: 950_000_000_000_000_000n }, // 95%
    { beneficiary: airlockOwner, shares: 50_000_000_000_000_000n },          // 5%
  ]

  // Build multicurve using market cap ranges + RehypeDopplerHook
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Rehype MarketCap Token',
      symbol: 'RMC',
      tokenURI: 'ipfs://rehype-marketcap-example',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale
      numeraire: addresses.weth,
    })
    // Easy mode: use market cap ranges instead of raw ticks
    .withCurves({
      numerairePrice: ethPriceUsd,
      curves: [
        {
          marketCap: { start: 500_000, end: 1_500_000 }, // $500k - $1.5M
          numPositions: 10,
          shares: parseEther('0.3'), // 30%
        },
        {
          marketCap: { start: 1_000_000, end: 5_000_000 }, // $1M - $5M
          numPositions: 15,
          shares: parseEther('0.4'), // 40%
        },
        {
          marketCap: { start: 4_000_000, end: 50_000_000 }, // $4M - $50M
          numPositions: 10,
          shares: parseEther('0.3'), // 30%
        },
      ],
      beneficiaries, // Required for RehypeDopplerHook
    })
    // Configure fee distribution (must sum to 100%)
    // graduationMarketCap uses numerairePrice from withCurves() for tick conversion
    .withRehypeDopplerHook({
      hookAddress: REHYPE_DOPPLER_HOOK_ADDRESS,
      buybackDestination: BUYBACK_DESTINATION,
      customFee: 3000, // 0.3% swap fee
      assetBuybackPercentWad: 200_000_000_000_000_000n,     // 20%
      numeraireBuybackPercentWad: 200_000_000_000_000_000n, // 20%
      beneficiaryPercentWad: 300_000_000_000_000_000n,      // 30%
      lpPercentWad: 300_000_000_000_000_000n,               // 30%
      graduationMarketCap: 40_000_000, // $40M graduation target (within curve range)
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
  console.log('  Beneficiaries:', params.pool.beneficiaries?.length)

  console.log('\nMarket Cap Targets:')
  console.log('  Launch price: $500,000')
  console.log('  Highest curve end: $50,000,000')
  console.log('  Graduation target: $40,000,000 (before max, demonstrating flexibility)')

  console.log('\nRehypeDopplerHook Fee Distribution:')
  console.log('  Custom fee: 3000 (0.3%)')
  console.log('  Asset buyback: 20%')
  console.log('  Numeraire buyback: 20%')
  console.log('  Beneficiaries: 30%')
  console.log('  LPs: 30%')

  try {
    // Simulate to preview addresses
    const simulation = await sdk.factory.simulateCreateMulticurve(params)
    console.log('\nSimulation successful:')
    console.log('  Predicted token:', simulation.tokenAddress)
    console.log('  Predicted pool ID:', simulation.poolId)
    console.log('  Gas estimate:', simulation.gasEstimate?.toString())

    // Execute
    const result = await simulation.execute()

    console.log('\nMulticurve created successfully!')
    console.log('  Token address:', result.tokenAddress)
    console.log('  Pool ID:', result.poolId)
    console.log('  Transaction:', result.transactionHash)

    console.log('\nFee Flow Summary:')
    console.log('  On each swap, 0.3% fee is collected and distributed:')
    console.log('  - 20% used to buy back ' + params.token.symbol)
    console.log('  - 20% kept as WETH (sent to buyback destination)')
    console.log('  - 30% streamed to beneficiaries')
    console.log('  - 30% distributed to liquidity providers')
  } catch (error) {
    console.error('\nError creating multicurve:', error)
    process.exit(1)
  }
}

main()
