import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type Address } from 'viem'
import {
  DopplerSDK,
  getAddresses,
  CHAIN_IDS,
  WAD,
  airlockAbi,
} from '../../../src'
import {
  getForkClients,
  hasRpcUrl,
  getRpcEnvVar,
  getAnvilManager,
  isAnvilForkEnabled,
  delay,
} from '../../utils'

const erc20MetadataAbi = [
  {
    name: 'name',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const

describe('Multicurve + NoOp (no migration) + Doppler404 (Base Sepolia fork)', () => {
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
  const anvilManager = getAnvilManager()

  let publicClient: ReturnType<typeof getForkClients>['publicClient']
  let walletClient: ReturnType<typeof getForkClients>['walletClient']
  let testClient: ReturnType<typeof getForkClients>['testClient']
  let account: ReturnType<typeof getForkClients>['account']
  let sdk: DopplerSDK
  let modulesWhitelisted = false

  beforeAll(async () => {
    await anvilManager.start(chainId)

    const clients = getForkClients(chainId)
    publicClient = clients.publicClient
    walletClient = clients.walletClient
    testClient = clients.testClient
    account = clients.account

    sdk = new DopplerSDK({ publicClient, walletClient, chainId })

    // ModuleState: TokenFactory=1, GovernanceFactory=2, PoolInitializer=3, LiquidityMigrator=4
    try {
      const [initializerState, noOpMigratorState, tokenFactoryState, governanceFactoryState] =
        await Promise.all([
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
            args: [addresses.noOpMigrator!],
          }),
          publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.doppler404Factory!],
          }),
          publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.noOpGovernanceFactory!],
          }),
        ])

      modulesWhitelisted =
        Number(tokenFactoryState) === 1 &&
        Number(governanceFactoryState) === 2 &&
        Number(initializerState) === 3 &&
        Number(noOpMigratorState) === 4
    } catch (err) {
      console.info(
        'module state check failed (will skip):',
        err instanceof Error ? err.message : err
      )
    }
  }, 60_000)

  afterAll(async () => {
    await anvilManager.stop(chainId)
  })

  it('simulates and executes create() successfully', async () => {
    if (!modulesWhitelisted) {
      it.skip('required modules are not whitelisted on this fork block')
      return
    }

    const tokenName = 'Fork Doppler404 Multicurve (NoOp)'

    const airlockBeneficiary = await sdk.getAirlockBeneficiary(WAD / 10n) // >= 5%
    const beneficiaries = [
      airlockBeneficiary,
      { beneficiary: account.address, shares: WAD - airlockBeneficiary.shares },
    ]

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'doppler404',
        name: tokenName,
        symbol: 'FD404',
        baseURI: 'ipfs://example/',
        // Critical: when using WAD-based 18-decimal supplies, unit must be scaled.
        unit: 1000n * WAD,
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMarketCapPresets({
        fee: 500,
        beneficiaries,
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(account.address)
      .build()

    const sim = await sdk.factory.simulateCreateMulticurve(params)
    expect(sim.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(sim.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)

    // The SDK waits for 2 confirmations; keep mining blocks while awaiting it.
    let mining = true
    const miner = (async () => {
      while (mining) {
        try {
          await testClient.mine({ blocks: 1 })
        } catch {}
        await delay(150)
      }
    })()

    try {
      const res = await sdk.factory.createMulticurve(params)
      expect(res.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(res.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(res.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)

      const bytecode = await publicClient.getBytecode({
        address: res.tokenAddress as Address,
      })
      expect(bytecode && bytecode !== '0x').toBe(true)

      const deployedName = await publicClient.readContract({
        address: res.tokenAddress as Address,
        abi: erc20MetadataAbi,
        functionName: 'name',
      })
      expect(deployedName).toBe(tokenName)
    } finally {
      mining = false
      await miner
    }
  }, 120_000)
})

