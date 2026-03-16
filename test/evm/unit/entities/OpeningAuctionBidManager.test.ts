import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hash } from 'viem';
import { zeroHash } from 'viem';
import {
  OpeningAuctionBidManager,
  type OpeningAuctionBidManagerConfig,
} from '../../../../src/evm/entities/auction/OpeningAuctionBidManager';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockHookAddress, mockTokenAddress } from '../../setup/fixtures/addresses';
import type { V4PoolKey } from '../../../../src/evm/types';

describe('OpeningAuctionBidManager', () => {
  const hookAddress = mockHookAddress;
  const positionManagerAddress =
    '0x1111111111111111111111111111111111111111' as Address;
  const ownerAddress =
    '0x0000000000000000000000000000000000000001' as Address;

  const mockPoolKey: V4PoolKey = {
    currency0: '0x0000000000000000000000000000000000000000' as Address,
    currency1: mockTokenAddress,
    fee: 3000,
    tickSpacing: 60,
    hooks: hookAddress,
  };

  const config: OpeningAuctionBidManagerConfig = {
    openingAuctionHookAddress: hookAddress,
    openingAuctionPoolKey: mockPoolKey,
    positionManagerAddress,
  };

  let manager: OpeningAuctionBidManager;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    manager = new OpeningAuctionBidManager(publicClient, walletClient, config);
  });

  describe('validateBid', () => {
    it('returns invalid with actionable errors for bad liquidity / settled phase', async () => {
      mockByFunction({
        minLiquidity: [100n],
        minAcceptableTickToken0: [-887220],
        minAcceptableTickToken1: [887220],
        phase: [3],
        isToken0: [true],
        estimatedClearingTick: [-100],
      });

      const result = await manager.validateBid({
        tickLower: -120,
        liquidity: 0n,
        owner: ownerAddress,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.join(' | ')).toContain('Liquidity must be greater than 0');
      expect(result.errors.join(' | ')).toContain('below minimum 100');
      expect(result.errors.join(' | ')).toContain('Auction is already settled');
    });

    it('returns warning when bid is above estimated clearing tick', async () => {
      mockByFunction({
        minLiquidity: [1n],
        minAcceptableTickToken0: [-887220],
        minAcceptableTickToken1: [887220],
        phase: [1],
        isToken0: [true],
        estimatedClearingTick: [-200],
      });

      const result = await manager.validateBid({
        tickLower: -120,
        liquidity: 1000n,
        owner: ownerAddress,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('above the estimated clearing tick');
    });

    it('handles token1-side warning semantics (isToken0=false)', async () => {
      mockByFunction({
        minLiquidity: [1n],
        minAcceptableTickToken0: [-887220],
        minAcceptableTickToken1: [887220],
        phase: [1],
        isToken0: [false],
        estimatedClearingTick: [100],
      });

      const result = await manager.validateBid({
        tickLower: 0,
        liquidity: 1000n,
        owner: ownerAddress,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('above the estimated clearing tick');
    });
  });

  describe('quoteFromTokenAmount', () => {
    it('throws when tokenAmount is non-positive', async () => {
      await expect(
        manager.quoteFromTokenAmount({
          tickLower: -120,
          tokenAmount: 0n,
          tokenIndex: 1,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('tokenAmount must be greater than 0');
    });

    it('throws when tokenIndex does not match auction side', async () => {
      mockByFunction({
        isToken0: [true],
      });

      await expect(
        manager.quoteFromTokenAmount({
          tickLower: -120,
          tokenAmount: 1000n,
          tokenIndex: 1,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('does not match auction side');
    });

    it('throws when tokenIndex mismatches token1-side auction (isToken0=false)', async () => {
      mockByFunction({
        isToken0: [false],
      });

      await expect(
        manager.quoteFromTokenAmount({
          tickLower: -120,
          tokenAmount: 1000n,
          tokenIndex: 0,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('does not match auction side');
    });
  });

  describe('simulateClaimIncentives (single position)', () => {
    it('resolves positionId and returns simulation payload', async () => {
      mockByFunction({
        positionKeyToId: [7n],
      });

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { gas: 123456n },
      } as any);

      const result = await manager.simulateClaimIncentives({
        tickLower: -120,
        owner: ownerAddress,
      });

      expect(result.positionId).toBe(7n);
      expect(result.gasEstimate).toBe(123456n);
    });
  });

  describe('fromHookAddress', () => {
    it('constructs manager by reading poolKey + positionManager from hook', async () => {
      mockByFunction({
        poolKey: [
          {
            currency0: mockPoolKey.currency0,
            currency1: mockPoolKey.currency1,
            fee: mockPoolKey.fee,
            tickSpacing: mockPoolKey.tickSpacing,
            hooks: hookAddress,
          },
        ],
        positionManager: [positionManagerAddress],
      });

      const created = await OpeningAuctionBidManager.fromHookAddress(
        publicClient,
        walletClient,
        hookAddress,
      );

      expect(created).toBeInstanceOf(OpeningAuctionBidManager);
      expect(created.getPoolKey()).toMatchObject(mockPoolKey);
      expect(created.getPositionManagerAddress()).toBe(positionManagerAddress);
    });
  });

  /**
   * Helper: set up a function-name-based mock for readContract.
   * Each key maps to a queue of return values for that functionName.
   */
  function mockByFunction(
    mapping: Record<string, any[] | ((call: any) => any | Promise<any>)>,
  ) {
    const queues: Record<string, any[]> = {};
    const handlers: Record<string, (call: any) => any | Promise<any>> = {};
    for (const [key, config] of Object.entries(mapping)) {
      if (typeof config === 'function') {
        handlers[key] = config;
      } else {
        queues[key] = [...config];
      }
    }

    const resolve = async (call: any) => {
      const fn = call?.functionName;
      if (handlers[fn]) {
        return await handlers[fn](call);
      }
      if (queues[fn] && queues[fn].length > 0) {
        return queues[fn].shift();
      }
      throw new Error(`Unexpected readContract call: ${fn}`);
    };

    vi.mocked(publicClient.readContract).mockImplementation(resolve);

    vi.mocked(publicClient.multicall).mockImplementation(async (args: any) => {
      const contracts = args?.contracts ?? [];
      return Promise.all(
        contracts.map(async (c: any) => {
          try {
            const result = await resolve(c);
            return { status: 'success', result };
          } catch {
            return { status: 'failure', error: new Error('revert') };
          }
        }),
      );
    });
  }

  describe('getOwnerBids', () => {
    it('returns empty array when owner has no positions', async () => {
      mockByFunction({
        ownerPositions: () => {
          throw new Error('index out of bounds');
        },
      });

      const result = await manager.getOwnerBids({ owner: ownerAddress });
      expect(result).toEqual([]);
    });

    it('resolves owner from walletClient when not provided', async () => {
      mockByFunction({
        ownerPositions: () => {
          throw new Error('index out of bounds');
        },
      });

      const result = await manager.getOwnerBids();
      expect(result).toEqual([]);
    });

    it('enumerates positions and returns enriched bid info', async () => {
      const otherOwner = '0x0000000000000000000000000000000000000099' as Address;

      mockByFunction({
        ownerPositions: (call: any) => {
          const index = call?.args?.[1] as bigint;
          if (index === 0n) return 1n;
          if (index === 1n) return 2n;
          throw new Error('index out of bounds');
        },
        // getOwnerPositions (indexed ids) then getMultiplePositionInfos re-reads position 1
        positions: [
          // indexed filter: position 1 (owner match), position 2 (no match)
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [otherOwner, -60, 0, 1000n, 0n, false],
          // getMultiplePositionInfos: getPosition(1) and isInRange->getPosition(1)
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [ownerAddress, -120, -60, 5000n, 0n, false],
        ],
        phase: [1], // isInRange
        isToken0: [true], // isInRange
        estimatedClearingTick: [-100], // isInRange: -100 < -60 => true
        calculateIncentives: [777n],
        isInRange: [], // not directly called on contract; computed client-side
      });

      const result = await manager.getOwnerBids({ owner: ownerAddress });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        positionId: 1n,
        owner: ownerAddress,
        tickLower: -120,
        tickUpper: -60,
        liquidity: 5000n,
        isInRange: true,
        claimableIncentives: 777n,
      });
    });
  });

  describe('getOwnerBidStatuses', () => {
    it('returns enriched statuses with clearing tick info', async () => {
      mockByFunction({
        ownerPositions: (call: any) => {
          const index = call?.args?.[1] as bigint;
          if (index === 0n) return 1n;
          throw new Error('index out of bounds');
        },
        positions: [
          // getOwnerPositions indexed filter
          [ownerAddress, -120, -60, 5000n, 0n, false],
          // getMultiplePositionInfos: getPosition(1)
          [ownerAddress, -120, -60, 5000n, 0n, false],
          // isInRange -> getPosition(1)
          [ownerAddress, -120, -60, 5000n, 0n, false],
        ],
        // phase: once for isInRange, once for getOwnerBidStatuses
        phase: [1, 1],
        // isToken0: once for isInRange, once for getOwnerBidStatuses
        isToken0: [true, true],
        // estimatedClearingTick: once for isInRange, once for getOwnerBidStatuses
        estimatedClearingTick: [-100, -100],
        calculateIncentives: [777n],
      });

      const result = await manager.getOwnerBidStatuses({ owner: ownerAddress });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        positionId: 1n,
        phase: 1,
        estimatedClearingTick: -100,
        wouldBeFilledAtEstimatedClearing: true,
        isAboveEstimatedClearing: false,
      });
    });
  });

  describe('getMultiplePositionInfos', () => {
    it('returns empty array for empty input', async () => {
      const result = await manager.getMultiplePositionInfos([]);
      expect(result).toEqual([]);
    });

    it('fetches and enriches multiple positions sorted by ID', async () => {
      mockByFunction({
        positions: [
          // position 5: getPosition
          [ownerAddress, -180, -120, 3000n, 10n, false],
          // position 3: getPosition
          [ownerAddress, -60, 0, 1000n, 5n, true],
          // isInRange -> getPosition for 5 and 3
          [ownerAddress, -180, -120, 3000n, 10n, false],
          [ownerAddress, -60, 0, 1000n, 5n, true],
        ],
        phase: [1, 1],
        isToken0: [true, true],
        estimatedClearingTick: [-150, -150],
        calculateIncentives: [100n, 200n],
      });

      const result = await manager.getMultiplePositionInfos([5n, 3n]);

      expect(result).toHaveLength(2);
      expect(result[0].positionId).toBe(3n);
      expect(result[1].positionId).toBe(5n);
    });
  });

  describe('getTickLiquidityDistribution', () => {
    it('reads liquidity across a tick range', async () => {
      mockByFunction({
        liquidityAtTick: [100n, 200n, 300n],
      });

      const result = await manager.getTickLiquidityDistribution({
        startTick: 0,
        endTick: 120,
        step: 60,
      });

      expect(result).toEqual([
        { tick: 0, liquidity: 100n },
        { tick: 60, liquidity: 200n },
        { tick: 120, liquidity: 300n },
      ]);
    });

    it('defaults step to pool tickSpacing', async () => {
      mockByFunction({
        liquidityAtTick: [10n, 20n],
      });

      const result = await manager.getTickLiquidityDistribution({
        startTick: 0,
        endTick: 60,
      });

      expect(result).toEqual([
        { tick: 0, liquidity: 10n },
        { tick: 60, liquidity: 20n },
      ]);
    });

    it('throws for non-integer step', async () => {
      await expect(
        manager.getTickLiquidityDistribution({
          startTick: 0,
          endTick: 120,
          step: 1.5,
        }),
      ).rejects.toThrow('step must be a positive integer');
    });

    it('throws when startTick > endTick', async () => {
      await expect(
        manager.getTickLiquidityDistribution({
          startTick: 120,
          endTick: 0,
          step: 60,
        }),
      ).rejects.toThrow('startTick must be <= endTick');
    });

    it('throws when tick range exceeds 1000 ticks', async () => {
      await expect(
        manager.getTickLiquidityDistribution({
          startTick: 0,
          endTick: 60060,
          step: 60,
        }),
      ).rejects.toThrow('Tick range too large');
    });

    it('throws when startTick is not aligned to tickSpacing', async () => {
      await expect(
        manager.getTickLiquidityDistribution({
          startTick: 10,
          endTick: 120,
          step: 60,
        }),
      ).rejects.toThrow('startTick (10) must be aligned to tickSpacing (60)');
    });

    it('throws when endTick is not aligned to tickSpacing', async () => {
      await expect(
        manager.getTickLiquidityDistribution({
          startTick: 0,
          endTick: 100,
          step: 60,
        }),
      ).rejects.toThrow('endTick (100) must be aligned to tickSpacing (60)');
    });

    it('throws when step is not a multiple of tickSpacing', async () => {
      await expect(
        manager.getTickLiquidityDistribution({
          startTick: 0,
          endTick: 120,
          step: 30,
        }),
      ).rejects.toThrow('step (30) must be a multiple of tickSpacing (60)');
    });
  });

  describe('watchBidPlaced', () => {
    it('calls watchContractEvent with correct params and returns unsubscribe', () => {
      const unsubFn = vi.fn();
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(unsubFn);

      const onBidPlaced = vi.fn();
      const unsub = manager.watchBidPlaced({
        onBidPlaced,
        owner: ownerAddress,
      });

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          eventName: 'BidPlaced',
          args: { owner: ownerAddress },
        }),
      );
      expect(typeof unsub).toBe('function');
    });

    it('parses log events and calls onBidPlaced callback', () => {
      let capturedOnLogs: any;
      vi.mocked(publicClient.watchContractEvent).mockImplementation((opts: any) => {
        capturedOnLogs = opts.onLogs;
        return () => {};
      });

      const onBidPlaced = vi.fn();
      manager.watchBidPlaced({ onBidPlaced });

      capturedOnLogs([
        {
          args: {
            positionId: 42n,
            owner: ownerAddress,
            tickLower: -120,
            liquidity: 5000n,
          },
          transactionHash: `0x${'ab'.repeat(32)}`,
          blockNumber: 100n,
          logIndex: 3,
        },
      ]);

      expect(onBidPlaced).toHaveBeenCalledWith({
        positionId: 42n,
        owner: ownerAddress,
        tickLower: -120,
        liquidity: 5000n,
        transactionHash: `0x${'ab'.repeat(32)}`,
        blockNumber: 100n,
        logIndex: 3,
      });
    });
  });

  describe('watchBidWithdrawn', () => {
    it('calls watchContractEvent with positionId filter', () => {
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(() => {});

      const onBidWithdrawn = vi.fn();
      manager.watchBidWithdrawn({
        onBidWithdrawn,
        positionId: 7n,
      });

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          eventName: 'BidWithdrawn',
          args: { positionId: 7n },
        }),
      );
    });

    it('parses log events and calls onBidWithdrawn callback', () => {
      let capturedOnLogs: any;
      vi.mocked(publicClient.watchContractEvent).mockImplementation((opts: any) => {
        capturedOnLogs = opts.onLogs;
        return () => {};
      });

      const onBidWithdrawn = vi.fn();
      manager.watchBidWithdrawn({ onBidWithdrawn });

      capturedOnLogs([
        {
          args: { positionId: 10n },
          transactionHash: `0x${'cd'.repeat(32)}`,
          blockNumber: 200n,
          logIndex: 1,
        },
      ]);

      expect(onBidWithdrawn).toHaveBeenCalledWith({
        positionId: 10n,
        transactionHash: `0x${'cd'.repeat(32)}`,
        blockNumber: 200n,
        logIndex: 1,
      });
    });
  });

  describe('watchIncentivesClaimed', () => {
    it('supports both owner and positionId filters', () => {
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(() => {});

      const onIncentivesClaimed = vi.fn();
      manager.watchIncentivesClaimed({
        onIncentivesClaimed,
        owner: ownerAddress,
        positionId: 5n,
      });

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          eventName: 'IncentivesClaimed',
          args: { owner: ownerAddress, positionId: 5n },
        }),
      );
    });

    it('parses log events and calls onIncentivesClaimed callback', () => {
      let capturedOnLogs: any;
      vi.mocked(publicClient.watchContractEvent).mockImplementation((opts: any) => {
        capturedOnLogs = opts.onLogs;
        return () => {};
      });

      const onIncentivesClaimed = vi.fn();
      manager.watchIncentivesClaimed({ onIncentivesClaimed });

      capturedOnLogs([
        {
          args: {
            positionId: 3n,
            owner: ownerAddress,
            amount: 999n,
          },
          transactionHash: `0x${'ef'.repeat(32)}`,
          blockNumber: 300n,
          logIndex: 0,
        },
      ]);

      expect(onIncentivesClaimed).toHaveBeenCalledWith({
        positionId: 3n,
        owner: ownerAddress,
        amount: 999n,
        transactionHash: `0x${'ef'.repeat(32)}`,
        blockNumber: 300n,
        logIndex: 0,
      });
    });
  });

  describe('watchPhaseChange', () => {
    it('sets up watcher for PhaseChanged events', () => {
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(() => {});

      const onPhaseChanged = vi.fn();
      const unsub = manager.watchPhaseChange({ onPhaseChanged });

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          eventName: 'PhaseChanged',
        }),
      );
      expect(typeof unsub).toBe('function');
    });

    it('parses log events and calls onPhaseChanged callback', () => {
      let capturedOnLogs: any;
      vi.mocked(publicClient.watchContractEvent).mockImplementation((opts: any) => {
        capturedOnLogs = opts.onLogs;
        return () => {};
      });

      const onPhaseChanged = vi.fn();
      manager.watchPhaseChange({ onPhaseChanged });

      capturedOnLogs([
        {
          args: { oldPhase: 1, newPhase: 2 },
          transactionHash: `0x${'11'.repeat(32)}`,
          blockNumber: 400n,
          logIndex: 2,
        },
      ]);

      expect(onPhaseChanged).toHaveBeenCalledWith({
        oldPhase: 1,
        newPhase: 2,
        transactionHash: `0x${'11'.repeat(32)}`,
        blockNumber: 400n,
        logIndex: 2,
      });
    });
  });

  describe('watchEstimatedClearingTick', () => {
    it('sets up watcher for EstimatedClearingTickUpdated events', () => {
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(() => {});

      const onEstimatedClearingTickUpdated = vi.fn();
      const unsub = manager.watchEstimatedClearingTick({
        onEstimatedClearingTickUpdated,
      });

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          eventName: 'EstimatedClearingTickUpdated',
        }),
      );
      expect(typeof unsub).toBe('function');
    });

    it('parses log events and calls onEstimatedClearingTickUpdated callback', () => {
      let capturedOnLogs: any;
      vi.mocked(publicClient.watchContractEvent).mockImplementation((opts: any) => {
        capturedOnLogs = opts.onLogs;
        return () => {};
      });

      const onEstimatedClearingTickUpdated = vi.fn();
      manager.watchEstimatedClearingTick({ onEstimatedClearingTickUpdated });

      capturedOnLogs([
        {
          args: { newEstimatedClearingTick: -500 },
          transactionHash: `0x${'22'.repeat(32)}`,
          blockNumber: 500n,
          logIndex: 0,
        },
      ]);

      expect(onEstimatedClearingTickUpdated).toHaveBeenCalledWith({
        newEstimatedClearingTick: -500,
        transactionHash: `0x${'22'.repeat(32)}`,
        blockNumber: 500n,
        logIndex: 0,
      });
    });
  });

  describe('getBidStatus (enriched)', () => {
    it('returns enriched status with clearing tick fields for existing position', async () => {
      mockByFunction({
        phase: [1, 1], // getBidStatus + isInRange
        isToken0: [true, true], // getBidStatus + isInRange
        estimatedClearingTick: [-100, -100], // getBidStatus + isInRange
        positionKeyToId: [5n], // getPositionId
        positions: [
          [ownerAddress, -120, -60, 5000n, 0n, false], // getPosition
          [ownerAddress, -120, -60, 5000n, 0n, false], // isInRange -> getPosition
        ],
        calculateIncentives: [42n],
      });

      const result = await manager.getBidStatus({
        tickLower: -120,
        owner: ownerAddress,
      });

      expect(result.exists).toBe(true);
      expect(result.positionId).toBe(5n);
      expect(result.liquidity).toBe(5000n);
      expect(result.phase).toBe(1);
      expect(result.estimatedClearingTick).toBe(-100);
      expect(result.wouldBeFilledAtEstimatedClearing).toBe(true);
      expect(result.isAboveEstimatedClearing).toBe(false);
    });

    it('returns default status when position does not exist', async () => {
      mockByFunction({
        phase: [1],
        isToken0: [true],
        estimatedClearingTick: [-100],
        positionKeyToId: [0n],
      });

      const result = await manager.getBidStatus({
        tickLower: -120,
        owner: ownerAddress,
      });

      expect(result.exists).toBe(false);
      expect(result.positionId).toBe(0n);
      expect(result.liquidity).toBe(0n);
      expect(result.wouldBeFilledAtEstimatedClearing).toBe(false);
      expect(result.isAboveEstimatedClearing).toBe(false);
    });
  });

  // --- Phase 2b Tests ---

  describe('increaseBid', () => {
    it('delegates to simulatePlaceBid for simulation', async () => {
      const mockResult = {
        request: { foo: 'bar' },
        gasEstimate: 100000n,
        delta: 123n,
        decoded: { amount0: -50n, amount1: 0n },
        tickLower: -120,
        tickUpper: -60,
        salt: zeroHash,
      };

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: mockResult.request,
        result: mockResult.delta,
      } as any);

      const result = await manager.simulateIncreaseBid({
        tickLower: -120,
        liquidity: 1000n,
        owner: ownerAddress,
      });

      expect(result.tickLower).toBe(-120);
      expect(result.tickUpper).toBe(-60);
    });

    it('delegates to estimatePlaceBidGas for gas estimation', async () => {
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { gas: 150000n },
        result: 0n,
      } as any);

      const gas = await manager.estimateIncreaseBidGas({
        tickLower: -120,
        liquidity: 1000n,
        owner: ownerAddress,
      });

      expect(gas).toBe(150000n);
    });

    it('delegates to placeBid for execution', async () => {
      const txHash = `0x${'cc'.repeat(32)}` as Hash;

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { foo: 'place' },
        result: 0n,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(txHash);

      const result = await manager.increaseBid({
        tickLower: -120,
        liquidity: 1000n,
        owner: ownerAddress,
      });

      expect(result).toBe(txHash);
    });
  });

  describe('decreaseBid', () => {
    it('delegates to simulateWithdrawBid for simulation', async () => {
      mockByFunction({
        phase: [2],
      });

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { foo: 'withdraw' },
        result: 0n,
      } as any);

      const result = await manager.simulateDecreaseBid({
        tickLower: -120,
        liquidity: 500n,
        owner: ownerAddress,
      });

      expect(result.tickLower).toBe(-120);
    });

    it('delegates to estimateWithdrawBidGas for gas estimation', async () => {
      mockByFunction({
        phase: [2],
      });

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { gas: 120000n },
        result: 0n,
      } as any);

      const gas = await manager.estimateDecreaseBidGas({
        tickLower: -120,
        liquidity: 500n,
        owner: ownerAddress,
      });

      expect(gas).toBe(120000n);
    });

    it('rejects simulateWithdrawBid when liquidity is non-positive', async () => {
      await expect(
        manager.simulateWithdrawBid({
          tickLower: -120,
          liquidity: 0n,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('withdrawBid requires liquidity > 0');
    });

    it('throws when phase is Active (phase 1)', async () => {
      // phase read returns Active (1)
      mockByFunction({
        phase: [1],
      });

      await expect(
        manager.decreaseBid({
          tickLower: -120,
          liquidity: 500n,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('Cannot decrease bid during active auction phase');
    });

    it('succeeds when phase is not Active', async () => {
      const txHash = `0x${'dd'.repeat(32)}` as Hash;

      // phase = Settled (3)
      mockByFunction({
        phase: [3],
      });

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { foo: 'withdraw' },
        result: 0n,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(txHash);

      const result = await manager.decreaseBid({
        tickLower: -120,
        liquidity: 500n,
        owner: ownerAddress,
      });

      expect(result).toBe(txHash);
    });
  });

  describe('moveBid', () => {
    it('throws when fromTickLower === toTickLower', async () => {
      await expect(
        manager.simulateMoveBid({
          fromTickLower: -120,
          toTickLower: -120,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('fromTickLower and toTickLower must be different');
    });

    it('throws when source position not found', async () => {
      mockByFunction({
        positionKeyToId: [0n],
      });

      await expect(
        manager.simulateMoveBid({
          fromTickLower: -120,
          toTickLower: -60,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('Source position not found');
    });

    it('throws when source position has zero liquidity', async () => {
      mockByFunction({
        positionKeyToId: [1n],
        positions: [[ownerAddress, -120, -60, 0n, 0n, false]],
      });

      await expect(
        manager.simulateMoveBid({
          fromTickLower: -120,
          toTickLower: -60,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('Source position has zero liquidity');
    });

    it('simulates both withdraw and place legs', async () => {
      mockByFunction({
        positionKeyToId: [1n],
        positions: [[ownerAddress, -120, -60, 5000n, 0n, false]],
        // assertValidBid (simulateMoveBid) + assertValidBid (simulatePlaceBid)
        minLiquidity: [1n, 1n],
        minAcceptableTickToken0: [-887220, -887220],
        minAcceptableTickToken1: [887220, 887220],
        phase: [1, 1],
        isToken0: [true, true],
        estimatedClearingTick: [-100, -100],
      });

      // withdraw simulation then place simulation
      vi.mocked(publicClient.simulateContract)
        .mockResolvedValueOnce({
          request: { fn: 'withdraw' },
          result: -100n,
        } as any)
        .mockResolvedValueOnce({
          request: { fn: 'place' },
          result: 200n,
        } as any);

      const result = await manager.simulateMoveBid({
        fromTickLower: -120,
        toTickLower: 0,
        owner: ownerAddress,
      });

      expect(result.liquidity).toBe(5000n);
      expect(result.withdrawSimulation.tickLower).toBe(-120);
      expect(result.placeSimulation.tickLower).toBe(0);
    });

    it('executes both transactions and returns both hashes', async () => {
      const withdrawHash = `0x${'aa'.repeat(32)}` as Hash;
      const placeHash = `0x${'bb'.repeat(32)}` as Hash;

      mockByFunction({
        positionKeyToId: [1n],
        positions: [[ownerAddress, -120, -60, 5000n, 0n, false]],
        // assertValidBid (moveBid) + assertValidBid (placeBid) + assertValidBid (simulatePlaceBid)
        minLiquidity: [1n, 1n, 1n],
        minAcceptableTickToken0: [-887220, -887220, -887220],
        minAcceptableTickToken1: [887220, 887220, 887220],
        phase: [1, 1, 1],
        isToken0: [true, true, true],
        estimatedClearingTick: [-100, -100, -100],
      });

      // simulate withdraw -> write withdraw -> simulate place -> write place
      vi.mocked(publicClient.simulateContract)
        .mockResolvedValueOnce({ request: { fn: 'withdraw' }, result: 0n } as any)
        .mockResolvedValueOnce({ request: { fn: 'place' }, result: 0n } as any);
      vi.mocked(walletClient.writeContract)
        .mockResolvedValueOnce(withdrawHash)
        .mockResolvedValueOnce(placeHash);

      const result = await manager.moveBid({
        fromTickLower: -120,
        toTickLower: 0,
        owner: ownerAddress,
      });

      expect(result.withdrawTxHash).toBe(withdrawHash);
      expect(result.placeTxHash).toBe(placeHash);
      expect(result.liquidity).toBe(5000n);
    });

    it('throws when no wallet client for execution', async () => {
      const readOnlyManager = new OpeningAuctionBidManager(
        publicClient,
        undefined,
        config,
      );

      await expect(
        readOnlyManager.moveBid({
          fromTickLower: -120,
          toTickLower: 0,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('Wallet client required for write operations');
    });

    it('validates fromTickLower !== toTickLower in moveBid execution', async () => {
      await expect(
        manager.moveBid({
          fromTickLower: -120,
          toTickLower: -120,
          owner: ownerAddress,
        }),
      ).rejects.toThrow('fromTickLower and toTickLower must be different');
    });
  });

  describe('quoteBid', () => {
    it('returns a complete quote with simulation data and clearing info', async () => {
      // simulatePlaceBid calls assertValidBid (which reads constraints + phase/isToken0/estimatedClearingTick),
      // then quoteBid also reads estimatedClearingTick and isToken0 directly in parallel
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { fn: 'place' },
        result: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9c0000000000000000000000000000000000000000000000000000000000000064'),
      } as any);

      mockByFunction({
        // assertValidBid (from simulatePlaceBid)
        minLiquidity: [1n],
        minAcceptableTickToken0: [-887220],
        minAcceptableTickToken1: [887220],
        phase: [1],
        // isToken0: assertValidBid + quoteBid direct call
        isToken0: [true, true],
        // estimatedClearingTick: assertValidBid + quoteBid direct call
        estimatedClearingTick: [-100, -100],
        liquidityAtTick: [2000n],
      });

      const result = await manager.quoteBid({
        tickLower: -120,
        liquidity: 3000n,
        owner: ownerAddress,
      });

      expect(result.tickLower).toBe(-120);
      expect(result.tickUpper).toBe(-60);
      expect(result.liquidity).toBe(3000n);
      expect(result.estimatedClearingTick).toBe(-100);
      // isToken0 && -100 < -60 => true
      expect(result.wouldBeFilledAtEstimatedClearing).toBe(true);
      // isToken0 && -120 > -100 => false
      expect(result.isAboveEstimatedClearing).toBe(false);
      expect(typeof result.estimatedIncentiveShareBps).toBe('number');
    });

    it('handles getLiquidityAtTick failure gracefully', async () => {
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { fn: 'place' },
        result: 0n,
      } as any);

      const readContractMock = vi.mocked(publicClient.readContract);
      readContractMock.mockImplementation(async (call: any) => {
        const fn = call?.functionName;
        if (fn === 'minLiquidity') return 1n;
        if (fn === 'minAcceptableTickToken0') return -887220;
        if (fn === 'minAcceptableTickToken1') return 887220;
        if (fn === 'phase') return 1;
        if (fn === 'estimatedClearingTick') return -100;
        if (fn === 'isToken0') return true;
        if (fn === 'liquidityAtTick') throw new Error('RPC error');
        throw new Error(`Unexpected: ${fn}`);
      });

      const result = await manager.quoteBid({
        tickLower: -120,
        liquidity: 3000n,
        owner: ownerAddress,
      });

      expect(result.estimatedIncentiveShareBps).toBeNull();
    });
  });

  describe('claimAllIncentives', () => {
    it('previews claimable positions correctly', async () => {
      // Spy on getOwnerBids to avoid non-deterministic mock queue issues with Promise.all
      const getOwnerBidsSpy = vi.spyOn(manager, 'getOwnerBids').mockResolvedValueOnce([
        {
          positionId: 1n,
          owner: ownerAddress,
          tickLower: -120,
          tickUpper: -60,
          liquidity: 5000n,
          rewardDebtX128: 0n,
          hasClaimedIncentives: false,
          isInRange: true,
          claimableIncentives: 500n,
        },
        {
          positionId: 2n,
          owner: ownerAddress,
          tickLower: -60,
          tickUpper: 0,
          liquidity: 3000n,
          rewardDebtX128: 0n,
          hasClaimedIncentives: true,
          isInRange: true,
          claimableIncentives: 200n,
        },
        {
          positionId: 3n,
          owner: ownerAddress,
          tickLower: 0,
          tickUpper: 60,
          liquidity: 1000n,
          rewardDebtX128: 0n,
          hasClaimedIncentives: false,
          isInRange: true,
          claimableIncentives: 0n,
        },
      ]);

      const preview = await manager.simulateClaimAllIncentives({ owner: ownerAddress });

      // Position 1: not claimed, in range, incentives 500n => claimable
      // Position 2: already claimed => skipped
      // Position 3: zero claimable => skipped
      expect(preview.claimablePositions).toHaveLength(1);
      expect(preview.claimablePositions[0].positionId).toBe(1n);
      expect(preview.claimablePositions[0].claimableIncentives).toBe(500n);
      expect(preview.totalClaimable).toBe(500n);
      expect(preview.skippedPositions).toHaveLength(2);
      expect(preview.skippedPositions[0].reason).toBe('already claimed');
      expect(preview.skippedPositions[1].reason).toBe('zero claimable');

      getOwnerBidsSpy.mockRestore();
    });

    it('claims all eligible positions sequentially', async () => {
      const txHash1 = `0x${'aa'.repeat(32)}` as Hash;

      // Mock for simulateClaimAllIncentives: minimal setup with 1 claimable position
      mockByFunction({
        ownerPositions: (call: any) => {
          const index = call?.args?.[1] as bigint;
          if (index === 0n) return 1n;
          throw new Error('index out of bounds');
        },
        positions: [
          // indexed filter
          [ownerAddress, -120, -60, 5000n, 0n, false],
          // getMultiplePositionInfos
          [ownerAddress, -120, -60, 5000n, 0n, false],
          // isInRange
          [ownerAddress, -120, -60, 5000n, 0n, false],
        ],
        phase: [1],
        isToken0: [true],
        estimatedClearingTick: [-100],
        calculateIncentives: [500n],
      });

      // simulateClaimIncentives for position 1
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { fn: 'claimIncentives', args: [1n] },
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(txHash1);

      const result = await manager.claimAllIncentives({ owner: ownerAddress });

      expect(result.totalClaimed).toBe(1);
      expect(result.totalFailed).toBe(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].transactionHash).toBe(txHash1);
    });

    it('stops on first error when continueOnError is false', async () => {
      mockByFunction({
        ownerPositions: (call: any) => {
          const index = call?.args?.[1] as bigint;
          if (index === 0n) return 1n;
          if (index === 1n) return 2n;
          throw new Error('index out of bounds');
        },
        positions: [
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [ownerAddress, 0, 60, 3000n, 0n, false],
          // getMultiplePositionInfos
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [ownerAddress, 0, 60, 3000n, 0n, false],
          // isInRange
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [ownerAddress, 0, 60, 3000n, 0n, false],
        ],
        phase: [1, 1],
        isToken0: [true, true],
        estimatedClearingTick: [-100, -100],
        calculateIncentives: [500n, 300n],
      });

      // First claim fails
      vi.mocked(publicClient.simulateContract).mockRejectedValueOnce(
        new Error('Simulation failed'),
      );

      const result = await manager.claimAllIncentives({
        owner: ownerAddress,
        continueOnError: false,
      });

      expect(result.totalFailed).toBe(1);
      expect(result.totalClaimed).toBe(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].error).toContain('Simulation failed');
    });

    it('continues on error when continueOnError is true', async () => {
      const txHash2 = `0x${'bb'.repeat(32)}` as Hash;

      mockByFunction({
        ownerPositions: (call: any) => {
          const index = call?.args?.[1] as bigint;
          if (index === 0n) return 1n;
          if (index === 1n) return 2n;
          throw new Error('index out of bounds');
        },
        positions: [
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [ownerAddress, -150, -50, 3000n, 0n, false],
          // getMultiplePositionInfos
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [ownerAddress, -150, -50, 3000n, 0n, false],
          // isInRange
          [ownerAddress, -120, -60, 5000n, 0n, false],
          [ownerAddress, -150, -50, 3000n, 0n, false],
        ],
        phase: [1, 1],
        isToken0: [true, true],
        estimatedClearingTick: [-100, -100],
        calculateIncentives: [500n, 300n],
      });

      // First claim fails, second succeeds
      vi.mocked(publicClient.simulateContract)
        .mockRejectedValueOnce(new Error('Simulation failed'))
        .mockResolvedValueOnce({ request: { fn: 'claim2' } } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(txHash2);

      const result = await manager.claimAllIncentives({
        owner: ownerAddress,
        continueOnError: true,
      });

      expect(result.totalFailed).toBe(1);
      expect(result.totalClaimed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].error).toContain('Simulation failed');
      expect(result.results[1].transactionHash).toBe(txHash2);
    });

    it('throws when no wallet client for claimAllIncentives', async () => {
      const readOnlyManager = new OpeningAuctionBidManager(
        publicClient,
        undefined,
        config,
      );

      await expect(
        readOnlyManager.claimAllIncentives({ owner: ownerAddress }),
      ).rejects.toThrow('Wallet client required for write operations');
    });
  });

  describe('watchBidStatus', () => {
    it('sets up watchBlockNumber and returns unsubscribe function', () => {
      const unwatchFn = vi.fn();
      vi.mocked(publicClient.watchBlockNumber).mockReturnValue(unwatchFn);

      const onStatusChange = vi.fn();
      const unsub = manager.watchBidStatus({
        tickLower: -120,
        owner: ownerAddress,
        onStatusChange,
      });

      expect(publicClient.watchBlockNumber).toHaveBeenCalledWith(
        expect.objectContaining({
          emitOnBegin: true,
        }),
      );
      expect(typeof unsub).toBe('function');
    });

    it('polls getBidStatus on each block and calls onStatusChange on first emit', async () => {
      let capturedOnBlockNumber: any;
      vi.mocked(publicClient.watchBlockNumber).mockImplementation((opts: any) => {
        capturedOnBlockNumber = opts.onBlockNumber;
        return () => {};
      });

      // Mock getBidStatus via the underlying reads
      const getBidStatusSpy = vi.spyOn(manager, 'getBidStatus').mockResolvedValue({
        exists: true,
        owner: ownerAddress,
        tickLower: -120,
        tickUpper: -60,
        liquidity: 5000n,
        rewardDebtX128: 0n,
        hasClaimedIncentives: false,
        isInRange: true,
        claimableIncentives: 100n,
        positionId: 1n,
        phase: 1,
        estimatedClearingTick: -100,
        wouldBeFilledAtEstimatedClearing: true,
        isAboveEstimatedClearing: false,
      });

      const onStatusChange = vi.fn();
      manager.watchBidStatus({
        tickLower: -120,
        owner: ownerAddress,
        onStatusChange,
      });

      // Trigger a block
      capturedOnBlockNumber(100n);
      // Allow async polling to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(getBidStatusSpy).toHaveBeenCalled();
      expect(onStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ exists: true, liquidity: 5000n }),
        null, // previousStatus is null on first emit
      );

      getBidStatusSpy.mockRestore();
    });

    it('does not call onStatusChange when status has not changed', async () => {
      let capturedOnBlockNumber: any;
      vi.mocked(publicClient.watchBlockNumber).mockImplementation((opts: any) => {
        capturedOnBlockNumber = opts.onBlockNumber;
        return () => {};
      });

      const stableStatus = {
        exists: true,
        owner: ownerAddress,
        tickLower: -120,
        tickUpper: -60,
        liquidity: 5000n,
        rewardDebtX128: 0n,
        hasClaimedIncentives: false,
        isInRange: true,
        claimableIncentives: 100n,
        positionId: 1n,
        phase: 1,
        estimatedClearingTick: -100,
        wouldBeFilledAtEstimatedClearing: true,
        isAboveEstimatedClearing: false,
      };

      const getBidStatusSpy = vi.spyOn(manager, 'getBidStatus').mockResolvedValue(stableStatus);

      const onStatusChange = vi.fn();
      manager.watchBidStatus({
        tickLower: -120,
        owner: ownerAddress,
        onStatusChange,
      });

      // First block - should fire (first emit)
      capturedOnBlockNumber(100n);
      await new Promise((r) => setTimeout(r, 50));
      expect(onStatusChange).toHaveBeenCalledTimes(1);

      // Second block - same status, should NOT fire
      capturedOnBlockNumber(101n);
      await new Promise((r) => setTimeout(r, 50));
      expect(onStatusChange).toHaveBeenCalledTimes(1);

      getBidStatusSpy.mockRestore();
    });

    it('calls onError when getBidStatus throws', async () => {
      let capturedOnBlockNumber: any;
      vi.mocked(publicClient.watchBlockNumber).mockImplementation((opts: any) => {
        capturedOnBlockNumber = opts.onBlockNumber;
        return () => {};
      });

      const getBidStatusSpy = vi.spyOn(manager, 'getBidStatus').mockRejectedValue(
        new Error('RPC failure'),
      );

      const onStatusChange = vi.fn();
      const onError = vi.fn();
      manager.watchBidStatus({
        tickLower: -120,
        owner: ownerAddress,
        onStatusChange,
        onError,
      });

      capturedOnBlockNumber(100n);
      await new Promise((r) => setTimeout(r, 50));

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onStatusChange).not.toHaveBeenCalled();

      getBidStatusSpy.mockRestore();
    });

    it('stops polling when unsubscribe is called', async () => {
      let capturedOnBlockNumber: any;
      const unwatchBlock = vi.fn();
      vi.mocked(publicClient.watchBlockNumber).mockImplementation((opts: any) => {
        capturedOnBlockNumber = opts.onBlockNumber;
        return unwatchBlock;
      });

      const getBidStatusSpy = vi.spyOn(manager, 'getBidStatus').mockResolvedValue({
        exists: false,
        owner: ownerAddress,
        tickLower: -120,
        tickUpper: -60,
        liquidity: 0n,
        rewardDebtX128: 0n,
        hasClaimedIncentives: false,
        isInRange: false,
        claimableIncentives: 0n,
        positionId: 0n,
        phase: 0,
        estimatedClearingTick: 0,
        wouldBeFilledAtEstimatedClearing: false,
        isAboveEstimatedClearing: false,
      });

      const onStatusChange = vi.fn();
      const unsub = manager.watchBidStatus({
        tickLower: -120,
        owner: ownerAddress,
        onStatusChange,
      });

      unsub();
      expect(unwatchBlock).toHaveBeenCalled();

      // Trigger after unsubscribe - should not poll
      getBidStatusSpy.mockClear();
      capturedOnBlockNumber(200n);
      await new Promise((r) => setTimeout(r, 50));

      expect(getBidStatusSpy).not.toHaveBeenCalled();

      getBidStatusSpy.mockRestore();
    });
  });
});

// --- DopplerSDK.getOpeningAuctionBidManager integration ---
describe('DopplerSDK.getOpeningAuctionBidManager', () => {
  // We test the integration by importing DopplerSDK and verifying it creates
  // an OpeningAuctionBidManager correctly.
  // We need to mock getOpeningAuctionPositionManager since it reads from chain.

  it('creates an OpeningAuctionBidManager via SDK entrypoint', async () => {
    const { DopplerSDK } = await import('../../../src/DopplerSDK');

    const publicClient = createMockPublicClient();
    const walletClient = createMockWalletClient();

    const sdk = new DopplerSDK({
      publicClient,
      walletClient,
      chainId: 1,
    });

    const hookAddress = mockHookAddress;
    const pmAddress =
      '0x1111111111111111111111111111111111111111' as Address;
    const poolKey: V4PoolKey = {
      currency0: '0x0000000000000000000000000000000000000000' as Address,
      currency1: mockTokenAddress,
      fee: 3000,
      tickSpacing: 60,
      hooks: hookAddress,
    };

    // Explicitly pass positionManagerAddress to bypass chain-config lookup
    const bidManager = await sdk.getOpeningAuctionBidManager({
      openingAuctionHookAddress: hookAddress,
      openingAuctionPoolKey: poolKey,
      positionManagerAddress: pmAddress,
    });

    expect(bidManager).toBeInstanceOf(OpeningAuctionBidManager);
  });

  it('throws when no positionManagerAddress is available on chain', async () => {
    const { DopplerSDK } = await import('../../../src/DopplerSDK');

    const publicClient = createMockPublicClient();
    const walletClient = createMockWalletClient();

    const sdk = new DopplerSDK({
      publicClient,
      walletClient,
      chainId: 1,
    });

    const hookAddress = mockHookAddress;
    const poolKey: V4PoolKey = {
      currency0: '0x0000000000000000000000000000000000000000' as Address,
      currency1: mockTokenAddress,
      fee: 3000,
      tickSpacing: 60,
      hooks: hookAddress,
    };

    // No positionManagerAddress passed and chain 1 doesn't have one configured
    await expect(
      sdk.getOpeningAuctionBidManager({
        openingAuctionHookAddress: hookAddress,
        openingAuctionPoolKey: poolKey,
      }),
    ).rejects.toThrow('OpeningAuctionPositionManager address is not configured');
  });
});
