import { describe, it, expect, beforeAll } from 'vitest'
import { parseEther } from 'viem'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'
import { getTestClient, hasRpcUrl, getRpcEnvVar } from './utils'

describe('Multicurve Pre-Buy with WETH (Base Sepolia fork)', () => {
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  let modulesWhitelisted = false

  beforeAll(async () => {
    try {
      const [initState, migratorState, tokenFactoryState, governanceFactoryState] = await Promise.all([
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.v4MulticurveInitializer!],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.v2Migrator],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.tokenFactory],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.governanceFactory],
        }),
      ])

      modulesWhitelisted =
        Number(tokenFactoryState) === 1 &&
        Number(governanceFactoryState) === 2 &&
        Number(initState) === 3 &&
        Number(migratorState) === 4
    } catch (error) {
      console.error('Failed to check module states:', error)
    }
  })

  it('simulates multicurve creation with WETH numeraire', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'WETH Prebuy Test',
        symbol: 'WPBUY',
        tokenURI: 'ipfs://test-weth-prebuy',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
          { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams, tokenAddress, poolId } = await sdk.multicurveFactory.simulate(params)

    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)

    // Get poolKey from bundle quote to verify WETH
    const quote = await sdk.multicurveFactory.simulateBundleExactOut(createParams, {
      exactAmountOut: params.sale.numTokensToSell / 100n,
      hookData: '0x' as `0x${string}`,
    })

    const poolKey = quote.poolKey
    const hasWETH =
      poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase() ||
      poolKey.currency1.toLowerCase() === addresses.weth.toLowerCase()
    expect(hasWETH).toBe(true)

    console.log('  ✓ Simulated creation with WETH numeraire')
    console.log(`    Asset: ${tokenAddress}`)
    console.log(`    Pool: ${poolId}`)
  })

  it('simulates bundle exact output quote for WETH prebuy', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'Bundle Quote Test',
        symbol: 'BQTST',
        tokenURI: 'ipfs://bundle-quote-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
          { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams, tokenAddress } = await sdk.multicurveFactory.simulate(params)

    // Quote for buying 1% of tokens
    const exactAmountOut = params.sale.numTokensToSell / 100n

    const quote = await sdk.multicurveFactory.simulateBundleExactOut(createParams, {
      exactAmountOut,
      hookData: '0x' as `0x${string}`,
    })

    expect(quote.asset).toBe(tokenAddress)
    expect(quote.amountIn).toBeGreaterThan(0n)
    expect(quote.gasEstimate).toBeGreaterThanOrEqual(0n)
    expect(quote.poolKey.hooks).toMatch(/^0x[a-fA-F0-9]{40}$/)

    console.log('  ✓ Bundle quote successful')
    console.log(`    WETH required: ${quote.amountIn}`)
    console.log(`    Tokens to receive: ${exactAmountOut}`)
    console.log(`    Gas estimate: ${quote.gasEstimate}`)
  })

  it('verifies swap direction for WETH → Token', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'Direction Test',
        symbol: 'DTEST',
        tokenURI: 'ipfs://direction-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('1') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams } = await sdk.multicurveFactory.simulate(params)

    // Get poolKey from bundle quote
    const quote = await sdk.multicurveFactory.simulateBundleExactOut(createParams, {
      exactAmountOut: params.sale.numTokensToSell / 100n,
      hookData: '0x' as `0x${string}`,
    })

    const poolKey = quote.poolKey

    // Determine swap direction
    const zeroForOne = poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()

    // Verify one of the currencies is WETH
    expect(
      poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase() ||
      poolKey.currency1.toLowerCase() === addresses.weth.toLowerCase()
    ).toBe(true)

    console.log('  ✓ Swap direction determined')
    console.log(`    zeroForOne: ${zeroForOne}`)
    console.log(`    Currency0: ${poolKey.currency0}`)
    console.log(`    Currency1: ${poolKey.currency1}`)
  })

  it('validates bundler exact input simulation', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'Exact In Test',
        symbol: 'EXIN',
        tokenURI: 'ipfs://exact-in-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('1') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams, tokenAddress } = await sdk.multicurveFactory.simulate(params)

    const exactAmountIn = parseEther('1') // 1 WETH

    const quote = await sdk.multicurveFactory.simulateBundleExactIn(createParams, {
      exactAmountIn,
      hookData: '0x' as `0x${string}`,
    })

    expect(quote.asset).toBe(tokenAddress)
    expect(quote.amountOut).toBeGreaterThan(0n)
    expect(quote.gasEstimate).toBeGreaterThanOrEqual(0n)

    console.log('  ✓ Exact input simulation successful')
    console.log(`    WETH in: ${exactAmountIn}`)
    console.log(`    Tokens out (estimated): ${quote.amountOut}`)
  })

  it('ensures bundle helpers exist on SDK factory', () => {
    expect(typeof sdk.multicurveFactory.simulateBundleExactOut).toBe('function')
    expect(typeof sdk.multicurveFactory.simulateBundleExactIn).toBe('function')

    console.log('  ✓ Bundle helper methods available on SDK')
  })

  it('validates permit2 and universal router addresses exist', () => {
    expect(addresses.permit2).toBeDefined()
    expect(addresses.permit2).toMatch(/^0x[a-fA-F0-9]{40}$/)

    expect(addresses.universalRouter).toBeDefined()
    expect(addresses.universalRouter).toMatch(/^0x[a-fA-F0-9]{40}$/)

    console.log('  ✓ Required contract addresses available')
    console.log(`    Permit2: ${addresses.permit2}`)
    console.log(`    Universal Router: ${addresses.universalRouter}`)
  })
})
