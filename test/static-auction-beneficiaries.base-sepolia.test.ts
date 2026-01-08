import { describe, it, expect, beforeAll } from 'vitest'
import { type Address } from 'viem'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'
import { getTestClient, hasRpcUrl, getRpcEnvVar } from './utils'

/**
 * Integration tests for V3 Static Auction with Lockable Beneficiaries
 *
 * These tests verify that the SDK correctly encodes beneficiaries for V3 static launches,
 * which locks the pool and enables fee streaming to configured beneficiaries.
 *
 * When beneficiaries are provided:
 * - Pool enters "Locked" status (cannot be migrated)
 * - Fees are collected and distributed to beneficiaries according to their shares
 * - NoOp migrator should be used (no actual migration occurs)
 */
describe('Static Auction with lockable beneficiaries (Base Sepolia)', () => {
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  let v3InitializerWhitelisted = false
  let noOpMigratorWhitelisted = false
  let tokenFactoryWhitelisted = false
  let governanceFactoryWhitelisted = false
  let airlockOwner: Address | undefined
  let states: {
    tokenFactory?: number
    governanceFactory?: number
    v3Initializer?: number
    noOpMigrator?: number
  } = {}

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

    // Check module whitelisting states
    try {
      const initState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v3Initializer],
      }) as unknown as number
      states.v3Initializer = Number(initState)
      // ModuleState.PoolInitializer = 3
      v3InitializerWhitelisted = states.v3Initializer === 3
    } catch {}

    try {
      const noOpMigratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.noOpMigrator!],
      }) as unknown as number
      states.noOpMigrator = Number(noOpMigratorState)
      // ModuleState.LiquidityMigrator = 4
      noOpMigratorWhitelisted = states.noOpMigrator === 4
    } catch {}

    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      }) as unknown as number
      states.tokenFactory = Number(tokenFactoryState)
      // ModuleState.TokenFactory = 1
      tokenFactoryWhitelisted = states.tokenFactory === 1
    } catch {}

    try {
      const governanceFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.governanceFactory],
      }) as unknown as number
      states.governanceFactory = Number(governanceFactoryState)
      // ModuleState.GovernanceFactory = 2
      governanceFactoryWhitelisted = states.governanceFactory === 2
    } catch {}
  })

  it('can encode static auction params with lockable beneficiaries', async () => {
    // Skip if V3 initializer is not whitelisted
    if (states.v3Initializer !== 3) {
      console.warn('V3 initializer not whitelisted on Base Sepolia (state=%d), skipping test', states.v3Initializer)
      return
    }
    if (!airlockOwner) {
      console.warn('Could not fetch airlock owner, skipping test')
      return
    }

    // Assert module states explicitly
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.v3Initializer).toBe(3)

    // Define beneficiaries with shares that sum to WAD (1e18 = 100%)
    // IMPORTANT: Protocol owner (Airlock.owner()) must be included with at least 5% shares
    const beneficiary1 = airlockOwner // Protocol owner (required)
    const beneficiary2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
    const beneficiary3 = '0x9876543210987654321098765432109876543210' as Address

    // Shares must sum to exactly WAD (1e18)
    const share1 = WAD / 10n // 10% for protocol (>= 5% required)
    const share2 = WAD / 2n // 50%
    const share3 = (WAD * 4n) / 10n // 40%
    // Total: 100%

    const builder = sdk
      .buildStaticAuction()
      .tokenConfig({
        type: 'standard',
        name: 'LockableBeneficiariesV3Test',
        symbol: 'LBV3',
        tokenURI: 'ipfs://lockable-v3-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolByTicks({
        startTick: 174960, // Must be multiple of 60 for fee 3000
        endTick: 225000,
        fee: 3000,
      })
      .withBeneficiaries([
        { beneficiary: beneficiary1, shares: share1 },
        { beneficiary: beneficiary2, shares: share2 },
        { beneficiary: beneficiary3, shares: share3 },
      ])
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' }) // Use NoOp migration when beneficiaries are present
      .withUserAddress(addresses.airlock)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // Verify that beneficiaries are set
    expect(params.pool.beneficiaries).toBeDefined()
    expect(params.pool.beneficiaries).toHaveLength(3)

    // Verify beneficiaries are sorted by address (SDK sorts automatically)
    const sortedBeneficiaries = params.pool.beneficiaries!
    expect(sortedBeneficiaries[0].beneficiary.toLowerCase() < sortedBeneficiaries[1].beneficiary.toLowerCase()).toBe(true)
    expect(sortedBeneficiaries[1].beneficiary.toLowerCase() < sortedBeneficiaries[2].beneficiary.toLowerCase()).toBe(true)

    // Verify shares sum to WAD
    const totalShares = sortedBeneficiaries.reduce((sum, b) => sum + b.shares, 0n)
    expect(totalShares).toBe(WAD)

    // Encode the params to verify structure
    const createParams = await sdk.factory.encodeCreateStaticAuctionParams(params)

    // Verify that NoOpMigrator is used when beneficiaries are provided
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)
    // Verify that migration data is empty (0x)
    expect(createParams.liquidityMigratorData).toBe('0x')

    // Pool initializer data should contain beneficiaries
    expect(createParams.poolInitializerData.length).toBeGreaterThan(100) // Non-trivial data
  })

  it('can simulate create() for static auction with lockable beneficiaries', async () => {
    // Skip if modules are not whitelisted
    if (states.v3Initializer !== 3 || states.noOpMigrator !== 4) {
      console.warn(
        'Required modules not whitelisted on Base Sepolia (v3Init=%d, noOp=%d), skipping test',
        states.v3Initializer,
        states.noOpMigrator
      )
      return
    }
    if (!airlockOwner) {
      console.warn('Could not fetch airlock owner, skipping test')
      return
    }

    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.v3Initializer).toBe(3)
    expect(states.noOpMigrator).toBe(4)

    const beneficiary1 = airlockOwner
    const beneficiary2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address

    const builder = sdk
      .buildStaticAuction()
      .tokenConfig({
        type: 'standard',
        name: 'SimulateLockableTest',
        symbol: 'SLT',
        tokenURI: 'ipfs://simulate-lockable',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolByTicks({
        startTick: 174960,
        endTick: 225000,
        fee: 3000,
      })
      .withBeneficiaries([
        { beneficiary: beneficiary1, shares: WAD / 10n }, // 10%
        { beneficiary: beneficiary2, shares: (WAD * 9n) / 10n }, // 90%
      ])
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // Simulate the create operation
    const { asset, pool } = await sdk.factory.simulateCreateStaticAuction(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('uses standard migrator when no lockable beneficiaries are provided', async () => {
    // Skip if V3 initializer is not whitelisted
    if (states.v3Initializer !== 3) {
      console.warn('V3 initializer not whitelisted on Base Sepolia (state=%d), skipping test', states.v3Initializer)
      return
    }

    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.v3Initializer).toBe(3)

    const builder = sdk
      .buildStaticAuction()
      .tokenConfig({
        type: 'standard',
        name: 'NoLockableV3Test',
        symbol: 'NLV3',
        tokenURI: 'ipfs://no-lockable-v3',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolByTicks({
        startTick: 174960,
        endTick: 225000,
        fee: 3000,
      })
      // No beneficiaries provided
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()

    // Verify that beneficiaries are not set
    expect(params.pool.beneficiaries).toBeUndefined()

    // Encode the params to verify standard migrator is used
    const createParams = await sdk.factory.encodeCreateStaticAuctionParams(params)

    // Verify that V2 migrator is used when no beneficiaries
    expect(createParams.liquidityMigrator).toBe(addresses.v2Migrator)
    // V2 migration data is empty by design
    expect(createParams.liquidityMigratorData).toBe('0x')
  })

  it('validates that beneficiary shares must sum to WAD (100%)', async () => {
    if (!airlockOwner) {
      console.warn('Could not fetch airlock owner, skipping test')
      return
    }

    const beneficiary1 = airlockOwner
    const beneficiary2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address

    // Shares that DON'T sum to WAD (only 60%)
    const share1 = WAD / 10n // 10% for protocol
    const share2 = WAD / 2n // 50%
    // Total: 60% (should fail - missing 40%)

    const builder = sdk
      .buildStaticAuction()
      .tokenConfig({
        type: 'standard',
        name: 'InvalidSharesV3Test',
        symbol: 'ISV3',
        tokenURI: 'ipfs://invalid-shares-v3',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolByTicks({
        startTick: 174960,
        endTick: 225000,
        fee: 3000,
      })
      .withBeneficiaries([
        { beneficiary: beneficiary1, shares: share1 },
        { beneficiary: beneficiary2, shares: share2 },
      ])
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // The encoding should fail because shares don't sum to WAD
    await expect(async () => {
      await sdk.factory.encodeCreateStaticAuctionParams(params)
    }).rejects.toThrow(/shares must sum to/)
  })

  it('automatically sorts beneficiaries by address', async () => {
    // Skip if V3 initializer is not whitelisted
    if (states.v3Initializer !== 3) {
      console.warn('V3 initializer not whitelisted on Base Sepolia (state=%d), skipping test', states.v3Initializer)
      return
    }
    if (!airlockOwner) {
      console.warn('Could not fetch airlock owner, skipping test')
      return
    }

    // Beneficiaries NOT in sorted order
    const beneficiary1 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address // Higher address
    const beneficiary2 = airlockOwner // Protocol owner - will be sorted by SDK
    const beneficiary3 = '0x1234567890123456789012345678901234567890' as Address // Lower address

    const share1 = WAD / 2n // 50%
    const share2 = WAD / 10n // 10% for protocol
    const share3 = (WAD * 4n) / 10n // 40%

    const builder = sdk
      .buildStaticAuction()
      .tokenConfig({
        type: 'standard',
        name: 'UnsortedBeneficiariesV3Test',
        symbol: 'UBV3',
        tokenURI: 'ipfs://unsorted-v3',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolByTicks({
        startTick: 174960,
        endTick: 225000,
        fee: 3000,
      })
      .withBeneficiaries([
        { beneficiary: beneficiary1, shares: share1 },
        { beneficiary: beneficiary2, shares: share2 },
        { beneficiary: beneficiary3, shares: share3 },
      ])
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // The SDK should automatically sort beneficiaries
    const beneficiaries = params.pool.beneficiaries!
    expect(beneficiaries[0].beneficiary.toLowerCase() < beneficiaries[1].beneficiary.toLowerCase()).toBe(true)
    expect(beneficiaries[1].beneficiary.toLowerCase() < beneficiaries[2].beneficiary.toLowerCase()).toBe(true)

    // Encoding should succeed after sorting
    const createParams = await sdk.factory.encodeCreateStaticAuctionParams(params)
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)
  })
})
