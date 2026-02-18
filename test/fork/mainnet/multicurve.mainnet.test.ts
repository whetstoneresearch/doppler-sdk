import { beforeAll, describe, expect, it } from 'vitest'
import type { Address } from 'viem'

import { CHAIN_IDS, DopplerSDK, WAD, airlockAbi, getAddresses } from '../../../src'
import { delay, getRpcEnvVar, getTestClient, hasRpcUrl } from '../../utils'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

describe('Multicurve (Ethereum Mainnet fork) smoke test', () => {
  if (!hasRpcUrl(CHAIN_IDS.MAINNET)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.MAINNET)} env var`)
    return
  }

  const chainId = CHAIN_IDS.MAINNET
  const addresses = getAddresses(chainId)
  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  const configuredModules: Array<{
    label: string
    address?: Address
    expectedState: number
  }> = [
    {
      label: 'TokenFactory',
      address: addresses.tokenFactory,
      expectedState: 1,
    },
    {
      label: 'V4Initializer',
      address: addresses.v4Initializer,
      expectedState: 3,
    },
    {
      label: 'V4ScheduledMulticurveInitializer',
      address: addresses.v4ScheduledMulticurveInitializer,
      expectedState: 3,
    },
    {
      label: 'NoOpGovernanceFactory',
      address: addresses.noOpGovernanceFactory,
      expectedState: 2,
    },
    {
      label: 'V2Migrator',
      address: addresses.v2Migrator,
      expectedState: 4,
    },
    {
      label: 'V4Migrator',
      address: addresses.v4Migrator,
      expectedState: 4,
    },
    {
      label: 'NoOpMigrator',
      address: addresses.noOpMigrator,
      expectedState: 4,
    },
  ]

  beforeAll(async () => {
    await delay(250)
  })

  it('has non-zero Uniswap V4 trading endpoints configured for Ethereum mainnet', () => {
    expect(addresses.poolManager).not.toBe(ZERO_ADDRESS)
    expect(addresses.universalRouter).not.toBe(ZERO_ADDRESS)
    expect(addresses.uniswapV4Quoter).not.toBe(ZERO_ADDRESS)
  })

  it('verifies whitelisted module states for configured Ethereum mainnet modules', async () => {
    for (const module of configuredModules) {
      if (!module.address || module.address === ZERO_ADDRESS) continue

      const state = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [module.address],
      })

      expect(
        Number(state),
        `${module.label} expected state ${module.expectedState}`,
      ).toBe(module.expectedState)
      await delay(250)
    }
  })

  it('defaults multicurve governance to noOp on Ethereum mainnet', () => {
    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'MainnetGovernanceDefault',
        symbol: 'MGD',
        tokenURI: 'ipfs://mainnet-governance-default',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          {
            tickLower: 0,
            tickUpper: 240_000,
            numPositions: 10,
            shares: WAD,
          },
        ],
      })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .build()

    expect(params.governance.type).toBe('noOp')
  })

  it('simulates create when required modules exist, otherwise fails fast with a clear config error', async () => {
    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'MainnetCreatePath',
        symbol: 'MCP',
        tokenURI: 'ipfs://mainnet-create-path',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          {
            tickLower: 0,
            tickUpper: 240_000,
            numPositions: 10,
            shares: WAD,
          },
        ],
      })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .build()

    const canSimulate =
      addresses.tokenFactory !== ZERO_ADDRESS &&
      addresses.v2Migrator !== ZERO_ADDRESS &&
      addresses.noOpGovernanceFactory !== ZERO_ADDRESS &&
      !!addresses.v4MulticurveInitializer &&
      addresses.v4MulticurveInitializer !== ZERO_ADDRESS

    if (!canSimulate) {
      expect(() => sdk.factory.encodeCreateMulticurveParams(params)).toThrow(
        /not configured|not deployed/i,
      )
      return
    }

    const result = await sdk.factory.simulateCreateMulticurve(params)
    expect(result.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(result.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })
})
