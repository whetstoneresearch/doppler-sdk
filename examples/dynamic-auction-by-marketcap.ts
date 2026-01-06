/**
 * Example: Create a Dynamic Auction using Market Cap Range
 *
 * This example demonstrates:
 * - Configuring a V4 dynamic auction using dollar-denominated market cap targets
 * - Fetching live ETH price from CoinGecko for accurate market cap calculations
 * - The gradual Dutch auction mechanics with epochs
 * - Auto-detection of token ordering from numeraire address
 *
 * Key requirements:
 * - saleConfig() must be called before withMarketCapRange()
 * - tickSpacing is automatically derived from fee (no need to call poolConfig())
 */

import { DopplerSDK, DAY_SECONDS } from '../src'
import { parseEther, formatEther, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];

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

  // Build dynamic auction using market cap range instead of raw ticks
  // Note: saleConfig() must be called before withMarketCapRange()
  // tickSpacing is automatically derived from fee (no poolConfig() needed!)
  const params = sdk
    .buildDynamicAuction()
    .tokenConfig({
      name: 'TEST',
      symbol: 'TEST',
      tokenURI: 'https://example.com/sample.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('500000000'), // 500 million for sale
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    // Use market cap range - converts to ticks internally
    // Dutch auction: starts at high price (start), descends to floor (min)
    .withMarketCapRange({
      marketCap: { start: 5_000_000, min: 500_000 }, // $5M start, $500k floor
      numerairePrice: ethPriceUsd, // Live ETH price from CoinGecko
      minProceeds: parseEther('100'), // Min 100 ETH to graduate
      maxProceeds: parseEther('5000'), // Cap at 5000 ETH
      fee: 3000,                      // 0.3% fee tier (tickSpacing=60 derived automatically)
      numPdSlugs: 15,                 // Price discovery slugs
      // Optional overrides (defaults shown):
      // duration: 7 * DAY_SECONDS,   // 7 day auction
      // epochLength: 3600,           // 1 hour epochs
      // gamma: <auto-calculated>,    // Tick decay per epoch
      // tokenDecimals: 18,
      // numeraireDecimals: 18,
    })
    .withMigration({
      type: 'uniswapV4',
      fee: 3000,
      tickSpacing: 60,  // Post-migration pool tickSpacing (standard Uniswap V4, no MAX_TICK_SPACING constraint)
      streamableFees: {
        lockDuration: 365 * 24 * 60 * 60, // 1 year
        beneficiaries: [
          { beneficiary: account.address, shares: parseEther('0.95') }, // 95%
          await sdk.getAirlockBeneficiary(), // 5% to protocol (default)
        ],
      },
    })
    .withGovernance({ type: 'default' })
    .withUserAddress(account.address)
    .build()

  console.log('Build params:')
  console.log(JSON.stringify(params, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))
  console.log('')

  console.log('Creating dynamic auction with market cap targets...')
  console.log('Token:', params.token.name, `(${params.token.symbol})`)
  console.log(`Market cap range: $5,000,000 start → $500,000 floor (at ETH = $${ethPriceUsd.toLocaleString()})`)
  console.log('Selling:', formatEther(params.sale.numTokensToSell), 'tokens')
  console.log('Computed ticks:', params.auction.startTick, '→', params.auction.endTick)
  console.log('Duration:', params.auction.duration / DAY_SECONDS, 'days')
  console.log('Epochs:', params.auction.duration / params.auction.epochLength, 'total')
  console.log('Proceeds range:', formatEther(params.auction.minProceeds), '→', formatEther(params.auction.maxProceeds), 'ETH')

  try {
    const result = await sdk.factory.createDynamicAuction(params)

    console.log('\n✅ Dynamic auction created successfully!')
    console.log('Hook address:', result.hookAddress)
    console.log('Token address:', result.tokenAddress)
    console.log('Pool ID:', result.poolId)
    console.log('Transaction:', result.transactionHash)

    // Monitor the auction
    const auction = await sdk.getDynamicAuction(result.hookAddress)

    // Wait for the transaction to be confirmed before reading contract state
    await auction.waitForDeployment(result.transactionHash as `0x${string}`)

    const hookInfo = await auction.getHookInfo()
    console.log('\nAuction Status:')
    console.log('Current epoch:', hookInfo.currentEpoch)
    console.log('Total proceeds:', formatEther(hookInfo.totalProceeds), 'ETH')
    console.log('Tokens sold:', formatEther(hookInfo.totalTokensSold))

    const hasEndedEarly = await auction.hasEndedEarly()
    if (hasEndedEarly) {
      console.log('\n🎯 Auction ended early - reached max proceeds!')
    } else {
      console.log('\nAuction is active. Will end when:')
      console.log('- All epochs complete (7 days)')
      console.log('- OR max proceeds reached (5000 ETH)')
    }

    const hasGraduated = await auction.hasGraduated()
    console.log('\nHas graduated:', hasGraduated)
  } catch (error) {
    console.error('\n❌ Error creating auction:', error)
    process.exit(1)
  }
}

main()

