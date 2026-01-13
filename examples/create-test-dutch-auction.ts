/**
 * Create Test Dutch Auction
 *
 * Creates a V4 dutch auction token for testing market cap calculations.
 * Uses symbol "TEST" so UI filters it out.
 *
 * Usage:
 *   pnpx tsx examples/create-test-dutch-auction.ts --eth     # ETH numeraire
 *   pnpx tsx examples/create-test-dutch-auction.ts --usdc    # USDC numeraire
 *
 * Environment variables (from .env.local or .env):
 *   PRIVATE_KEY - Wallet private key for signing transactions
 *   RPC_URL - Base mainnet RPC URL (optional, defaults to public RPC)
 */
import './env'

import { parseEther, createWalletClient, createPublicClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { DynamicAuctionBuilder, CHAIN_IDS, DopplerSDK } from '../src'

// Base mainnet addresses
const WETH_BASE = '0x4200000000000000000000000000000000000006' as Address
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address

// Default configuration
const DEFAULT_TOTAL_SUPPLY = parseEther('1000000000') // 1 billion tokens
const DEFAULT_NUM_TOKENS_TO_SELL = parseEther('600000000') // 600 million (60%)
const DEFAULT_START_MARKET_CAP = 500_000 // $500k
const DEFAULT_MIN_MARKET_CAP = 1_000 // $1k floor
const DEFAULT_MIN_PROCEEDS = parseEther('0.1') // 0.1 ETH or USDC equivalent
const DEFAULT_MAX_PROCEEDS = parseEther('10') // 10 ETH or USDC equivalent

interface CreateTestTokenParams {
  numeraire: 'eth' | 'usdc'
  privateKey: string
  rpcUrl?: string
  startMarketCap?: number
  minMarketCap?: number
}

async function createTestDutchAuction(params: CreateTestTokenParams) {
  const {
    numeraire,
    privateKey,
    rpcUrl = 'https://mainnet.base.org',
    startMarketCap = DEFAULT_START_MARKET_CAP,
    minMarketCap = DEFAULT_MIN_MARKET_CAP,
  } = params

  // Setup wallet
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  })
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  })

  // Determine numeraire config
  const isUSDC = numeraire === 'usdc'
  const numeraireAddress = isUSDC ? USDC_BASE : WETH_BASE
  const numerairePrice = isUSDC ? 1 : 3000 // $1 for USDC, ~$3000 for ETH
  const numeraireDecimals = isUSDC ? 6 : 18

  console.log('='.repeat(60))
  console.log('Creating Test Dutch Auction')
  console.log('='.repeat(60))
  console.log(`Numeraire: ${numeraire.toUpperCase()} (${numeraireAddress})`)
  console.log(`Numeraire Price: $${numerairePrice}`)
  console.log(`Numeraire Decimals: ${numeraireDecimals}`)
  console.log(`Start Market Cap: $${startMarketCap.toLocaleString()}`)
  console.log(`Min Market Cap: $${minMarketCap.toLocaleString()}`)
  console.log(`User Address: ${account.address}`)
  console.log('')

  // Generate unique token name with timestamp
  const timestamp = Date.now()
  const tokenName = `TEST ${numeraire.toUpperCase()} Dutch ${timestamp}`
  const tokenSymbol = 'TEST' // Always TEST so UI filters it out
  const tokenURI = `ipfs://test-dutch-${numeraire}-${timestamp}`

  console.log(`Token Name: ${tokenName}`)
  console.log(`Token Symbol: ${tokenSymbol}`)
  console.log('')

  // Build the auction config
  const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
    .tokenConfig({
      name: tokenName,
      symbol: tokenSymbol,
      tokenURI,
      yearlyMintRate: 0n,
    })
    .saleConfig({
      initialSupply: DEFAULT_TOTAL_SUPPLY,
      numTokensToSell: DEFAULT_NUM_TOKENS_TO_SELL,
      numeraire: numeraireAddress,
    })
    .withMarketCapRange({
      marketCap: { start: startMarketCap, min: minMarketCap },
      numerairePrice,
      numeraireDecimals,
      minProceeds: DEFAULT_MIN_PROCEEDS,
      maxProceeds: DEFAULT_MAX_PROCEEDS,
      numPdSlugs: 15,
    })
    .withUserAddress(account.address)
    .withMigration({ type: 'uniswapV2' })
    .withGovernance({ type: 'noOp' })
    .withTime({ blockTimestamp: Math.floor(Date.now() / 1000) + 60 }) // Start in 1 minute

  const auctionParams = builder.build()

  console.log('--- Auction Parameters ---')
  console.log(`Start Tick: ${auctionParams.auction.startTick}`)
  console.log(`End Tick: ${auctionParams.auction.endTick}`)
  console.log(`Duration: ${auctionParams.auction.duration}s`)
  console.log(`Epoch Length: ${auctionParams.auction.epochLength}s`)
  console.log(`Gamma: ${auctionParams.auction.gamma}`)
  console.log('')

  // Create SDK instance
  const sdk = new DopplerSDK({
    chainId: CHAIN_IDS.BASE,
    publicClient,
    walletClient,
  })

  console.log('Simulating transaction...')
  const simulation = await sdk.factory.simulateCreateDynamicAuction(auctionParams)

  console.log('')
  console.log('--- Simulation Result ---')
  console.log(`Token Address: ${simulation.tokenAddress}`)
  console.log(`Hook Address: ${simulation.hookAddress}`)
  console.log('')

  // Prompt for confirmation
  console.log('Ready to deploy. Set DRY_RUN=false to execute.')

  if (process.env.DRY_RUN === 'false') {
    console.log('Executing transaction...')
    const result = await sdk.factory.createDynamicAuction(auctionParams)
    console.log('')
    console.log('--- Deployment Result ---')
    console.log(`Transaction Hash: ${result.transactionHash}`)
    console.log(`Token Address: ${simulation.tokenAddress}`)
    console.log('')
    console.log('View on BaseScan:')
    console.log(`https://basescan.org/tx/${result.transactionHash}`)
  } else {
    console.log('')
    console.log('DRY RUN - No transaction executed')
    console.log('To execute: DRY_RUN=false pnpx tsx examples/create-test-dutch-auction.ts --' + numeraire)
  }

  return {
    tokenAddress: simulation.tokenAddress,
    hookAddress: simulation.hookAddress,
    params: auctionParams,
  }
}

// Parse CLI args
const args = process.argv.slice(2)
const numeraire = args.includes('--usdc') ? 'usdc' : 'eth'

// Check for required env vars
const privateKey = process.env.PRIVATE_KEY
if (!privateKey) {
  console.error('Error: PRIVATE_KEY environment variable required')
  console.error('')
  console.error('Usage:')
  console.error('  PRIVATE_KEY=0x... pnpx tsx examples/create-test-dutch-auction.ts --eth')
  console.error('  PRIVATE_KEY=0x... pnpx tsx examples/create-test-dutch-auction.ts --usdc')
  process.exit(1)
}

createTestDutchAuction({
  numeraire,
  privateKey,
  rpcUrl: process.env.RPC_URL,
}).catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
