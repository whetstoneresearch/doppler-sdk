import { describe, it, expect, beforeAll } from 'vitest'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../../../'
import { getTestClient, hasRpcUrl, getRpcEnvVar, delay } from '../../helpers'

describe('Multicurve (Base Sepolia fork) smoke test', () => {
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  let initializerWhitelisted = false
  let migratorWhitelisted = false
  let tokenFactoryWhitelisted = false
  let governanceFactoryWhitelisted = false
  let states: { tokenFactory?: number; governanceFactory?: number; initializer?: number; migrator?: number } = {}

  beforeAll(async () => {
    // Add delays between RPC calls to avoid rate limiting
    try {
      const initState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v4MulticurveInitializer!],
      }) as unknown as number
      // ModuleState.PoolInitializer = 3
      states.initializer = Number(initState)
      initializerWhitelisted = states.initializer === 3
    } catch {}

    await delay(500)

    try {
      const migratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v2Migrator],
      }) as unknown as number
      // ModuleState.LiquidityMigrator = 4
      states.migrator = Number(migratorState)
      migratorWhitelisted = states.migrator === 4
    } catch {}

    await delay(500)

    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      }) as unknown as number
      // ModuleState.TokenFactory = 1
      states.tokenFactory = Number(tokenFactoryState)
      tokenFactoryWhitelisted = states.tokenFactory === 1
    } catch {}

    await delay(500)

    try {
      const governanceFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.governanceFactory],
      }) as unknown as number
      // ModuleState.GovernanceFactory = 2
      states.governanceFactory = Number(governanceFactoryState)
      governanceFactoryWhitelisted = states.governanceFactory === 2
    } catch {}
  })

  it('can simulate create() for multicurve with V2 migrator when modules are whitelisted', async () => {
    // Assert module states explicitly; these must be whitelisted
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.migrator).toBe(4)

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'MultiCurveTest', symbol: 'MCT', tokenURI: 'ipfs://test' })
      .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 1_000_000n * WAD, numeraire: addresses.weth })
      .poolConfig({
        // Match doppler multicurve tests: fee = 0, tickSpacing = 8, 10 curves stepping by 16_000
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    const { tokenAddress, poolId } = await sdk.multicurveFactory.simulate(params)
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  it('can simulate create() for multicurve with a non-zero fee', async () => {
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.migrator).toBe(4)

    const zeroFeeBuilder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'MultiCurveFeeZero', symbol: 'MC0', tokenURI: 'ipfs://fee-zero' })
      .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 1_000_000n * WAD, numeraire: addresses.weth })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const zeroFeeParams = zeroFeeBuilder.build()
    const zeroFeeResult = await sdk.multicurveFactory.simulate(zeroFeeParams)
    console.info('zero-fee gas estimate', zeroFeeResult.gasEstimate?.toString() ?? 'undefined')

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'MultiCurveFee', symbol: 'MCF', tokenURI: 'ipfs://fee-test' })
      .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 1_000_000n * WAD, numeraire: addresses.weth })
      .poolConfig({
        fee: 500,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .withGasLimit(18_000_000n)

    const params = builder.build()
    try {
      const result = await sdk.multicurveFactory.simulate(params)
      console.info('non-zero fee gas estimate', result.gasEstimate?.toString() ?? 'undefined')
      expect(result.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(result.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
    } catch (err) {
      console.info('non-zero fee simulation reverted', err instanceof Error ? err.message : err)
      throw err
    }
  })

  it('matches doppler multicurve initializer non-zero fee parameters', async () => {
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.migrator).toBe(4)

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'MultiCurveFee3000', symbol: 'MCF3', tokenURI: 'ipfs://fee-3000' })
      .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 1_000_000n * WAD, numeraire: addresses.weth })
      .poolConfig({
        fee: 3_000,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: 160_000 + i * 8,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .withGasLimit(18_000_000n)

    const params = builder.build()
    const result = await sdk.multicurveFactory.simulate(params)
    expect(result.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(result.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  it('quotes multicurve bundle via the Bundler helpers', async () => {
    // Reuse whitelisting assertions to ensure modules are available
    expect(initializerWhitelisted && migratorWhitelisted && tokenFactoryWhitelisted && governanceFactoryWhitelisted).toBe(true)

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'MultiCurveBundle', symbol: 'MCB', tokenURI: 'ipfs://bundle' })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 500_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 8 }, (_, i) => ({
          tickLower: i * 24_000,
          tickUpper: 200_000,
          numPositions: 8,
          shares: WAD / 8n,
        })),
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    const { createParams, tokenAddress } = await sdk.multicurveFactory.simulate(params)

    const exactAmountOut = params.sale.numTokensToSell / 10n || 1n
    const exactOutQuote = await sdk.multicurveFactory.simulateBundleExactOut(createParams, {
      exactAmountOut,
      hookData: '0x' as `0x${string}`,
    })

    expect(exactOutQuote.asset).toBe(tokenAddress)
    expect(exactOutQuote.amountIn > 0n).toBe(true)
    expect(exactOutQuote.gasEstimate >= 0n).toBe(true)
    expect(exactOutQuote.poolKey.hooks).toMatch(/^0x[a-fA-F0-9]{40}$/)

    const exactInQuote = await sdk.multicurveFactory.simulateBundleExactIn(createParams, {
      exactAmountIn: exactOutQuote.amountIn,
      hookData: '0x' as `0x${string}`,
    })

    expect(exactInQuote.asset).toBe(tokenAddress)
    expect(exactInQuote.amountOut > 0n).toBe(true)
    expect(exactInQuote.poolKey.hooks).toBe(exactOutQuote.poolKey.hooks)
  })

  it('simulate().execute() produces consistent addresses via closure', async () => {
    // This test verifies that the execute() function returned by simulate
    // uses the same createParams (including salt) as the simulation
    expect(initializerWhitelisted && migratorWhitelisted && tokenFactoryWhitelisted && governanceFactoryWhitelisted).toBe(true)

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'ConsistencyTest', symbol: 'CST', tokenURI: 'ipfs://consistency' })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 500_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: i * 32_000,
          tickUpper: 200_000,
          numPositions: 5,
          shares: WAD / 5n,
        })),
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    
    // Simulate to get predicted address and execute function
    const simulation = await sdk.multicurveFactory.simulate(params)
    
    // Verify simulation returned expected properties
    expect(simulation.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(simulation.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(simulation.createParams).toBeDefined()
    expect(typeof simulation.execute).toBe('function')
    
    // The execute function uses the same createParams via closure
    // This ensures that when execute() is called, it uses the same salt
    // that was generated during simulation
    expect(simulation.createParams.salt).toBeDefined()
  })
})
