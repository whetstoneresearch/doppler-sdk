/**
 * Static Auction with Lockable Beneficiaries (V3)
 *
 * This example demonstrates how to create a V3 static auction with fee streaming
 * to configured beneficiaries. When beneficiaries are provided, the pool enters
 * a "Locked" state where:
 *
 * - Liquidity cannot be migrated (pool stays locked permanently)
 * - Trading fees accumulate in the pool
 * - Anyone can call collectFees() to distribute fees to beneficiaries
 * - Fees are distributed proportionally according to configured shares
 *
 * Use this pattern when you want to:
 * - Create a permanent liquidity pool with fee revenue sharing
 * - Distribute trading fees to multiple parties (team, DAO, protocol)
 * - Lock liquidity without the ability to migrate it later
 *
 * IMPORTANT:
 * - Shares must sum to exactly WAD (1e18 = 100%)
 * - Protocol owner (Airlock.owner()) must be included with at least 5% shares
 * - Beneficiaries are automatically sorted by address by the SDK
 * - Use withMigration({ type: 'noOp' }) when using beneficiaries
 */

import { DopplerSDK, getAirlockOwner, WAD } from '../src'
import { parseEther, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// Configuration
const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org'

if (!privateKey) {
  throw new Error('PRIVATE_KEY environment variable must be set')
}

const account = privateKeyToAccount(privateKey)

async function createStaticAuctionWithBeneficiaries() {
  // Create viem clients
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  })

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account: account,
  })

  // Initialize the SDK
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  })

  // Get the protocol owner address (required beneficiary with min 5%)
  const protocolOwner = await getAirlockOwner(publicClient, baseSepolia.id)
  console.log('Protocol owner:', protocolOwner)

  // Define beneficiaries with shares that sum to WAD (1e18 = 100%)
  //
  // IMPORTANT CONSTRAINTS:
  // 1. Shares must sum to exactly WAD (1e18)
  // 2. Protocol owner must receive at least 5% (WAD / 20)
  // 3. Each beneficiary must have shares > 0
  // 4. SDK will automatically sort by address (ascending)
  const beneficiaries = [
    {
      beneficiary: protocolOwner,
      shares: parseEther('0.05'), // 5% to protocol (minimum required)
    },
    {
      beneficiary: account.address,
      shares: parseEther('0.45'), // 45% to creator
    },
    {
      beneficiary: '0x0000000000000000000000000000000000000001', // Example: DAO treasury
      shares: parseEther('0.50'), // 50% to treasury
    },
  ]

  // Verify shares sum to 100%
  const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n)
  if (totalShares !== WAD) {
    throw new Error(`Shares must sum to WAD (${WAD}), got ${totalShares}`)
  }
  console.log('Total shares:', totalShares, '(WAD:', WAD, ')')

  // Configure the static auction with beneficiaries
  const params = sdk
    .buildStaticAuction()
    .tokenConfig({
      name: 'Lockable Token',
      symbol: 'LOCK',
      tokenURI: 'https://example.com/token-metadata.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    .poolByTicks({
      startTick: 174960, // fee 3000 → tickSpacing 60, ticks must be multiples of 60
      endTick: 225000,
      fee: 3000, // 0.3% fee tier - fees accumulate for beneficiaries
    })
    // Add beneficiaries for fee streaming
    // The pool will be locked and fees will be distributed to these addresses
    .withBeneficiaries(beneficiaries)
    // Use NoOp migration since the pool is locked (cannot migrate)
    .withMigration({ type: 'noOp' })
    .withGovernance({ type: 'default' })
    .withUserAddress(account.address)
    .build()

  console.log('\n=== Static Auction Configuration ===')
  console.log('Token name:', params.token.name)
  console.log('Token symbol:', (params.token as { symbol: string }).symbol)
  console.log('Initial supply:', params.sale.initialSupply)
  console.log('Tokens to sell:', params.sale.numTokensToSell)
  console.log('Pool fee:', params.pool.fee, '(', params.pool.fee / 10000, '%)')
  console.log('Start tick:', params.pool.startTick)
  console.log('End tick:', params.pool.endTick)
  console.log('Migration type:', params.migration.type)
  console.log('\nBeneficiaries:')
  for (const b of params.pool.beneficiaries ?? []) {
    const percentage = (Number(b.shares) / Number(WAD)) * 100
    console.log(`  ${b.beneficiary}: ${percentage}%`)
  }

  // Simulate the creation to get predicted addresses
  console.log('\n=== Simulating Creation ===')
  const { asset, pool, gasEstimate } = await sdk.factory.simulateCreateStaticAuction(params)
  console.log('Predicted token address:', asset)
  console.log('Predicted pool address:', pool)
  console.log('Gas estimate:', gasEstimate?.toString())

  // Uncomment to actually create the auction:
  // const result = await sdk.factory.createStaticAuction(params)
  // console.log('\n=== Created Successfully ===')
  // console.log('Token address:', result.tokenAddress)
  // console.log('Pool address:', result.poolAddress)
  // console.log('Transaction hash:', result.transactionHash)
  //
  // // IMPORTANT: Save these addresses!
  // // You'll need the pool address to collect fees later
  // console.log('\n=== Fee Collection ===')
  // console.log('To collect fees later, call the initializer contract:')
  // console.log(`  initializer.collectFees("${result.poolAddress}")`)
}

// Example: How to collect fees from a locked pool
async function collectFeesExample(poolAddress: `0x${string}`) {
  // This is a simplified example showing the concept.
  // In practice, you would use the actual initializer contract.
  console.log('\n=== Collecting Fees ===')
  console.log('Pool address:', poolAddress)
  console.log('')
  console.log('To collect fees from a locked V3 pool:')
  console.log('1. Get the V3 initializer contract address')
  console.log('2. Call initializer.collectFees(poolAddress)')
  console.log('3. Fees are automatically distributed to all beneficiaries')
  console.log('')
  console.log('Note: Anyone can call collectFees(), but only beneficiaries receive fees.')
}

// Main entry point
async function main() {
  try {
    await createStaticAuctionWithBeneficiaries()

    // Example of fee collection (replace with actual pool address)
    // await collectFeesExample('0x...')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
