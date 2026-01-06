/**
 * Example: Create a Static Auction using Market Cap Range
 *
 * This example demonstrates:
 * - Configuring a V3 static auction using dollar-denominated market cap targets
 * - Fetching live ETH price from CoinGecko for accurate market cap calculations
 * - Auto-detection of token ordering from numeraire address
 * - Simplified API that converts market cap to ticks internally
 *
 * Key requirement: saleConfig() must be called before withMarketCapRange()
 */
import './env'

import { DopplerSDK, getAirlockOwner } from '../src'
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

  const airlockOwner = await getAirlockOwner(publicClient)

  // Fetch current ETH price from CoinGecko
  console.log('Fetching current ETH price from CoinGecko...')
  const ethPriceUsd = await getEthPriceUsd()
  console.log(`Current ETH price: $${ethPriceUsd.toLocaleString()}`)
  console.log('')

  // Build static auction using market cap range instead of raw ticks
  // This is the simplified, business-friendly API
  const params = sdk
    .buildStaticAuction()
    .tokenConfig({
      name: 'TEST',
      symbol: 'TEST',
      tokenURI: 'https://example.com/sample.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale (only 100M vested)
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    // Use market cap range - much more intuitive than raw ticks!
    .withMarketCapRange({
      marketCap: { start: 100_000, end: 10_000_000 }, // $100k to $10M fully diluted
      numerairePrice: ethPriceUsd, // Live ETH price from CoinGecko
      // Optional overrides (defaults shown):
      // fee: 10000,            // 1% fee tier (default for V3)
      // numPositions: 15,      // Number of LP positions
      // maxShareToBeSold: parseEther('0.35'), // 35% max per position
      // tokenDecimals: 18,
      // numeraireDecimals: 18,
    })
    .withVesting({
      duration: BigInt(365 * 24 * 60 * 60), // 1 year vesting
      cliffDuration: 0,
    })
    .withGovernance({ type: 'default' })
    .withMigration({
      type: 'uniswapV4',
      fee: 3000,
      tickSpacing: 60,
      streamableFees: {
        lockDuration: 365 * 24 * 60 * 60,
        beneficiaries: [
          { beneficiary: account.address, shares: parseEther('0.95') }, // 95%
          { beneficiary: airlockOwner, shares: parseEther('0.05') }, // 5% to protocol
        ],
      },
    })
    .withUserAddress(account.address)
    .build()

  console.log('Build params:')
  console.log(JSON.stringify(params, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))
  console.log('')

  console.log('Creating static auction with market cap targets...')
  console.log('Token:', params.token.name, `(${params.token.symbol})`)
  console.log(`Market cap range: $100,000 → $10,000,000 (at ETH = $${ethPriceUsd.toLocaleString()})`)
  console.log('Computed ticks:', params.pool.startTick, '→', params.pool.endTick)

  try {
    const result = await sdk.factory.createStaticAuction(params)

    console.log('\n✅ Static auction created successfully!')
    console.log('Pool address:', result.poolAddress)
    console.log('Token address:', result.tokenAddress)
    console.log('Transaction:', result.transactionHash)

    // Monitor the auction
    const auction = await sdk.getStaticAuction(result.poolAddress)
    const hasGraduated = await auction.hasGraduated()

    if (hasGraduated) {
      console.log('\n🎯 Auction has graduated - ready for migration!')
    } else {
      console.log('\nAuction is active. Will graduate when sufficient tokens are sold.')
    }
  } catch (error) {
    console.error('\n❌ Error creating auction:', error)
    process.exit(1)
  }
}

main()

