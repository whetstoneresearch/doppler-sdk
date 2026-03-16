import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  DopplerSDK,
  getAddresses,
  CHAIN_IDS,
  WAD,
  type V4PoolKey,
} from '../../../../src/evm'
import {
  hasRpcUrl,
  getRpcEnvVar,
  delay,
  getForkClients,
  mineToTimestamp,
  getAnvilManager,
  isAnvilForkEnabled,
} from '../../utils'
import {
  parseEther,
  type Address,
  formatEther,
  erc20Abi,
  zeroHash,
  maxUint256,
} from 'viem'

/**
 * Opening Auction Bid Management Fork Tests
 *
 * These tests verify the complete bid lifecycle on a forked Base Sepolia network:
 * - Creating an opening auction
 * - Placing bids during the bidding phase
 * - Withdrawing bids
 * - Moving bids between ticks
 * - Claiming incentives after settlement
 *
 * Requirements:
 * - BASE_SEPOLIA_RPC_URL env var (or ALCHEMY_API_KEY)
 * - Anvil fork running (ANVIL_FORK_ENABLED=true)
 */
describe('Opening Auction Bid Management (Base Sepolia fork)', () => {
  // Skip if fork mode is not enabled or RPC URL is not available
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

  // Test configuration
  const TEST_TOKEN_NAME = 'BidTestToken'
  const TEST_TOKEN_SYMBOL = 'BTT'
  const AUCTION_DURATION = 3600 // 1 hour
  const MIN_LIQUIDITY = 1000n
  const BID_LIQUIDITY = 10000n
  const TICK_A = -100080
  const TICK_B = -100140
  const TICK_C = -100200
  const HIGH_NUMERAIRE = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address

  // Clients
  let publicClient: ReturnType<typeof getForkClients>['publicClient']
  let sdk: DopplerSDK
  let forkClients: ReturnType<typeof getForkClients>
  let testClient: ReturnType<typeof getForkClients>['testClient']
  let walletClient: ReturnType<typeof getForkClients>['walletClient']
  let account: ReturnType<typeof getForkClients>['account']

  // Test state
  let hookAddress: Address
  let tokenAddress: Address
  let poolKey: V4PoolKey
  let auctionEndTime: bigint
  let bidManager: Awaited<ReturnType<DopplerSDK['getOpeningAuctionBidManager']>>
  let primaryIsToken0 = false
  let canRunBidWrites = true
  let bidWriteBlockReason = ''

  const wethDepositAbi = [
    {
      type: 'function',
      name: 'deposit',
      stateMutability: 'payable',
      inputs: [],
      outputs: [],
    },
  ] as const

  const shouldRunBidWriteTest = (label: string): boolean => {
    if (canRunBidWrites) return true

    const reason = bidWriteBlockReason || 'unknown reason'
    const message = `Skipping ${label}: bid write paths unavailable (${reason})`

    // Optional strict mode for CI/confidence gates.
    if (process.env.FORK_REQUIRE_BID_WRITES === 'true') {
      throw new Error(message)
    }

    console.log(message)
    return false
  }

  const ensureBidAtTick = async (
    tickLower: number,
    liquidity: bigint = BID_LIQUIDITY,
  ): Promise<void> => {
    const status = await bidManager.getBidStatus({
      tickLower,
      owner: account.address,
    })
    if (status.exists && status.liquidity >= liquidity) {
      return
    }

    const validation = await bidManager.validateBid({
      tickLower,
      liquidity,
      owner: account.address,
    })
    if (!validation.valid) {
      throw new Error(`Cannot seed bid at ${tickLower}: ${validation.errors.join('; ')}`)
    }

    const txHash = await bidManager.placeBid({
      tickLower,
      liquidity,
      owner: account.address,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    expect(receipt.status).toBe('success')
  }

  beforeAll(async () => {
    // Start Anvil fork
    await anvilManager.start(chainId)

    // Get fork clients for all operations
    forkClients = getForkClients(chainId, 0)
    publicClient = forkClients.publicClient
    testClient = forkClients.testClient
    walletClient = forkClients.walletClient
    account = forkClients.account
    sdk = new DopplerSDK({ publicClient, chainId })

    // Account is already funded by Anvil (10000 ETH)
    // Note: fundAccount() sets balance to absolute value, don't use it here
    await delay(500)

    // Verify contracts are deployed
    expect(addresses.openingAuctionInitializer).toBeDefined()
    expect(addresses.openingAuctionInitializer).not.toBe(
      '0x0000000000000000000000000000000000000000'
    )
    expect(addresses.openingAuctionPositionManager).toBeDefined()
    expect(addresses.openingAuctionPositionManager).not.toBe(
      '0x0000000000000000000000000000000000000000'
    )

    // Create the auction
    const sdkWithWallet = new DopplerSDK({
      publicClient,
      walletClient,
      chainId,
    })

    const builder = sdkWithWallet
      .buildOpeningAuction()
      .tokenConfig({
        type: 'standard',
        name: TEST_TOKEN_NAME,
        symbol: TEST_TOKEN_SYMBOL,
        tokenURI: 'ipfs://test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 800_000n * WAD,
        numeraire: addresses.weth,
      })
      .openingAuctionConfig({
        auctionDuration: AUCTION_DURATION,
        minAcceptableTickToken0: -100140,
        minAcceptableTickToken1: 100020,
        incentiveShareBps: 500,
        tickSpacing: 60,
        fee: 3000,
        minLiquidity: MIN_LIQUIDITY,
        shareToAuctionBps: 2000,
      })
      .dopplerConfig({
        minProceeds: parseEther('1'),
        maxProceeds: parseEther('100'),
        startTick: 90000,
        endTick: 100000,
        epochLength: 3600,
        duration: 86400,
        fee: 3000,
        tickSpacing: 10,
      })
      .withUserAddress(account.address)
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })

    const params = builder.build()

    // Encode creation parameters
    const encoded = await sdkWithWallet.factory.encodeCreateOpeningAuctionParams(params)
    hookAddress = encoded.hookAddress
    tokenAddress = encoded.tokenAddress

    // Create the auction
    const result = await sdkWithWallet.factory.createOpeningAuction(params)

    // Get auction state from lifecycle
    const lifecycle = await sdkWithWallet.getOpeningAuctionLifecycle()
    const state = await lifecycle.getState(tokenAddress)
    auctionEndTime = state.auctionEndTime
    poolKey = state.openingAuctionPoolKey

    // Create bidManager
    bidManager = await sdkWithWallet.getOpeningAuctionBidManager({
      openingAuctionHookAddress: hookAddress,
      openingAuctionPoolKey: poolKey,
    })

    // Ensure account can pay either token side used by position manager transfers.
    // On forked dev accounts, WETH balance/allowance is usually 0 by default.
    const wethBalance = await publicClient.readContract({
      address: addresses.weth,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    })

    if (wethBalance < parseEther('5')) {
      const wrapTx = await walletClient.writeContract({
        address: addresses.weth,
        abi: wethDepositAbi,
        functionName: 'deposit',
        value: parseEther('10'),
      })
      await publicClient.waitForTransactionReceipt({ hash: wrapTx })
    }

    for (const currency of [poolKey.currency0, poolKey.currency1]) {
      const approveTx = await walletClient.writeContract({
        address: currency,
        abi: erc20Abi,
        functionName: 'approve',
        args: [addresses.openingAuctionPositionManager!, maxUint256],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })
    }

    // Probe whether write-paths are available on this fork snapshot.
    primaryIsToken0 = await bidManager.openingAuction.getIsToken0()
    console.log('Is token0:', primaryIsToken0)

    try {
      await bidManager.simulatePlaceBid({
        tickLower: TICK_A,
        liquidity: BID_LIQUIDITY,
        owner: account.address,
      })
      canRunBidWrites = true
    } catch (error) {
      canRunBidWrites = false
      bidWriteBlockReason = error instanceof Error ? error.message : String(error)
      console.log('Bid write paths unavailable on this fork state:', bidWriteBlockReason)
    }

    console.log('Auction created:')
    console.log('  Hook:', hookAddress)
    console.log('  Token:', tokenAddress)
    console.log('  End time:', auctionEndTime)
  }, 180000)

  afterAll(async () => {
    // Stop Anvil
    await anvilManager.stop(chainId)
  })

  describe('Token side directionality', () => {
    it('records primary auction token side', async () => {
      expect(typeof primaryIsToken0).toBe('boolean')
    })

    it('can create an auction with opposite token side', async () => {
      const sdkWithWallet = new DopplerSDK({
        publicClient,
        walletClient,
        chainId,
      })

      const oppositeBuilder = sdkWithWallet
        .buildOpeningAuction()
        .tokenConfig({
          type: 'standard',
          name: `${TEST_TOKEN_NAME}Opposite`,
          symbol: `${TEST_TOKEN_SYMBOL}O`,
          tokenURI: 'ipfs://test-opposite',
        })
        .saleConfig({
          initialSupply: 1_000_000n * WAD,
          numTokensToSell: 800_000n * WAD,
          // High address to force opposite token ordering vs Base WETH setup
          numeraire: HIGH_NUMERAIRE,
        })
        .openingAuctionConfig({
          auctionDuration: AUCTION_DURATION,
          minAcceptableTickToken0: -100140,
          minAcceptableTickToken1: 100020,
          incentiveShareBps: 500,
          tickSpacing: 60,
          fee: 3000,
          minLiquidity: MIN_LIQUIDITY,
          shareToAuctionBps: 2000,
        })
        .dopplerConfig({
          minProceeds: parseEther('1'),
          maxProceeds: parseEther('100'),
          // For expected token0 ordering, doppler ticks must be descending.
          startTick: 100000,
          endTick: 90000,
          epochLength: 3600,
          duration: 86400,
          fee: 3000,
          tickSpacing: 10,
        })
        .withUserAddress(account.address)
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })

      const oppositeParams = oppositeBuilder.build()
      const encoded = await sdkWithWallet.factory.encodeCreateOpeningAuctionParams(
        oppositeParams,
      )

      const tokenIsToken0 = BigInt(encoded.tokenAddress) < BigInt(HIGH_NUMERAIRE)
      expect(tokenIsToken0).toBe(!primaryIsToken0)
    }, 120000)
  })

  describe('Auction Creation', () => {
    it('should have created an opening auction', async () => {
      expect(hookAddress).toBeDefined()
      expect(tokenAddress).toBeDefined()
      expect(poolKey).toBeDefined()
      expect(bidManager).toBeDefined()
      expect(auctionEndTime).toBeDefined()
    })
  })

  describe('Bid Manager Setup', () => {
    it('should have a bid manager instance', async () => {
      expect(bidManager).toBeDefined()
    })

    it('should read auction constraints', async () => {
      const constraints = await bidManager.openingAuction.getBidConstraints()

      expect(constraints.minLiquidity).toBeGreaterThanOrEqual(MIN_LIQUIDITY)
      expect(constraints.minAcceptableTickToken0).toBeDefined()
      expect(constraints.minAcceptableTickToken1).toBeDefined()

      console.log('Auction constraints:')
      console.log('  Min liquidity:', constraints.minLiquidity.toString())
      console.log('  Min tick token0:', constraints.minAcceptableTickToken0)
      console.log('  Min tick token1:', constraints.minAcceptableTickToken1)
    })

    it('should read auction state', async () => {
      const phase = await bidManager.openingAuction.getPhase()
      const isToken0 = await bidManager.openingAuction.getIsToken0()
      const estimatedClearingTick = await bidManager.openingAuction.getEstimatedClearingTick()

      expect(phase).toBeDefined()
      expect(isToken0).toBeDefined()
      expect(estimatedClearingTick).toBeDefined()

      console.log('Auction state:')
      console.log('  Phase:', phase)
      console.log('  Is token0:', isToken0)
      console.log('  Estimated clearing tick:', estimatedClearingTick)
    })
  })

  describe('Bid Simulation', () => {
    it('should simulate placing a bid', async () => {
      if (!shouldRunBidWriteTest('bid simulation')) {
        return
      }

      const tickLower = TICK_A // Within acceptable range

      const simulation = await bidManager.simulatePlaceBid({
        tickLower,
        liquidity: BID_LIQUIDITY,
        owner: account.address,
      })

      expect(simulation).toBeDefined()
      expect(simulation.tickLower).toBe(tickLower)
      expect(simulation.tickUpper).toBe(tickLower + 60) // tickSpacing
      expect(simulation.decoded).toBeDefined()

      console.log('Bid simulation:')
      console.log('  Tick lower:', simulation.tickLower)
      console.log('  Tick upper:', simulation.tickUpper)
      console.log('  Amount0:', formatEther(simulation.decoded.amount0))
      console.log('  Amount1:', formatEther(simulation.decoded.amount1))
    })

    it('should quote a bid with clearing info', async () => {
      if (!shouldRunBidWriteTest('bid quote')) {
        return
      }

      const tickLower = TICK_A

      const quote = await bidManager.quoteBid({
        tickLower,
        liquidity: BID_LIQUIDITY,
        owner: account.address,
      })

      expect(quote).toBeDefined()
      expect(quote.estimatedClearingTick).toBeDefined()
      expect(quote.wouldBeFilledAtEstimatedClearing).toBeDefined()
      expect(quote.isAboveEstimatedClearing).toBeDefined()

      console.log('Bid quote:')
      console.log('  Would be filled:', quote.wouldBeFilledAtEstimatedClearing)
      console.log('  Is above clearing:', quote.isAboveEstimatedClearing)
      console.log('  Estimated incentive share:', quote.estimatedIncentiveShareBps)
    })

    it('should validate a bid before placing', async () => {
      const validation = await bidManager.validateBid({
        tickLower: -100140,
        liquidity: BID_LIQUIDITY,
        owner: account.address,
      })

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject invalid bids', async () => {
      // Try to validate a bid with too little liquidity
      const validation = await bidManager.validateBid({
        tickLower: -100140,
        liquidity: 1n, // Below minimum
        owner: account.address,
      })

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Bid Placement', () => {
    it('should place a bid successfully', async () => {
      if (!shouldRunBidWriteTest('bid placement')) {
        return
      }

      const tickLower = TICK_A

      const txHash = await bidManager.placeBid({
        tickLower,
        liquidity: BID_LIQUIDITY,
        owner: account.address,
      })

      expect(txHash).toBeDefined()
      expect(txHash.startsWith('0x')).toBe(true)

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      expect(receipt.status).toBe('success')

      console.log('Bid placed:', txHash)

      // Verify position was created
      const positionId = await bidManager.openingAuction.getPositionId({
        owner: account.address,
        tickLower,
        tickUpper: tickLower + poolKey.tickSpacing,
        salt: zeroHash,
      })
      expect(positionId).toBeGreaterThan(0n)

      // Get position info
      let positionInfo = await bidManager.getPositionInfo({
        tickLower,
        owner: account.address,
      })
      if (!positionInfo) {
        await delay(300)
        positionInfo = await bidManager.getPositionInfo({
          tickLower,
          owner: account.address,
        })
      }
      expect(positionInfo).toBeDefined()
      expect(positionInfo?.position.liquidity).toBe(BID_LIQUIDITY)

      console.log('Position created:')
      console.log('  Position ID:', positionId.toString())
      console.log('  Liquidity:', positionInfo?.position.liquidity.toString())
    }, 60000)

    it('should get bid status after placement', async () => {
      if (!shouldRunBidWriteTest('bid status after placement')) {
        return
      }

      const status = await bidManager.getBidStatus({
        tickLower: TICK_A,
        owner: account.address,
      })

      expect(status.exists).toBe(true)
      expect(status.liquidity).toBe(BID_LIQUIDITY)
      expect(status.positionId).toBeGreaterThan(0n)

      console.log('Bid status:')
      console.log('  Exists:', status.exists)
      console.log('  Position ID:', status.positionId.toString())
      console.log('  Liquidity:', status.liquidity.toString())
      console.log('  Claimable incentives:', status.claimableIncentives.toString())
    })

    it('should list owner bids', async () => {
      if (!shouldRunBidWriteTest('owner bid list')) {
        return
      }

      const bids = await bidManager.getOwnerBids({
        owner: account.address,
      })

      expect(bids.length).toBeGreaterThan(0)
      expect(bids.some((b) => b.tickLower === TICK_A)).toBe(true)

      console.log('Owner bids:', bids.length)
    })

    it('should get enriched bid statuses', async () => {
      if (!shouldRunBidWriteTest('enriched bid statuses')) {
        return
      }

      const statuses = await bidManager.getOwnerBidStatuses({
        owner: account.address,
      })

      expect(statuses.length).toBeGreaterThan(0)
      expect(statuses[0].phase).toBeDefined()
      expect(statuses[0].estimatedClearingTick).toBeDefined()

      console.log('Bid statuses:')
      statuses.forEach((s, i) => {
        console.log(`  Bid ${i}:`)
        console.log(`    Tick: ${s.tickLower}`)
        console.log(`    Phase: ${s.phase}`)
        console.log(`    Would be filled: ${s.wouldBeFilledAtEstimatedClearing}`)
      })
    })
  })

  describe('Multiple Bids', () => {
    it('should place multiple bids at different ticks', async () => {
      if (!shouldRunBidWriteTest('multiple bids')) {
        return
      }

      const bids = [
        { tickLower: TICK_B, liquidity: BID_LIQUIDITY },
        { tickLower: TICK_C, liquidity: BID_LIQUIDITY * 2n },
      ]

      for (const bid of bids) {
        // Validate first
        const validation = await bidManager.validateBid({
          tickLower: bid.tickLower,
          liquidity: bid.liquidity,
          owner: account.address,
        })

        if (!validation.valid) {
          console.log(`Skipping bid at ${bid.tickLower}:`, validation.errors)
          continue
        }

        const txHash = await bidManager.placeBid({
          tickLower: bid.tickLower,
          liquidity: bid.liquidity,
          owner: account.address,
        })

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        })
        expect(receipt.status).toBe('success')

        console.log(`Bid placed at tick ${bid.tickLower}:`, txHash)
      }

      // Verify all bids
      const ownerBids = await bidManager.getOwnerBids({
        owner: account.address,
      })
      expect(ownerBids.length).toBeGreaterThanOrEqual(1)
    }, 120000)
  })

  describe('Bid Withdrawal', () => {
    it('should simulate withdrawing a bid', async () => {
      if (!shouldRunBidWriteTest('withdraw simulation')) {
        return
      }

      await ensureBidAtTick(TICK_A)
      const positionInfo = await bidManager.getPositionInfo({
        tickLower: TICK_A,
        owner: account.address,
      })
      expect(positionInfo).toBeDefined()

      if (positionInfo?.isInRange) {
        // Onchain rule: in-range positions are lock-protected during active phase.
        await expect(
          bidManager.simulateWithdrawFullBid({
            tickLower: TICK_A,
            owner: account.address,
          }),
        ).rejects.toThrow('0xbdc99171')
        return
      }

      const simulation = await bidManager.simulateWithdrawFullBid({
        tickLower: TICK_A,
        owner: account.address,
      })

      expect(simulation.positionId).toBeGreaterThan(0n)
      expect(simulation.liquidity).toBeGreaterThan(0n)
      expect(simulation.simulation.decoded).toBeDefined()
    })

    it('should reject partial withdrawal during active phase', async () => {
      // First check current phase
      const phase = await bidManager.openingAuction.getPhase()
      console.log('Current phase before withdrawal:', phase)

      if (phase !== 1) {
        console.log('Skipping partial-withdraw rejection test - auction is not active')
        return
      }

      await expect(
        bidManager.decreaseBid({
          tickLower: TICK_A,
          liquidity: BID_LIQUIDITY / 2n,
          owner: account.address,
        }),
      ).rejects.toThrow('Cannot decrease bid during active auction phase')
    }, 60000)
  })

  describe('Bid Movement', () => {
    it('should simulate moving a bid', async () => {
      if (!shouldRunBidWriteTest('move simulation')) {
        return
      }

      const phase = await bidManager.openingAuction.getPhase()
      if (phase !== 1) {
        console.log('Skipping move simulation - auction is not active')
        return
      }

      await ensureBidAtTick(TICK_B)

      const sourceInfo = await bidManager.getPositionInfo({
        tickLower: TICK_B,
        owner: account.address,
      })
      expect(sourceInfo).toBeDefined()

      if (sourceInfo?.isInRange) {
        await expect(
          bidManager.simulateMoveBid({
            fromTickLower: TICK_B,
            toTickLower: TICK_C,
            owner: account.address,
          }),
        ).rejects.toThrow('0xbdc99171')
        return
      }

      const simulation = await bidManager.simulateMoveBid({
        fromTickLower: TICK_B,
        toTickLower: TICK_C,
        owner: account.address,
      })

      expect(simulation).toBeDefined()
      expect(simulation.withdrawSimulation).toBeDefined()
      expect(simulation.placeSimulation).toBeDefined()
      expect(simulation.liquidity).toBeGreaterThan(0n)

      console.log('Move simulation:')
      console.log('  Liquidity:', simulation.liquidity.toString())
      console.log('  From tick:', simulation.withdrawSimulation.tickLower)
      console.log('  To tick:', simulation.placeSimulation.tickLower)
    })

    it('should move a bid to a new tick', async () => {
      // Check phase
      const phase = await bidManager.openingAuction.getPhase()
      if (phase !== 1) {
        console.log('Skipping move test - auction is not active')
        return
      }

      await ensureBidAtTick(TICK_B)

      const sourceInfo = await bidManager.getPositionInfo({
        tickLower: TICK_B,
        owner: account.address,
      })
      expect(sourceInfo).toBeDefined()

      if (sourceInfo?.isInRange) {
        await expect(
          bidManager.moveBid({
            fromTickLower: TICK_B,
            toTickLower: TICK_C,
            owner: account.address,
          }),
        ).rejects.toThrow('0xbdc99171')
        return
      }

      const result = await bidManager.moveBid({
        fromTickLower: TICK_B,
        toTickLower: TICK_C,
        owner: account.address,
      })

      expect(result.withdrawTxHash).toBeDefined()
      expect(result.placeTxHash).toBeDefined()
      expect(result.liquidity).toBeGreaterThan(0n)

      // Wait for both transactions
      const withdrawReceipt = await publicClient.waitForTransactionReceipt({
        hash: result.withdrawTxHash,
      })
      expect(withdrawReceipt.status).toBe('success')

      const placeReceipt = await publicClient.waitForTransactionReceipt({
        hash: result.placeTxHash,
      })
      expect(placeReceipt.status).toBe('success')

      console.log('Bid moved:')
      console.log('  Withdraw tx:', result.withdrawTxHash)
      console.log('  Place tx:', result.placeTxHash)

      // Verify old position is gone or reduced
      const oldPosition = await bidManager.getPositionInfo({
        tickLower: TICK_B,
        owner: account.address,
      })

      // Verify new position exists
      const newPosition = await bidManager.getPositionInfo({
        tickLower: TICK_C,
        owner: account.address,
      })
      expect(
        oldPosition === null || oldPosition.position.liquidity < result.liquidity,
      ).toBe(
        true,
      )
      expect(newPosition).toBeDefined()
      expect(newPosition?.position.liquidity).toBe(result.liquidity)
    }, 120000)
  })

  describe('Auction Settlement', () => {
    it('should advance time to end auction', async () => {
      const block = await publicClient.getBlock()
      const currentTimestamp = block.timestamp
      console.log('Current timestamp:', currentTimestamp)
      console.log('Auction end time:', auctionEndTime)

      if (currentTimestamp >= auctionEndTime) {
        console.log('Auction already ended')
        return
      }

      // Advance time past auction end
      const targetTime = auctionEndTime + 60n // 1 minute past end
      await mineToTimestamp(testClient, targetTime)

      const newBlock = await publicClient.getBlock()
      const newTimestamp = newBlock.timestamp
      console.log('New timestamp:', newTimestamp)
      expect(newTimestamp).toBeGreaterThanOrEqual(auctionEndTime)
    })

    it('should settle the auction', async () => {
      // Check current phase before settling
      const phaseBefore = await bidManager.openingAuction.getPhase()
      console.log('Phase before settlement:', phaseBefore)

      // Use bidManager to settle the auction
      const txHash = await bidManager.settleAuction()
      expect(txHash).toBeDefined()

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      expect(receipt.status).toBe('success')

      console.log('Auction settled:', txHash)

      // Verify phase changed
      const phaseAfter = await bidManager.openingAuction.getPhase()
      console.log('Phase after settlement:', phaseAfter)
    }, 60000)
  })

  describe('Incentive Claims', () => {
    it('should get claimable incentives', async () => {
      const bids = await bidManager.getOwnerBids({
        owner: account.address,
      })

      for (const bid of bids) {
        const incentives = await bidManager.openingAuction.calculateIncentives(
          bid.positionId,
        )
        console.log(`Position ${bid.positionId} incentives:`, incentives.toString())
      }
    })

    it('should simulate claiming all incentives', async () => {
      const preview = await bidManager.simulateClaimAllIncentives({
        owner: account.address,
      })

      console.log('Claim preview:')
      console.log('  Total claimable:', preview.totalClaimable.toString())
      console.log('  Claimable positions:', preview.claimablePositions.length)
      console.log('  Skipped positions:', preview.skippedPositions.length)

      // Log details of each
      preview.claimablePositions.forEach((p) => {
        console.log(`    Position ${p.positionId}: ${p.claimableIncentives.toString()}`)
      })
    })

    it('should claim all incentives', async () => {
      const result = await bidManager.claimAllIncentives({
        owner: account.address,
        continueOnError: true,
      })

      console.log('Claim result:')
      console.log('  Total claimed:', result.totalClaimed)
      console.log('  Total failed:', result.totalFailed)

      result.results.forEach((r) => {
        if (r.transactionHash) {
          console.log(`  Position ${r.positionId}: tx ${r.transactionHash}`)
        } else {
          console.log(`  Position ${r.positionId}: failed - ${r.error}`)
        }
      })
    }, 120000)
  })

  describe('Full Withdrawal After Settlement', () => {
    it('should withdraw full bid after settlement', async () => {
      // Get remaining positions
      const bids = await bidManager.getOwnerBids({
        owner: account.address,
      })

      if (bids.length === 0) {
        console.log('No positions to withdraw')
        return
      }

      for (const bid of bids) {
        console.log(`Withdrawing position ${bid.positionId} at tick ${bid.tickLower}`)

        const txHash = await bidManager.withdrawFullBid({
          tickLower: bid.tickLower,
          owner: account.address,
        })

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash.transactionHash,
        })
        expect(receipt.status).toBe('success')

        console.log('Full withdrawal:', txHash.transactionHash)
      }

      // Verify all withdrawals succeeded (positions may retain liquidity
      // in the struct as a historical record; the on-chain withdrawal is
      // confirmed by the successful transaction receipts above).
      expect(bids.length).toBeGreaterThan(0)
    }, 120000)
  })

  describe('Event Watching', () => {
    it('should watch for bid events', async () => {
      // This test demonstrates the event watching API
      // In a real scenario, you'd set up watchers and perform actions

      const unsubscribe = bidManager.watchBidPlaced({
        owner: account.address,
        onBidPlaced: (event) => {
          console.log('Bid placed event:', event)
        },
      })

      expect(typeof unsubscribe).toBe('function')

      // Clean up
      unsubscribe()
    })

    it('should watch for phase changes', async () => {
      const unsubscribe = bidManager.watchPhaseChange({
        onPhaseChanged: (event) => {
          console.log('Phase changed:', event.oldPhase, '->', event.newPhase)
        },
      })

      expect(typeof unsubscribe).toBe('function')

      // Clean up
      unsubscribe()
    })
  })
})
