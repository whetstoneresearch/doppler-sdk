/**
 * Example: Create a Multicurve Pool with RehypeDopplerHook
 *
 * This example demonstrates:
 * - Configuring a RehypeDopplerHook for advanced fee distribution
 * - Setting up asset/numeraire buybacks, beneficiary fees, and LP fees
 * - Using the DopplerHookInitializer with a whitelisted hook
 * - Power-user configuration with poolConfig() (raw ticks)
 *
 * RehypeDopplerHook enables:
 * - Custom swap fees (e.g., 0.3% instead of default)
 * - Fee distribution to multiple destinations:
 *   - Asset buyback: fees used to buy back the token
 *   - Numeraire buyback: fees kept as WETH
 *   - Beneficiaries: fee streaming to specified addresses
 *   - LPs: fees distributed to liquidity providers
 * - All percentages must sum to exactly WAD (1e18 = 100%)
 *
 * Prerequisites:
 * - The hook address must be whitelisted in the DopplerHookInitializer
 * - Beneficiaries must include the Airlock owner with >= 5% shares
 *
 * For easier configuration using market cap ranges (no tick math), see:
 * - examples/multicurve-rehype-by-marketcap.ts
 */
import './env'

import { DopplerSDK, WAD, getAddresses } from '../src'
import { createPublicClient, createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

// RehypeDopplerHook deployed on Base Sepolia
// This address must be whitelisted in the DopplerHookInitializer
const REHYPE_DOPPLER_HOOK_ADDRESS = '0x636a756cee08775cc18780f52dd90b634f18ad37' as Address

// Destination address for buyback tokens
const BUYBACK_DESTINATION = '0x0000000000000000000000000000000000000007' as Address

async function main() {
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: baseSepolia, transport: http(rpcUrl), account })

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: baseSepolia.id })
  const addresses = getAddresses(baseSepolia.id)

  // Get the Airlock owner address (required beneficiary with minimum 5% shares)
  // In production, query this via publicClient.readContract()
  const airlockOwnerAbi = [
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }
  ] as const

  const airlockOwner = await publicClient.readContract({
    address: addresses.airlock,
    abi: airlockOwnerAbi,
    functionName: 'owner',
  }) as Address

  console.log('Airlock owner:', airlockOwner)

  // Define beneficiaries for fee collection
  // IMPORTANT: Airlock owner must have >= 5% shares (WAD/20)
  const beneficiaries = [
    { beneficiary: BUYBACK_DESTINATION, shares: 950_000_000_000_000_000n }, // 95%
    { beneficiary: airlockOwner, shares: 50_000_000_000_000_000n },          // 5% (minimum required)
  ]

  // Build multicurve with RehypeDopplerHook
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'standard',
      name: 'RehypeHook Token',
      symbol: 'RHT',
      tokenURI: 'ipfs://rehype-hook-example'
    })
    .saleConfig({
      initialSupply: 1_000_000_000_000_000_000_000_000_000n, // 1 billion tokens
      numTokensToSell: 1_000_000_000_000_000_000_000_000_000n,
      numeraire: addresses.weth
    })
    // Power-user configuration with raw ticks
    .poolConfig({
      fee: 0,
      tickSpacing: 8,
      curves: Array.from({ length: 10 }, (_, i) => ({
        tickLower: i * 16_000,
        tickUpper: 240_000,
        numPositions: 10,
        shares: WAD / 10n, // 10% per curve
      })),
      farTick: 200_000, // Maximum tick for the pool
      beneficiaries,
    })
    // Configure the RehypeDopplerHook for fee distribution
    // All percentages must sum to exactly WAD (1e18 = 100%)
    .withRehypeDopplerHook({
      hookAddress: REHYPE_DOPPLER_HOOK_ADDRESS,
      buybackDestination: BUYBACK_DESTINATION,
      customFee: 3000, // 0.3% swap fee
      assetBuybackPercentWad: 200_000_000_000_000_000n,     // 20% - buy back the token
      numeraireBuybackPercentWad: 200_000_000_000_000_000n, // 20% - keep as WETH
      beneficiaryPercentWad: 300_000_000_000_000_000n,      // 30% - to beneficiaries
      lpPercentWad: 300_000_000_000_000_000n,               // 30% - to LPs
    })
    .withGovernance({ type: 'noOp' })
    // NoOp migration since we're using beneficiaries (pool stays locked)
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    // Override to use the DopplerHookInitializer
    .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
    .withNoOpMigrator(addresses.noOpMigrator!)
    .build()

  console.log('\nMulticurve Configuration:')
  console.log('  Token:', params.token.name, `(${params.token.symbol})`)
  console.log('  Curves:', params.pool.curves.length)
  console.log('  Far tick:', params.pool.farTick)
  console.log('  Beneficiaries:', params.pool.beneficiaries?.length)
  console.log('  Migration:', params.migration.type)

  console.log('\nRehypeDopplerHook Fee Distribution:')
  console.log('  Custom fee:', params.dopplerHook?.customFee, '(0.3%)')
  console.log('  Asset buyback:', '20%')
  console.log('  Numeraire buyback:', '20%')
  console.log('  Beneficiaries:', '30%')
  console.log('  LPs:', '30%')

  // Simulate to preview addresses
  console.log('\nSimulating...')
  const { tokenAddress, poolId, gasEstimate } = await sdk.factory.simulateCreateMulticurve(params)
  console.log('Simulation successful')
  console.log('  Predicted token address:', tokenAddress)
  console.log('  Predicted pool ID:', poolId)
  console.log('  Gas estimate:', gasEstimate?.toString())

  // Create the multicurve pool + token
  console.log('\nCreating multicurve with RehypeDopplerHook...')
  const result = await sdk.factory.createMulticurve(params)
  console.log('Multicurve created successfully!')
  console.log('  Token address:', result.tokenAddress)
  console.log('  Pool ID:', result.poolId)
  console.log('  Transaction:', result.transactionHash)

  console.log('\nFee Flow Summary:')
  console.log('  On each swap, 0.3% fee is collected and distributed:')
  console.log('  - 20% used to buy back', params.token.symbol)
  console.log('  - 20% kept as WETH (sent to buyback destination)')
  console.log('  - 30% streamed to beneficiaries')
  console.log('  - 30% distributed to liquidity providers')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
