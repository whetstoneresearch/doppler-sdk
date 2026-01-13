import './env'
import { parseEther, createWalletClient, createPublicClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { DynamicAuctionBuilder, CHAIN_IDS, DopplerSDK, DAY_SECONDS } from '../src'

// Base mainnet addresses
const WETH_BASE = '0x4200000000000000000000000000000000000006' as Address
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address

async function main() {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const userAddress = account.address

  // Parse arguments
  const args = process.argv.slice(2)
  const useUsdc = args.includes('--usdc')
  const numeraire = useUsdc ? USDC_BASE : WETH_BASE
  const numerairePrice = useUsdc ? 1 : 3000
  const numeraireDecimals = useUsdc ? 6 : 18
  const numeraireName = useUsdc ? 'USDC' : 'ETH'

  // Token configuration
  const tokenName = `TEST ${numeraireName} Dynamic ${Date.now()}`
  const tokenSymbol = 'TEST'
  const initialSupply = parseEther('1000000000') // 1 billion tokens
  const numTokensToSell = parseEther('500000000') // 500 million to sell

  // Market cap configuration (Dutch auction: start high, min is floor)
  const startMarketCap = 500_000 // $500k start (high price)
  const minMarketCap = 50_000   // $50k floor (low price)

  // Proceeds configuration
  const minProceeds = useUsdc ? 10_000n * 10n ** 6n : parseEther('10') // 10k USDC or 10 ETH
  const maxProceeds = useUsdc ? 500_000n * 10n ** 6n : parseEther('500') // 500k USDC or 500 ETH

  console.log('============================================================')
  console.log('Creating Test Dynamic Auction (Dutch Auction)')
  console.log('============================================================')
  console.log(`Numeraire: ${numeraireName} (${numeraire})`)
  console.log(`Numeraire Price: $${numerairePrice}`)
  console.log(`Numeraire Decimals: ${numeraireDecimals}`)
  console.log(`Start Market Cap: $${startMarketCap.toLocaleString()} (high price)`)
  console.log(`Min Market Cap: $${minMarketCap.toLocaleString()} (floor price)`)
  console.log(`User Address: ${userAddress}`)
  console.log('')
  console.log(`Token Name: ${tokenName}`)
  console.log(`Token Symbol: ${tokenSymbol}`)
  console.log('')

  // Build the dynamic auction configuration
  const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
    .tokenConfig({
      name: tokenName,
      symbol: tokenSymbol,
      tokenURI: 'https://example.com/token.json',
    })
    .saleConfig({
      initialSupply,
      numTokensToSell,
      numeraire,
    })
    .withMarketCapRange({
      marketCap: { start: startMarketCap, min: minMarketCap },
      numerairePrice,
      numeraireDecimals,
      minProceeds,
      maxProceeds,
      // Default settings:
      // fee: 10000 (1%)
      // tickSpacing: 30 (DOPPLER_MAX_TICK_SPACING)
      // duration: 7 days
      // epochLength: 12 hours
    })
    .withMigration({ type: 'uniswapV2' })
    .withGovernance({ type: 'noOp' })
    .withUserAddress(userAddress)

  const params = builder.build()

  console.log('--- Auction Parameters ---')
  console.log(`Start Tick: ${params.auction.startTick}`)
  console.log(`End Tick: ${params.auction.endTick}`)
  console.log(`Duration: ${params.auction.duration / DAY_SECONDS} days`)
  console.log(`Epoch Length: ${params.auction.epochLength / 3600} hours`)
  console.log(`Gamma: ${params.auction.gamma}`)
  console.log(`Fee: ${params.pool.fee}`)
  console.log(`Tick Spacing: ${params.pool.tickSpacing}`)
  console.log('')
  console.log('============================================================')
  console.log('VALIDATE AFTER DEPLOY: Look up token address in indexer')
  console.log('============================================================')
  console.log('')

  // Setup clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  })

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  })

  // Initialize SDK
  const sdk = new DopplerSDK({
    chainId: CHAIN_IDS.BASE,
    publicClient,
    walletClient,
  })

  console.log('Simulating transaction...')
  console.log('')

  try {
    const simulation = await sdk.factory.simulateCreateDynamicAuction(params)

    console.log('--- Simulation Result ---')
    console.log('')
    console.log(`  TOKEN ADDRESS: ${simulation.tokenAddress}`)
    console.log(`  Hook Address:  ${simulation.hookAddress}`)
    console.log(`  Pool ID:       ${simulation.poolId}`)
    console.log('')
    console.log('Ready to deploy. Set DRY_RUN=false to execute.')
    console.log('')

    // Check if we should execute
    const dryRun = process.env.DRY_RUN !== 'false'

    if (dryRun) {
      console.log('DRY RUN - No transaction executed')
      console.log(`To execute: DRY_RUN=false pnpx tsx examples/create-test-dynamic-auction.ts ${useUsdc ? '--usdc' : '--eth'}`)
    } else {
      console.log('Executing transaction...')
      const result = await simulation.execute()
      console.log('')
      console.log('--- Transaction Result ---')
      console.log(`Transaction Hash: ${result.transactionHash}`)
      console.log(`Token Address: ${result.tokenAddress}`)
      console.log(`Hook Address: ${result.hookAddress}`)
      console.log(`Pool ID: ${result.poolId}`)
    }
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

main().catch(console.error)
