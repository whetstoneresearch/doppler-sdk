import { describe, it, expect, beforeAll } from 'vitest'
import { decodeAbiParameters } from 'viem'

import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../../../src'
import { getTestClient, hasRpcUrl, getRpcEnvVar } from '../../utils'

describe('Decay Multicurve (Base Sepolia fork) smoke test', () => {
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)

  if (!addresses.v4DecayMulticurveInitializer) {
    it.skip('decay multicurve initializer not configured on Base Sepolia')
    return
  }

  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  let decayInitializerWhitelisted = false
  let tokenFactoryWhitelisted = false
  let governanceFactoryWhitelisted = false
  let migratorWhitelisted = false

  beforeAll(async () => {
    try {
      const initializerState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v4DecayMulticurveInitializer!],
      }) as unknown as number
      decayInitializerWhitelisted = Number(initializerState) === 3 // PoolInitializer
    } catch {}

    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      }) as unknown as number
      tokenFactoryWhitelisted = Number(tokenFactoryState) === 1 // TokenFactory
    } catch {}

    try {
      const governanceFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.governanceFactory],
      }) as unknown as number
      governanceFactoryWhitelisted = Number(governanceFactoryState) === 2 // GovernanceFactory
    } catch {}

    try {
      const migratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v2Migrator],
      }) as unknown as number
      migratorWhitelisted = Number(migratorState) === 4 // LiquidityMigrator
    } catch {}
  }, 120_000)

  it('encodes decay multicurve params with the decay initializer', async () => {
    expect(decayInitializerWhitelisted).toBe(true)
    expect(tokenFactoryWhitelisted).toBe(true)
    expect(governanceFactoryWhitelisted).toBe(true)
    expect(migratorWhitelisted).toBe(true)

    const startTime = Math.floor(Date.now() / 1000) + 3600
    const startFee = 3000
    const terminalFee = 500
    const durationSeconds = 3600

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'DecayMulticurve', symbol: 'DMC', tokenURI: 'ipfs://decay' })
      .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 1_000_000n * WAD, numeraire: addresses.weth })
      .poolConfig({
        fee: terminalFee,
        tickSpacing: 10,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: i * 20_000,
          tickUpper: 220_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
      })
      .withDecay({ startTime, startFee, durationSeconds })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4DecayMulticurveInitializer(addresses.v4DecayMulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    expect(params.initializer).toEqual({
      type: 'decay',
      startTime,
      startFee,
      durationSeconds,
    })
    expect(params.pool.fee).toBe(terminalFee)

    const createParams = sdk.factory.encodeCreateMulticurveParams(params)
    expect(createParams.poolInitializer).toEqual(addresses.v4DecayMulticurveInitializer)

    const [decoded] = decodeAbiParameters(
      [{
        type: 'tuple',
        components: [
          { name: 'startFee', type: 'uint24' },
          { name: 'fee', type: 'uint24' },
          { name: 'durationSeconds', type: 'uint32' },
          { name: 'tickSpacing', type: 'int24' },
          {
            name: 'curves',
            type: 'tuple[]',
            components: [
              { name: 'tickLower', type: 'int24' },
              { name: 'tickUpper', type: 'int24' },
              { name: 'numPositions', type: 'uint16' },
              { name: 'shares', type: 'uint256' },
            ],
          },
          {
            name: 'beneficiaries',
            type: 'tuple[]',
            components: [
              { name: 'beneficiary', type: 'address' },
              { name: 'shares', type: 'uint96' },
            ],
          },
          { name: 'startingTime', type: 'uint32' },
        ],
      }],
      createParams.poolInitializerData,
    ) as [{
      startFee: number
      fee: number
      durationSeconds: number
      tickSpacing: number
      curves: Array<{ tickLower: number; tickUpper: number; numPositions: number; shares: bigint }>
      beneficiaries: Array<{ beneficiary: `0x${string}`; shares: bigint }>
      startingTime: number
    }]

    expect(decoded.startFee).toBe(startFee)
    expect(decoded.fee).toBe(terminalFee)
    expect(decoded.durationSeconds).toBe(durationSeconds)
    expect(decoded.startingTime).toBe(startTime)

    const { tokenAddress, poolId } = await sdk.factory.simulateCreateMulticurve(params)
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  }, 120_000)
})
