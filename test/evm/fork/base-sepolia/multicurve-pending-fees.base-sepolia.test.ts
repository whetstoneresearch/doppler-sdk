import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CHAIN_IDS,
  DopplerSDK,
  LockablePoolStatus,
  WAD,
  airlockAbi,
  getAddresses,
} from '@/index'
import {
  delay,
  getAnvilManager,
  getForkClients,
  getRpcEnvVar,
  hasRpcUrl,
  isAnvilForkEnabled,
} from '../../utils'
import {
  executeBuySwap,
  readPoolTokenBalances,
} from '../utils'

describe('Multicurve pending fees preview (Base Sepolia fork)', () => {
  if (!isAnvilForkEnabled()) {
    it.skip('requires ANVIL_FORK_ENABLED=true')
    return
  }

  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const initializer = addresses.dopplerHookInitializer
  const noOpMigrator = addresses.noOpMigrator
  const noOpGovernanceFactory = addresses.noOpGovernanceFactory
  const anvilManager = getAnvilManager()

  if (!initializer || !noOpMigrator || !noOpGovernanceFactory) {
    it.skip(
      'requires dopplerHookInitializer, noOpMigrator, and noOpGovernanceFactory addresses',
    )
    return
  }

  let publicClient: ReturnType<typeof getForkClients>['publicClient']
  let walletClient: ReturnType<typeof getForkClients>['walletClient']
  let testClient: ReturnType<typeof getForkClients>['testClient']
  let account: ReturnType<typeof getForkClients>['account']
  let sdk: DopplerSDK
  let moduleStates: {
    readonly initializer?: number
    readonly migrator?: number
    readonly tokenFactory?: number
    readonly governanceFactory?: number
  } = {}

  beforeAll(async () => {
    await anvilManager.start(chainId)

    const clients = getForkClients(chainId, 0, { timeout: 90_000 })
    publicClient = clients.publicClient
    walletClient = clients.walletClient
    testClient = clients.testClient
    account = clients.account
    sdk = new DopplerSDK({ publicClient, walletClient, chainId })

    const [
      initializerState,
      migratorState,
      tokenFactoryState,
      governanceFactoryState,
    ] = await Promise.all([
      publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [initializer],
      }),
      publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [noOpMigrator],
      }),
      publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.dopplerERC20V1Factory!],
      }),
      publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [noOpGovernanceFactory],
      }),
    ])

    moduleStates = {
      initializer: Number(initializerState),
      migrator: Number(migratorState),
      tokenFactory: Number(tokenFactoryState),
      governanceFactory: Number(governanceFactoryState),
    }
  }, 60_000)

  afterAll(async () => {
    await anvilManager.stop(chainId)
  })

  it('previews beneficiary fees and matches the actual collection balance delta', async () => {
    expect(moduleStates.tokenFactory).toBe(1)
    expect(moduleStates.governanceFactory).toBe(2)
    expect(moduleStates.initializer).toBe(3)
    expect(moduleStates.migrator).toBe(4)

    const airlockBeneficiary = await sdk.getAirlockBeneficiary(WAD / 10n)
    const beneficiary = account.address
    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Fork Pending Fees Preview',
        symbol: 'FPF',
        tokenURI: 'ipfs://fork-pending-fees-preview',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMarketCapPresets({
        fee: 500,
        beneficiaries: [
          airlockBeneficiary,
          {
            beneficiary,
            shares: WAD - airlockBeneficiary.shares,
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(account.address)
      .withNoOpMigrator(noOpMigrator)
      .build()

    const simulation = await sdk.factory.simulateCreateMulticurve(params)
    let mining = true
    const miner = (async () => {
      while (mining) {
        await testClient.mine({ blocks: 1 })
        await delay(150)
      }
    })()

    let result: Awaited<ReturnType<typeof simulation.execute>>
    try {
      result = await simulation.execute()
    } finally {
      mining = false
      await miner
    }

    const pool = await sdk.getMulticurvePool(result.tokenAddress)
    const state = await pool.getState()
    expect(state.status).toBe(LockablePoolStatus.Locked)
    expect(state.asset.toLowerCase()).toBe(result.tokenAddress.toLowerCase())

    await executeBuySwap({
      addresses,
      publicClient,
      sdk,
      walletClient,
      poolKey: state.poolKey,
      account,
    })

    const beforePreview = await readPoolTokenBalances({
      publicClient,
      token0: state.poolKey.currency0,
      token1: state.poolKey.currency1,
      beneficiary,
    })
    const pendingFees = await pool.getPendingFees(beneficiary)
    const afterPreview = await readPoolTokenBalances({
      publicClient,
      token0: state.poolKey.currency0,
      token1: state.poolKey.currency1,
      beneficiary,
    })

    expect(pendingFees.fees0 > 0n || pendingFees.fees1 > 0n).toBe(true)
    expect(afterPreview).toEqual(beforePreview)

    await pool.collectFees()

    const afterCollect = await readPoolTokenBalances({
      publicClient,
      token0: state.poolKey.currency0,
      token1: state.poolKey.currency1,
      beneficiary,
    })
    expect(afterCollect.token0 - beforePreview.token0).toBe(pendingFees.fees0)
    expect(afterCollect.token1 - beforePreview.token1).toBe(pendingFees.fees1)
    console.info(
      `beneficiary fee deltas matched preview: token0=${pendingFees.fees0} token1=${pendingFees.fees1}`,
    )
  }, 180_000)
})
