import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Address } from 'viem'
import {
  CHAIN_IDS,
  DopplerSDK,
  WAD,
  airlockAbi,
  getAddresses,
} from '../../../../src/evm'
import { DAY_SECONDS } from '../../../../src/evm/constants'
import {
  delay,
  getAnvilManager,
  getForkClients,
  getRpcEnvVar,
  hasRpcUrl,
  isAnvilForkEnabled,
  mineToTimestamp,
} from '../../utils'

describe('Multicurve cliff vesting (Base Sepolia fork)', () => {
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
  const cliffDuration = 90n * BigInt(DAY_SECONDS)
  const vestingDuration = 180n * BigInt(DAY_SECONDS)
  const secondaryRecipient =
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address

  let publicClient: ReturnType<typeof getForkClients>['publicClient']
  let walletClient: ReturnType<typeof getForkClients>['walletClient']
  let testClient: ReturnType<typeof getForkClients>['testClient']
  let account: ReturnType<typeof getForkClients>['account']
  let sdk: DopplerSDK
  let modulesWhitelisted = false
  let moduleStates: {
    initializer?: number
    migrator?: number
    tokenFactory?: number
    governanceFactory?: number
  } = {}

  const vestedAmountAtTimestamp = (
    totalAmount: bigint,
    startTimestamp: bigint,
    currentTimestamp: bigint,
    duration: bigint
  ) => {
    const elapsed = currentTimestamp > startTimestamp ? currentTimestamp - startTimestamp : 0n
    const vestedElapsed = elapsed > duration ? duration : elapsed
    return (totalAmount * vestedElapsed) / duration
  }

  beforeAll(async () => {
    await anvilManager.start(chainId)

    const clients = getForkClients(chainId, 0, { timeout: 90_000 })
    publicClient = clients.publicClient
    walletClient = clients.walletClient
    testClient = clients.testClient
    account = clients.account
    sdk = new DopplerSDK({ publicClient, walletClient, chainId })

    try {
      const [initializerState, migratorState, tokenFactoryState, governanceState] =
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
            args: [addresses.v2Migrator],
          }),
          publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.derc20V2Factory!],
          }),
          publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.noOpGovernanceFactory!],
          }),
        ])

      moduleStates = {
        initializer: Number(initializerState),
        migrator: Number(migratorState),
        tokenFactory: Number(tokenFactoryState),
        governanceFactory: Number(governanceState),
      }
      modulesWhitelisted =
        moduleStates.initializer === 3 &&
        moduleStates.migrator === 4 &&
        moduleStates.tokenFactory === 1 &&
        moduleStates.governanceFactory === 2
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

  it('creates a cliffed V2 token and releases vested tokens after the cliff', async () => {
    expect(moduleStates.tokenFactory).toBe(1)
    expect(moduleStates.governanceFactory).toBe(2)
    expect(moduleStates.initializer).toBe(3)
    expect(moduleStates.migrator).toBe(4)
    expect(modulesWhitelisted).toBe(true)

    const liquidAmount = 900_000n * WAD
    const vestedAmount = 100_000n * WAD

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Fork Cliff Vest',
        symbol: 'FCV',
        tokenURI: 'ipfs://fork-cliff-vest',
      })
      .saleConfig({
        initialSupply: liquidAmount + vestedAmount,
        numTokensToSell: liquidAmount,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, index) => ({
          tickLower: index * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
      })
      .withVesting({
        duration: vestingDuration,
        cliffDuration: Number(cliffDuration),
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(account.address)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .build()

    const sim = await sdk.factory.simulateCreateMulticurve(params)
    expect(sim.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(sim.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(sim.createParams.tokenFactory).toBe(addresses.derc20V2Factory)

    let mining = true
    const miner = (async () => {
      while (mining) {
        try {
          await testClient.mine({ blocks: 1 })
        } catch {}
        await delay(150)
      }
    })()

    let result: Awaited<ReturnType<typeof sdk.factory.createMulticurve>>
    try {
      result = await sdk.factory.createMulticurve(params)
    } finally {
      mining = false
      await miner
    }

    expect(result.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(result.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)

    const token = sdk.getDerc20V2(result.tokenAddress as Address)
    expect(await token.getVestingScheduleCount()).toBe(1n)
    expect(await token.getVestingSchedule(0n)).toEqual({
      cliffDuration,
      duration: vestingDuration,
    })
    expect(await token.getScheduleIdsOf(account.address)).toEqual([0n])
    expect(await token.getTotalAllocatedOf(account.address)).toBe(vestedAmount)
    expect(await token.getVestingDataForSchedule(account.address, 0n)).toEqual({
      totalAmount: vestedAmount,
      releasedAmount: 0n,
    })
    expect(await token.getBalanceOf(account.address)).toBe(0n)
    expect(await token.getAvailableVestedAmount(account.address)).toBe(0n)

    const vestingStart = await token.getVestingStart()
    await mineToTimestamp(testClient, vestingStart + cliffDuration - 1n)
    expect(await token.getAvailableVestedAmount(account.address)).toBe(0n)

    await mineToTimestamp(testClient, vestingStart + cliffDuration + 1n)
    const expectedReleased = (vestedAmount * (cliffDuration + 1n)) / vestingDuration
    expect(
      await token.getAvailableVestedAmountForSchedule(account.address, 0n)
    ).toBe(expectedReleased)
    expect(await token.getAvailableVestedAmount(account.address)).toBe(
      expectedReleased
    )

    const releaseTx = await token.releaseSchedule(0n)
    await testClient.mine({ blocks: 1 })
    const releaseReceipt = await publicClient.waitForTransactionReceipt({
      hash: releaseTx,
    })
    const releaseBlock = await publicClient.getBlock({
      blockNumber: releaseReceipt.blockNumber,
    })
    const releasedAmount = vestedAmountAtTimestamp(
      vestedAmount,
      vestingStart,
      releaseBlock.timestamp,
      vestingDuration
    )

    expect(await token.getVestingDataForSchedule(account.address, 0n)).toEqual({
      totalAmount: vestedAmount,
      releasedAmount,
    })
    expect(await token.getBalanceOf(account.address)).toBe(releasedAmount)
    expect(await token.getAvailableVestedAmount(account.address)).toBe(0n)
  }, 120_000)

  it('creates per-beneficiary schedules and releases them independently', async () => {
    expect(moduleStates.tokenFactory).toBe(1)
    expect(moduleStates.governanceFactory).toBe(2)
    expect(moduleStates.initializer).toBe(3)
    expect(moduleStates.migrator).toBe(4)
    expect(modulesWhitelisted).toBe(true)

    const primaryAmount = 60_000n * WAD
    const secondaryAmount = 40_000n * WAD
    const primarySchedule = {
      cliffDuration: 30n * BigInt(DAY_SECONDS),
      duration: 180n * BigInt(DAY_SECONDS),
    }
    const secondarySchedule = {
      cliffDuration: 120n * BigInt(DAY_SECONDS),
      duration: 365n * BigInt(DAY_SECONDS),
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Fork Multi Cliff Vest',
        symbol: 'FMCV',
        tokenURI: 'ipfs://fork-multi-cliff-vest',
      })
      .saleConfig({
        initialSupply: 900_000n * WAD + primaryAmount + secondaryAmount,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, index) => ({
          tickLower: index * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
      })
      .withVesting({
        recipients: [account.address, secondaryRecipient],
        amounts: [primaryAmount, secondaryAmount],
        schedules: [
          {
            duration: primarySchedule.duration,
            cliffDuration: Number(primarySchedule.cliffDuration),
          },
          {
            duration: secondarySchedule.duration,
            cliffDuration: Number(secondarySchedule.cliffDuration),
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(account.address)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .build()

    let mining = true
    const miner = (async () => {
      while (mining) {
        try {
          await testClient.mine({ blocks: 1 })
        } catch {}
        await delay(150)
      }
    })()

    let result: Awaited<ReturnType<typeof sdk.factory.createMulticurve>>
    try {
      result = await sdk.factory.createMulticurve(params)
    } finally {
      mining = false
      await miner
    }

    const token = sdk.getDerc20V2(result.tokenAddress as Address)
    expect(await token.getVestingScheduleCount()).toBe(2n)
    expect(await token.getVestingSchedule(0n)).toEqual(primarySchedule)
    expect(await token.getVestingSchedule(1n)).toEqual(secondarySchedule)
    expect(await token.getScheduleIdsOf(account.address)).toEqual([0n])
    expect(await token.getScheduleIdsOf(secondaryRecipient)).toEqual([1n])
    expect(await token.getTotalAllocatedOf(account.address)).toBe(primaryAmount)
    expect(await token.getTotalAllocatedOf(secondaryRecipient)).toBe(
      secondaryAmount
    )

    const vestingStart = await token.getVestingStart()
    await mineToTimestamp(testClient, vestingStart + primarySchedule.cliffDuration + 1n)

    const primaryReleased =
      (primaryAmount * (primarySchedule.cliffDuration + 1n)) /
      primarySchedule.duration

    expect(
      await token.getAvailableVestedAmountForSchedule(account.address, 0n)
    ).toBe(primaryReleased)
    expect(
      await token.getAvailableVestedAmountForSchedule(secondaryRecipient, 1n)
    ).toBe(0n)

    await mineToTimestamp(
      testClient,
      vestingStart + secondarySchedule.cliffDuration + 1n
    )

    const secondaryReleased =
      (secondaryAmount * (secondarySchedule.cliffDuration + 1n)) /
      secondarySchedule.duration

    expect(
      await token.getAvailableVestedAmountForSchedule(secondaryRecipient, 1n)
    ).toBe(secondaryReleased)

    const releaseTx = await token.releaseFor(secondaryRecipient, 1n)
    await testClient.mine({ blocks: 1 })
    const releaseReceipt = await publicClient.waitForTransactionReceipt({
      hash: releaseTx,
    })
    const releaseBlock = await publicClient.getBlock({
      blockNumber: releaseReceipt.blockNumber,
    })
    const releasedAmount = vestedAmountAtTimestamp(
      secondaryAmount,
      vestingStart,
      releaseBlock.timestamp,
      secondarySchedule.duration
    )

    expect(await token.getVestingDataForSchedule(secondaryRecipient, 1n)).toEqual({
      totalAmount: secondaryAmount,
      releasedAmount,
    })
    expect(await token.getBalanceOf(secondaryRecipient)).toBe(releasedAmount)
  }, 120_000)
})
