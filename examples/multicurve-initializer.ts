/**
 * Example: Create a Multicurve Auction using the V4 Multicurve Initializer
 *
 * This example demonstrates:
 * - Seeding a Uniswap V4 pool with multiple curves in a single initializer
 * - Using the low / medium / high market cap presets for curve distributions
 * - Choosing a standard migration path (V2 in this example)
 *
 * For lockable beneficiaries with NoOp migration, see:
 * - examples/multicurve-lockable-beneficiaries.ts
 */
import './env'

import { DopplerSDK, FEE_TIERS, WAD } from '../src'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

async function main() {
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: baseSepolia, transport: http(rpcUrl), account })

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: baseSepolia.id })

  // Build multicurve initializer parameters
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({ name: 'TEST MULTICURVE', symbol: 'TMC', tokenURI: 'ipfs://token.json' })
    .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 900_000n * WAD, numeraire: '0x4200000000000000000000000000000000000006' }) // WETH on Base
    .withMarketCapPresets({
      fee: FEE_TIERS.LOW, // defaults to 500 (0.05%) and tickSpacing 10
      // presets: ['medium', 'high'], // select a subset of tiers if desired
      // overrides: { high: { shares: WAD / 2n } }, // tweak ticks/positions/shares per tier
      // beneficiaries: [ { beneficiary: account.address, shares: WAD / 20n } ], // optional fee lockers
    })
    .withGovernance({ type: 'default' })
    // Choose any supported migration (V2, V3, or V4). Using V2 for simplicity.
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build()

  // Create the multicurve pool + token
  // Note: createMulticurve internally simulates first, ensuring consistent addresses
  const result = await sdk.factory.createMulticurve(params)
  console.log('✅ Multicurve created')
  console.log('Token address:', result.tokenAddress)
  console.log('Pool ID:', result.poolId)
  console.log('Transaction:', result.transactionHash)
  
  // If you need to preview the address BEFORE executing, use simulate().execute():
  // const simulation = await sdk.factory.simulateCreateMulticurve(params)
  // console.log('Predicted:', simulation.tokenAddress)
  // const result = await simulation.execute()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
