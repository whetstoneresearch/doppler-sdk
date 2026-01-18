import { describe, it, expect, beforeAll } from 'vitest'
import { parseEther } from 'viem'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'
import { getTestClient, hasRpcUrl, getRpcEnvVar } from './utils'

describe('Multicurve with RehypeDopplerHook (Base Sepolia) test', () => {
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  const REHYPE_DOPPLER_HOOK_ADDRESS = '0x636a756cee08775cc18780f52dd90b634f18ad37' as `0x${string}`

  let states: { tokenFactory?: number; governanceFactory?: number; initializer?: number; migrator?: number } = {}
  let airlockOwner: `0x${string}` | undefined

  beforeAll(async () => {
    const airlockOwnerAbi = [
      { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }
    ] as const
    
    try {
      airlockOwner = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockOwnerAbi,
        functionName: 'owner',
      }) as `0x${string}`
      console.log('Airlock owner:', airlockOwner)
    } catch (e) {
      console.log('Failed to get airlock owner:', e)
    }
    const dopplerHookInitializerAbi = [
      { name: 'isDopplerHookEnabled', type: 'function', stateMutability: 'view', inputs: [{ name: 'dopplerHook', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
    ] as const
    
    try {
      const hookFlag = await publicClient.readContract({
        address: addresses.dopplerHookInitializer!,
        abi: dopplerHookInitializerAbi,
        functionName: 'isDopplerHookEnabled',
        args: [REHYPE_DOPPLER_HOOK_ADDRESS],
      })
      console.log('RehypeDopplerHook enabled flag:', hookFlag.toString())
    } catch (e) {
      console.log('Failed to check hook enabled:', e)
    }
    
    try {
      const initState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.dopplerHookInitializer!],
      }) as unknown as number
      states.initializer = Number(initState)
    } catch {}

    try {
      const migratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.noOpMigrator!],
      }) as unknown as number
      states.migrator = Number(migratorState)
    } catch {}

    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      }) as unknown as number
      states.tokenFactory = Number(tokenFactoryState)
    } catch {}

    try {
      const governanceFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.noOpGovernanceFactory!],
      }) as unknown as number
      states.governanceFactory = Number(governanceFactoryState)
    } catch {}
  })

  it('can simulate create() for basic multicurve with DopplerHookInitializer (no hook)', { timeout: 60000 }, async () => {
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.migrator).toBe(4)
    expect(airlockOwner).toBeDefined()

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'BasicDHI',
        symbol: 'BDHI',
        tokenURI: 'ipfs://basic-dhi-test'
      })
      .saleConfig({
        initialSupply: 1_000_000_000_000_000_000_000_000_000n,
        numTokensToSell: 1_000_000_000_000_000_000_000_000_000n,
        numeraire: addresses.weth
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
        beneficiaries: [
          { beneficiary: airlockOwner!, shares: WAD / 10n },  // 10% protocol owner
          { beneficiary: '0x0000000000000000000000000000000000000001' as `0x${string}`, shares: (WAD * 9n) / 10n },  // 90%
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()
    
    console.log('DopplerHookInitializer:', addresses.dopplerHookInitializer)
    console.log('NoOpMigrator:', addresses.noOpMigrator)
    
    const { tokenAddress, poolId, gasEstimate } = await sdk.factory.simulateCreateMulticurve(params)
    
    console.log('Asset:', tokenAddress)
    console.log('Pool:', poolId)
    console.log('Gas estimate:', gasEstimate?.toString())
    
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  it('can simulate create() for multicurve with RehypeDopplerHook', { timeout: 60000 }, async () => {
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.migrator).toBe(4)
    expect(airlockOwner).toBeDefined()

    const BUYBACK_DST = '0x0000000000000000000000000000000000000007' as `0x${string}`

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ 
        type: 'standard', 
        name: 'RehypeTest', 
        symbol: 'RHT', 
        tokenURI: 'ipfs://rehype-test' 
      })
      .saleConfig({ 
        initialSupply: 1_000_000_000_000_000_000_000_000_000n,
        numTokensToSell: 1_000_000_000_000_000_000_000_000_000n,
        numeraire: addresses.weth 
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
        beneficiaries: [
          { beneficiary: BUYBACK_DST, shares: 950_000_000_000_000_000n },
          { beneficiary: airlockOwner!, shares: 50_000_000_000_000_000n },
        ],
      })
      .withRehypeDopplerHook({
        hookAddress: REHYPE_DOPPLER_HOOK_ADDRESS,
        buybackDestination: BUYBACK_DST,
        customFee: 3000,
        assetBuybackPercentWad: 200_000_000_000_000_000n,
        numeraireBuybackPercentWad: 200_000_000_000_000_000n,
        beneficiaryPercentWad: 300_000_000_000_000_000n,
        lpPercentWad: 300_000_000_000_000_000n,
        farTick: 200_000,
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()
    
    console.log('DopplerHookInitializer:', addresses.dopplerHookInitializer)
    console.log('RehypeDopplerHook:', REHYPE_DOPPLER_HOOK_ADDRESS)
    console.log('NoOpMigrator:', addresses.noOpMigrator)
    
    const { tokenAddress, poolId, gasEstimate } = await sdk.factory.simulateCreateMulticurve(params)
    
    console.log('Asset:', tokenAddress)
    console.log('Pool:', poolId)
    console.log('Gas estimate:', gasEstimate?.toString())
    
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  // ============================================
  // withCurves() tests - market cap to tick conversion
  // These test the SDK's tick calculation logic against real contracts
  // ============================================

  it('can simulate create() using withCurves() WITHOUT rehype hook', { timeout: 60000 }, async () => {
    expect(states.initializer).toBe(3)
    expect(airlockOwner).toBeDefined()

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'WithCurvesNoHook',
        symbol: 'WCNH',
        tokenURI: 'ipfs://withcurves-no-hook'
      })
      .saleConfig({
        initialSupply: parseEther('1000000000'),
        numTokensToSell: parseEther('900000000'),
        numeraire: addresses.weth
      })
      .withCurves({
        numerairePrice: 3000, // ETH = $3000
        curves: [
          { marketCap: { start: 500_000, end: 2_000_000 }, numPositions: 10, shares: parseEther('0.4') },
          { marketCap: { start: 2_000_000, end: 10_000_000 }, numPositions: 15, shares: parseEther('0.4') },
          { marketCap: { start: 10_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
        ],
        beneficiaries: [
          { beneficiary: airlockOwner!, shares: parseEther('0.1') },
          { beneficiary: '0x0000000000000000000000000000000000000001' as `0x${string}`, shares: parseEther('0.9') },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    console.log('withCurves() no hook - curves:', params.pool.curves.length)
    console.log('withCurves() no hook - curve ticks:', params.pool.curves.map(c => `[${c.tickLower}, ${c.tickUpper}]`).join(', '))

    const { tokenAddress, poolId, gasEstimate } = await sdk.factory.simulateCreateMulticurve(params)

    console.log('Asset:', tokenAddress)
    console.log('Pool:', poolId)
    console.log('Gas estimate:', gasEstimate?.toString())

    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  it('can simulate create() using withCurves() WITH rehype and graduationMarketCap', { timeout: 60000 }, async () => {
    expect(states.initializer).toBe(3)
    expect(airlockOwner).toBeDefined()

    const BUYBACK_DST = '0x0000000000000000000000000000000000000007' as `0x${string}`

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'WithCurvesGradMC',
        symbol: 'WCGMC',
        tokenURI: 'ipfs://withcurves-grad-mc'
      })
      .saleConfig({
        initialSupply: parseEther('1000000000'),
        numTokensToSell: parseEther('900000000'),
        numeraire: addresses.weth
      })
      .withCurves({
        numerairePrice: 3000,
        curves: [
          { marketCap: { start: 500_000, end: 2_000_000 }, numPositions: 10, shares: parseEther('0.4') },
          { marketCap: { start: 2_000_000, end: 10_000_000 }, numPositions: 15, shares: parseEther('0.4') },
          { marketCap: { start: 10_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
        ],
        beneficiaries: [
          { beneficiary: airlockOwner!, shares: parseEther('0.05') },
          { beneficiary: BUYBACK_DST, shares: parseEther('0.95') },
        ],
      })
      .withRehypeDopplerHook({
        hookAddress: REHYPE_DOPPLER_HOOK_ADDRESS,
        buybackDestination: BUYBACK_DST,
        customFee: 3000,
        assetBuybackPercentWad: 250_000_000_000_000_000n,
        numeraireBuybackPercentWad: 250_000_000_000_000_000n,
        beneficiaryPercentWad: 250_000_000_000_000_000n,
        lpPercentWad: 250_000_000_000_000_000n,
        graduationMarketCap: 40_000_000, // $40M graduation - within curve range
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    console.log('withCurves() + graduationMarketCap - curves:', params.pool.curves.length)
    console.log('withCurves() + graduationMarketCap - farTick:', params.dopplerHook?.farTick)
    console.log('withCurves() + graduationMarketCap - curve ticks:', params.pool.curves.map(c => `[${c.tickLower}, ${c.tickUpper}]`).join(', '))

    const { tokenAddress, poolId, gasEstimate } = await sdk.factory.simulateCreateMulticurve(params)

    console.log('Asset:', tokenAddress)
    console.log('Pool:', poolId)
    console.log('Gas estimate:', gasEstimate?.toString())

    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(params.dopplerHook?.farTick).toBeDefined()
  })

  it('can simulate create() using withCurves() WITH rehype and explicit farTick', { timeout: 60000 }, async () => {
    expect(states.initializer).toBe(3)
    expect(airlockOwner).toBeDefined()

    const BUYBACK_DST = '0x0000000000000000000000000000000000000007' as `0x${string}`

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'WithCurvesFarTick',
        symbol: 'WCFT',
        tokenURI: 'ipfs://withcurves-fartick'
      })
      .saleConfig({
        initialSupply: parseEther('1000000000'),
        numTokensToSell: parseEther('900000000'),
        numeraire: addresses.weth
      })
      .withCurves({
        numerairePrice: 3000,
        curves: [
          { marketCap: { start: 500_000, end: 2_000_000 }, numPositions: 10, shares: parseEther('0.4') },
          { marketCap: { start: 2_000_000, end: 10_000_000 }, numPositions: 15, shares: parseEther('0.4') },
          { marketCap: { start: 10_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
        ],
        beneficiaries: [
          { beneficiary: airlockOwner!, shares: parseEther('0.05') },
          { beneficiary: BUYBACK_DST, shares: parseEther('0.95') },
        ],
      })
      .withRehypeDopplerHook({
        hookAddress: REHYPE_DOPPLER_HOOK_ADDRESS,
        buybackDestination: BUYBACK_DST,
        customFee: 3000,
        assetBuybackPercentWad: 250_000_000_000_000_000n,
        numeraireBuybackPercentWad: 250_000_000_000_000_000n,
        beneficiaryPercentWad: 250_000_000_000_000_000n,
        lpPercentWad: 250_000_000_000_000_000n,
        farTick: -115000, // Explicit farTick within curve range
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    console.log('withCurves() + explicit farTick - curves:', params.pool.curves.length)
    console.log('withCurves() + explicit farTick - farTick:', params.dopplerHook?.farTick)
    console.log('withCurves() + explicit farTick - curve ticks:', params.pool.curves.map(c => `[${c.tickLower}, ${c.tickUpper}]`).join(', '))

    const { tokenAddress, poolId, gasEstimate } = await sdk.factory.simulateCreateMulticurve(params)

    console.log('Asset:', tokenAddress)
    console.log('Pool:', poolId)
    console.log('Gas estimate:', gasEstimate?.toString())

    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(params.dopplerHook?.farTick).toBe(-115000)
  })
})
