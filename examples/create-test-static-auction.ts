import './env'
import { parseEther, createWalletClient, createPublicClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { StaticAuctionBuilder, CHAIN_IDS, DopplerSDK } from '../src'

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
  const tokenName = `TEST ${numeraireName} Static ${Date.now()}`
  const tokenSymbol = 'TEST'
  const initialSupply = parseEther('1000000000') // 1 billion tokens
  const numTokensToSell = parseEther('850000000') // 850 million to sell

  // Market cap configuration
  const startMarketCap = 100_000 // $100k start
  const endMarketCap = 10_000_000 // $10M end

  console.log('============================================================')
  console.log('Creating Test Static Auction')
  console.log('============================================================')
  console.log(`Numeraire: ${numeraireName} (${numeraire})`)
  console.log(`Numeraire Price: $${numerairePrice}`)
  console.log(`Numeraire Decimals: ${numeraireDecimals}`)
  console.log(`Start Market Cap: $${startMarketCap.toLocaleString()}`)
  console.log(`End Market Cap: $${endMarketCap.toLocaleString()}`)
  console.log(`User Address: ${userAddress}`)
  console.log('')
  console.log(`Token Name: ${tokenName}`)
  console.log(`Token Symbol: ${tokenSymbol}`)
  console.log('')

  // Build the static auction configuration
  const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
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
      marketCap: { start: startMarketCap, end: endMarketCap },
      numerairePrice,
      numeraireDecimals,
    })
    .withMigration({ type: 'uniswapV2' })
    .withGovernance({ type: 'noOp' })
    .withUserAddress(userAddress)

  const params = builder.build()

  console.log('--- Pool Parameters ---')
  console.log(`Start Tick: ${params.pool.startTick}`)
  console.log(`End Tick: ${params.pool.endTick}`)
  console.log(`Fee: ${params.pool.fee}`)
  console.log(`Num Positions: ${params.pool.numPositions}`)
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
    const simulation = await sdk.factory.simulateCreateStaticAuction(params)

    console.log('--- Simulation Result ---')
    console.log(`Token Address: ${simulation.asset}`)
    console.log(`Pool Address: ${simulation.pool}`)
    console.log('')
    console.log('Ready to deploy. Set DRY_RUN=false to execute.')
    console.log('')

    // Check if we should execute
    const dryRun = process.env.DRY_RUN !== 'false'

    if (dryRun) {
      console.log('DRY RUN - No transaction executed')
      console.log(`To execute: DRY_RUN=false pnpx tsx examples/create-test-static-auction.ts ${useUsdc ? '--usdc' : '--eth'}`)
    } else {
      console.log('Executing transaction...')
      const result = await simulation.execute()
      console.log('')
      console.log('--- Transaction Result ---')
      console.log(`Transaction Hash: ${result.transactionHash}`)
      console.log(`Token Address: ${result.tokenAddress}`)
      console.log(`Pool Address: ${result.poolAddress}`)
    }
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

main().catch(console.error)
