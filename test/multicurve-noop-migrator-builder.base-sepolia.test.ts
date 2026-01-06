import { describe, it, expect, beforeAll } from 'vitest'
import { type Address } from 'viem'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'
import { getTestClient, hasRpcUrl, getRpcEnvVar } from './utils'

/**
 * This test demonstrates using migration type 'noOp' with the MulticurveBuilder
 * to configure NoOpMigrator for lockable beneficiaries.
 *
 * The NoOpMigrator is used when you want the multicurve initializer to handle
 * beneficiaries directly without any post-auction migration logic.
 *
 * Use .withMigration({ type: 'noOp' }) when using lockable beneficiaries.
 */
describe('Multicurve Builder with NoOpMigrator helper (Base Sepolia fork)', () => {
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  let noOpMigratorWhitelisted = false
  let airlockOwner: Address | undefined

  beforeAll(async () => {
    // Fetch the protocol owner dynamically from Airlock.owner()
    const airlockOwnerAbi = [
      { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }
    ] as const
    
    try {
      airlockOwner = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockOwnerAbi,
        functionName: 'owner',
      }) as Address
    } catch (e) {
      console.log('Failed to get airlock owner:', e)
    }

    try {
      const noOpMigratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.noOpMigrator!],
      }) as unknown as number
      // ModuleState.LiquidityMigrator = 4
      noOpMigratorWhitelisted = Number(noOpMigratorState) === 4
    } catch {}
  })

  it('demonstrates using migration type "noOp" with withNoOpMigrator() helper', async () => {
    if (!noOpMigratorWhitelisted) {
      console.warn('NoOpMigrator not whitelisted on Base Sepolia, skipping test')
      return
    }
    if (!airlockOwner) {
      console.warn('Could not fetch airlock owner, skipping test')
      return
    }

    // Define beneficiaries with shares that sum to WAD (1e18)
    // IMPORTANT: Protocol owner must be included with at least 5% shares
    const beneficiaries = [
      { beneficiary: airlockOwner, shares: WAD / 10n },              // 10% for protocol owner (required)
      { beneficiary: '0x1234567890123456789012345678901234567890' as Address, shares: (WAD * 3n) / 10n },  // 30%
      { beneficiary: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address, shares: (WAD * 6n) / 10n },  // 60%
    ]
    // Total: 100% (WAD)

    // EXAMPLE: Using migration type 'noOp' with withNoOpMigrator() helper
    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'NoOpMigratorExample',
        symbol: 'NOOP',
        tokenURI: 'ipfs://example-noop-migrator'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: 8 + i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
        beneficiaries: beneficiaries
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' }) // Specify NoOp migration type
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      // OPTIONAL: Override the NoOpMigrator address (uses chain default if not specified)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // Verify that beneficiaries are set
    expect(params.pool.beneficiaries).toBeDefined()
    expect(params.pool.beneficiaries).toHaveLength(3)

    // Encode the params to verify NoOpMigrator is used
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)

    // VERIFY: The encoded params use NoOpMigrator
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)
    // VERIFY: Migration data is empty (0x) when using NoOpMigrator
    expect(createParams.liquidityMigratorData).toBe('0x')

    // Simulate the create operation
    const { tokenAddress, poolId } = await sdk.factory.simulateCreateMulticurve(params)
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  it('demonstrates migration type "noOp" without explicit withNoOpMigrator() call', async () => {
    if (!noOpMigratorWhitelisted) {
      console.warn('NoOpMigrator not whitelisted on Base Sepolia, skipping test')
      return
    }
    if (!airlockOwner) {
      console.warn('Could not fetch airlock owner, skipping test')
      return
    }

    // Define beneficiaries
    const beneficiaries = [
      { beneficiary: airlockOwner, shares: WAD / 20n },              // 5% for protocol owner (minimum required)
      { beneficiary: '0x9876543210987654321098765432109876543210' as Address, shares: (WAD * 95n) / 100n }, // 95%
    ]

    // EXAMPLE: Using migration type 'noOp' without calling withNoOpMigrator()
    // The SDK will use the default NoOpMigrator address from chain config
    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'AutoNoOpExample',
        symbol: 'AUTO',
        tokenURI: 'ipfs://auto-noop'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: 8 + i * 20_000,
          tickUpper: 200_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
        beneficiaries: beneficiaries
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' }) // Use NoOp migration type
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      // NOTE: Not calling withNoOpMigrator() - SDK will use default from chain addresses

    const params = builder.build()
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)

    // VERIFY: NoOpMigrator address from chain config is used
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)
    expect(createParams.liquidityMigratorData).toBe('0x')

    // Simulate the create operation
    const { tokenAddress, poolId } = await sdk.factory.simulateCreateMulticurve(params)
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  it('demonstrates explicit migrator override with withNoOpMigrator() for custom deployment', async () => {
    if (!noOpMigratorWhitelisted) {
      console.warn('NoOpMigrator not whitelisted on Base Sepolia, skipping test')
      return
    }
    if (!airlockOwner) {
      console.warn('Could not fetch airlock owner, skipping test')
      return
    }

    // SCENARIO: You have a custom NoOpMigrator deployment you want to use
    const customNoOpMigrator = addresses.noOpMigrator! // In practice, this would be your custom address

    const beneficiaries = [
      { beneficiary: airlockOwner, shares: WAD / 4n },  // 25%
      { beneficiary: '0x1111111111111111111111111111111111111111' as Address, shares: (WAD * 3n) / 4n }, // 75%
    ]

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'CustomNoOpExample',
        symbol: 'CUSTOM',
        tokenURI: 'ipfs://custom-noop'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 3 }, (_, i) => ({
          tickLower: 8 + i * 30_000,
          tickUpper: 150_000,
          numPositions: 10,
          shares: WAD / 3n,
        })),
        beneficiaries: beneficiaries
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      // EXPLICIT: Override with custom NoOpMigrator address
      .withNoOpMigrator(customNoOpMigrator)

    const params = builder.build()
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)

    // VERIFY: Custom NoOpMigrator address is used
    expect(createParams.liquidityMigrator).toBe(customNoOpMigrator)
    expect(createParams.liquidityMigratorData).toBe('0x')

    // Simulate the create operation
    const { tokenAddress, poolId } = await sdk.factory.simulateCreateMulticurve(params)
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })
})
