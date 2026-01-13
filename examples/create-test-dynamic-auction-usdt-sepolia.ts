import './env'
import { parseEther, createWalletClient, createPublicClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { DynamicAuctionBuilder, CHAIN_IDS, DopplerSDK, DAY_SECONDS } from '../src'

// Base Sepolia addresses
const WETH_BASE_SEPOLIA = '0x4200000000000000000000000000000000000006' as Address
const USDT_BASE_SEPOLIA = '0x323e78f944a9a1fcf3a10efcc5319dbb0bb6e673' as Address

// V4 Migrator override for Base Sepolia
const BASE_SEPOLIA_V4_MIGRATOR = '0xf326d8cdb65a4ad334cfbdd7d3a3cb27be8b770d' as Address

async function main() {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const userAddress = account.address

  // USDT configuration - matching UI's useLaunchTokenV4.ts
  const numeraire = USDT_BASE_SEPOLIA
  const numerairePrice = 1  // USDT = $1
  const numeraireDecimals = 6  // USDT has 6 decimals

  // Token configuration
  const tokenName = `TEST USDT Dynamic ${Date.now()}`
  const tokenSymbol = 'TESTUSDT'
  const initialSupply = parseEther('1000000000') // 1 billion tokens
  const numTokensToSell = parseEther('600000000') // 600 million to sell (60%)

  // Market cap configuration (Dutch auction: start high, min is floor)
  // These match the UI defaults from useLaunchTokenV4.ts
  const startMarketCap = 500_000 // $500k start (high price)
  const minMarketCap = 1_000     // $1k floor (low price)

  // Proceeds configuration for USDT (6 decimals)
  const minProceeds = 2_000n * 10n ** 6n  // 2k USDT
  const maxProceeds = 4_000n * 10n ** 6n  // 4k USDT

  console.log('============================================================')
  console.log('Creating Test Dynamic Auction with USDT (Base Sepolia)')
  console.log('============================================================')
  console.log(`Numeraire: USDT (${numeraire})`)
  console.log(`Numeraire Price: $${numerairePrice}`)
  console.log(`Numeraire Decimals: ${numeraireDecimals}`)
  console.log(`Start Market Cap: $${startMarketCap.toLocaleString()} (high price)`)
  console.log(`Min Market Cap: $${minMarketCap.toLocaleString()} (floor price)`)
  console.log(`Min Proceeds: ${Number(minProceeds) / 10**6} USDT`)
  console.log(`Max Proceeds: ${Number(maxProceeds) / 10**6} USDT`)
  console.log(`User Address: ${userAddress}`)
  console.log('')
  console.log(`Token Name: ${tokenName}`)
  console.log(`Token Symbol: ${tokenSymbol}`)
  console.log(`Total Supply: ${Number(initialSupply / 10n**18n).toLocaleString()} tokens`)
  console.log(`Tokens to Sell: ${Number(numTokensToSell / 10n**18n).toLocaleString()} tokens (60%)`)
  console.log('')

  // Build the dynamic auction configuration
  // This matches the UI's buildDynamicAuctionConfig function
  const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE_SEPOLIA)
    .tokenConfig({
      name: tokenName,
      symbol: tokenSymbol,
      tokenURI: 'https://example.com/token.json',
      yearlyMintRate: 0n,
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
      numPdSlugs: 15,  // Default from UI
      // Default duration: 7 days
      // Default epochLength: 12 hours
    })
    .withMigration({
      type: 'uniswapV4',
      fee: 10000,  // 1%
      tickSpacing: 30,
    })
    .withGovernance({ type: 'noOp' })
    .withUserAddress(userAddress)
    .withV4Migrator(BASE_SEPOLIA_V4_MIGRATOR)

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
  console.log('--- Pool Key ---')
  console.log(`Currency 0: ${params.pool.poolKey.currency0}`)
  console.log(`Currency 1: ${params.pool.poolKey.currency1}`)
  console.log('')

  // Setup clients
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  })

  // Initialize SDK
  const sdk = new DopplerSDK({
    chainId: CHAIN_IDS.BASE_SEPOLIA,
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
      console.log('')
      console.log('To execute:')
      console.log('  DRY_RUN=false pnpx tsx examples/create-test-dynamic-auction-usdt-sepolia.ts')
      console.log('')
      console.log('After execution, validate market cap with:')
      console.log(`  pnpx tsx examples/validate-market-cap-indexer.ts ${simulation.tokenAddress} --chain baseSepolia`)
    } else {
      console.log('Executing transaction...')
      const result = await simulation.execute()
      console.log('')
      console.log('============================================================')
      console.log('--- Transaction Result ---')
      console.log('============================================================')
      console.log(`Transaction Hash: ${result.transactionHash}`)
      console.log(`Token Address: ${result.tokenAddress}`)
      console.log(`Hook Address: ${result.hookAddress}`)
      console.log(`Pool ID: ${result.poolId}`)
      console.log('')
      console.log('Next steps:')
      console.log('1. Wait 30-60 seconds for indexer to process')
      console.log('2. Validate market cap:')
      console.log(`   pnpx tsx examples/validate-market-cap-indexer.ts ${result.tokenAddress} --chain baseSepolia`)
    }
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

main().catch(console.error)
