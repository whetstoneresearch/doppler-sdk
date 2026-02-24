import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hash } from 'viem';
import { OpeningAuction } from '../../../src/entities/auction/OpeningAuction';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockHookAddress, mockTokenAddress } from '../../setup/fixtures/addresses';

describe('OpeningAuction', () => {
  const hookAddress = mockHookAddress;
  const mockPositionManagerAddress =
    '0x1111111111111111111111111111111111111111' as Address;

  let auction: OpeningAuction;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    auction = new OpeningAuction(publicClient, walletClient, hookAddress);
  });

  describe('getAddress', () => {
    it('returns the hook address', () => {
      expect(auction.getAddress()).toBe(hookAddress);
    });
  });

  describe('getPositionManager', () => {
    it('reads the position manager address', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(
        mockPositionManagerAddress,
      );

      const result = await auction.getPositionManager();

      expect(result).toBe(mockPositionManagerAddress);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'positionManager',
      });
    });
  });

  describe('getPositionHarvestedTime', () => {
    it('reads the harvested-time snapshot for a position', async () => {
      const positionId = 7n;
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(42n);

      const result = await auction.getPositionHarvestedTime(positionId);

      expect(result).toBe(42n);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'positionHarvestedTimeX128',
        args: [positionId],
      });
    });
  });

  describe('getPosition', () => {
    it('converts tuple responses from the contract', async () => {
      const tupleResponse = [
        mockTokenAddress,
        -100n,
        0n,
        1000n,
        1234n,
        false,
      ] as const;
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(tupleResponse);

      const result = await auction.getPosition(13n);

      expect(result).toEqual({
        owner: mockTokenAddress,
        tickLower: -100,
        tickUpper: 0,
        liquidity: 1000n,
        rewardDebtX128: 1234n,
        hasClaimedIncentives: false,
      });
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'positions',
        args: [13n],
      });
    });

    it('handles struct-like responses', async () => {
      const objectResponse = {
        owner: mockTokenAddress,
        tickLower: -60n,
        tickUpper: -20n,
        liquidity: 5000n,
        rewardDebtX128: 10n,
        hasClaimedIncentives: true,
      };
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(objectResponse);

      const result = await auction.getPosition(99n);

      expect(result).toEqual({
        owner: mockTokenAddress,
        tickLower: -60,
        tickUpper: -20,
        liquidity: 5000n,
        rewardDebtX128: 10n,
        hasClaimedIncentives: true,
      });
    });
  });

  describe('isInRange', () => {
    it('uses native hook isInRange when available', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(true as any);

      const result = await auction.isInRange(2n);

      expect(result).toBe(true);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'isInRange',
        args: [2n],
      });
    });

    it('computes client-side based on phase and isToken0', async () => {
      // Mock: getPosition, getPhase, getIsToken0, getEstimatedClearingTick
      // Position at tickLower=-100, tickUpper=0; phase=2 (Active); isToken0=true; estimatedClearingTick=-50
      vi.mocked(publicClient.readContract)
        .mockRejectedValueOnce(new Error('native isInRange unavailable'))
        .mockResolvedValueOnce([
          mockTokenAddress,
          -100,
          0,
          1000n,
          0n,
          false,
        ] as any) // positions
        .mockResolvedValueOnce(2) // phase (Active)
        .mockResolvedValueOnce(true) // isToken0
        .mockResolvedValueOnce(-50); // estimatedClearingTick

      // isToken0 && refTick(-50) < tickUpper(0) => true
      const result = await auction.isInRange(2n);

      expect(result).toBe(true);
    });

    it('returns false for NotStarted phase', async () => {
      vi.mocked(publicClient.readContract)
        .mockRejectedValueOnce(new Error('native isInRange unavailable'))
        .mockResolvedValueOnce([
          mockTokenAddress,
          -100,
          0,
          1000n,
          0n,
          false,
        ] as any) // positions
        .mockResolvedValueOnce(0) // phase (NotStarted)
        .mockResolvedValueOnce(true); // isToken0

      const result = await auction.isInRange(2n);
      expect(result).toBe(false);
    });
  });

  describe('calculateIncentives', () => {
    it('calls the hook with the position id', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(77n);

      const result = await auction.calculateIncentives(3n);

      expect(result).toBe(77n);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'calculateIncentives',
        args: [3n],
      });
    });
  });

  describe('settleAuction', () => {
    const txHash = `0x${'aa'.repeat(32)}` as Hash;

    it('simulates then writes to the wallet client', async () => {
      const request = { foo: 'bar' };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(txHash);

      const result = await auction.settleAuction();

      expect(result).toBe(txHash);
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'settleAuction',
        account: walletClient.account,
      });
      expect(walletClient.writeContract).toHaveBeenCalledWith(request);
    });

    it('throws when no wallet client is configured', async () => {
      const readOnlyAuction = new OpeningAuction(
        publicClient,
        undefined,
        hookAddress,
      );

      await expect(readOnlyAuction.settleAuction()).rejects.toThrow(
        'Wallet client required for write operations',
      );
    });
  });

  describe('claimIncentives', () => {
    const positionId = 13n;
    const txHash = `0x${'bb'.repeat(32)}` as Hash;

    it('simulates then writes the claim call', async () => {
      const request = { foo: 'claim' };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(txHash);

      const result = await auction.claimIncentives(positionId);

      expect(result).toBe(txHash);
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'claimIncentives',
        args: [positionId],
        account: walletClient.account,
      });
      expect(walletClient.writeContract).toHaveBeenCalledWith(request);
    });

    it('throws when no wallet client is configured', async () => {
      const readOnlyAuction = new OpeningAuction(
        publicClient,
        undefined,
        hookAddress,
      );

      await expect(readOnlyAuction.claimIncentives(positionId)).rejects.toThrow(
        'Wallet client required for write operations',
      );
    });
  });

  describe('position-id helpers', () => {
    it('getPositionId computes key client-side then reads positionKeyToId', async () => {
      const salt = `0x${'11'.repeat(32)}` as Hash;
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(123n);

      const result = await auction.getPositionId({
        owner: mockTokenAddress,
        tickLower: -120,
        tickUpper: -60,
        salt,
      });

      expect(result).toBe(123n);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'positionKeyToId',
        args: [expect.any(String)],
      });
    });

    it('getPositionIdFromKey reads the positionKeyToId mapping', async () => {
      const positionKey = `0x${'22'.repeat(32)}` as Hash;
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(456n);

      const result = await auction.getPositionIdFromKey(positionKey);

      expect(result).toBe(456n);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'positionKeyToId',
        args: [positionKey],
      });
    });
  });

  describe('getEstimatedClearingTick', () => {
    it('reads the estimated clearing tick and converts to number', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(-500);

      const result = await auction.getEstimatedClearingTick();

      expect(result).toBe(-500);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'estimatedClearingTick',
      });
    });
  });

  describe('getLiquidityAtTick', () => {
    it('reads liquidity for a valid tick', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(5000n);

      const result = await auction.getLiquidityAtTick(-120);

      expect(result).toBe(5000n);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'liquidityAtTick',
        args: [-120],
      });
    });

    it('throws for non-integer tick', async () => {
      await expect(auction.getLiquidityAtTick(1.5)).rejects.toThrow(
        'tick must be an integer',
      );
    });

    it('throws for tick below int24 min', async () => {
      await expect(auction.getLiquidityAtTick(-8_388_609)).rejects.toThrow(
        'tick out of int24 bounds',
      );
    });

    it('throws for tick above int24 max', async () => {
      await expect(auction.getLiquidityAtTick(8_388_608)).rejects.toThrow(
        'tick out of int24 bounds',
      );
    });

    it('accepts tick at int24 boundary values', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(1n);
      await expect(auction.getLiquidityAtTick(-8_388_608)).resolves.toBe(1n);

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(2n);
      await expect(auction.getLiquidityAtTick(8_388_607)).resolves.toBe(2n);
    });
  });

  describe('getNextPositionId', () => {
    it('reads the next position id', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(5n);

      const result = await auction.getNextPositionId();

      expect(result).toBe(5n);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'nextPositionId',
      });
    });

    it('throws when nextPositionId returns 0n (malformed state)', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(0n);

      await expect(auction.getNextPositionId()).rejects.toThrow(
        'nextPositionId returned 0',
      );
    });
  });

  describe('getOwnerPositionIdAt', () => {
    it('reads the owner position id at the given index', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(7n);

      const owner = '0x0000000000000000000000000000000000000001' as Address;
      const result = await auction.getOwnerPositionIdAt(owner, 2n);

      expect(result).toBe(7n);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'ownerPositions',
        args: [owner, 2n],
      });
    });
  });

  describe('getOwnerPositions', () => {
    it('uses owner-indexed enumeration when available', async () => {
      const owner = '0x0000000000000000000000000000000000000001' as Address;

      vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
        if (call?.functionName === 'ownerPositions') {
          const index = call?.args?.[1] as bigint;
          if (index === 0n) return 11n;
          if (index === 1n) return 22n;
          throw new Error('index out of bounds');
        }
        if (call?.functionName === 'positions') {
          const id = call?.args?.[0] as bigint;
          if (id === 11n) return [owner, -100, 0, 1000n, 0n, false];
          if (id === 22n) return [owner, -80, 0, 0n, 0n, false];
        }
        throw new Error(`Unexpected: ${call?.functionName}`);
      });

      const result = await auction.getOwnerPositions(owner);
      expect(result).toEqual([11n]);
    });

    it('returns empty array when nextPositionId is 1 (no positions)', async () => {
      vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
        if (call?.functionName === 'ownerPositions') {
          throw new Error('ownerPositions unavailable');
        }
        if (call?.functionName === 'nextPositionId') return 1n;
        throw new Error(`Unexpected: ${call?.functionName}`);
      });

      const owner = '0x0000000000000000000000000000000000000001' as Address;
      const result = await auction.getOwnerPositions(owner);

      expect(result).toEqual([]);
    });

    it('scans and filters positions by owner with non-zero liquidity', async () => {
      const owner = '0x0000000000000000000000000000000000000001' as Address;
      const otherOwner = '0x0000000000000000000000000000000000000099' as Address;

      const positions = new Map<bigint, any>([
        [1n, [owner, -100, 0, 1000n, 0n, false]],
        [2n, [otherOwner, -60, 0, 500n, 0n, false]],
        [3n, [owner, -200, -100, 0n, 0n, false]],
      ]);

      vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
        if (call?.functionName === 'ownerPositions') {
          throw new Error('ownerPositions unavailable');
        }
        if (call?.functionName === 'nextPositionId') return 4n;
        if (call?.functionName === 'positions') {
          return positions.get(call?.args?.[0]);
        }
        throw new Error(`Unexpected: ${call?.functionName}`);
      });

      const result = await auction.getOwnerPositions(owner);

      expect(result).toEqual([1n]);
    });
  });

  describe('isInRange - comprehensive', () => {
    const owner = mockTokenAddress;
    const zeroAddr = '0x0000000000000000000000000000000000000000' as Address;

    it('returns false for zero-address owner (non-existent position)', async () => {
      vi.mocked(publicClient.readContract)
        .mockRejectedValueOnce(new Error('native isInRange unavailable'))
        .mockResolvedValueOnce([zeroAddr, -100, 0, 0n, 0n, false] as any) // positions
        .mockResolvedValueOnce(1) // phase (Active)
        .mockResolvedValueOnce(true); // isToken0

      const result = await auction.isInRange(99n);
      expect(result).toBe(false);
    });

    it('returns true for isToken0=false when refTick >= tickLower', async () => {
      // !isToken0: refTick >= tickLower => true
      vi.mocked(publicClient.readContract)
        .mockRejectedValueOnce(new Error('native isInRange unavailable'))
        .mockResolvedValueOnce([owner, -100, 0, 1000n, 0n, false] as any) // positions
        .mockResolvedValueOnce(1) // phase (Active)
        .mockResolvedValueOnce(false) // isToken0
        .mockResolvedValueOnce(-50); // estimatedClearingTick

      const result = await auction.isInRange(1n);
      expect(result).toBe(true); // -50 >= -100
    });

    it('returns false for isToken0=false when refTick < tickLower', async () => {
      vi.mocked(publicClient.readContract)
        .mockRejectedValueOnce(new Error('native isInRange unavailable'))
        .mockResolvedValueOnce([owner, -100, 0, 1000n, 0n, false] as any)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(false) // isToken0
        .mockResolvedValueOnce(-200); // estimatedClearingTick

      const result = await auction.isInRange(1n);
      expect(result).toBe(false); // -200 < -100
    });

    it('returns false for isToken0=true when refTick >= tickUpper', async () => {
      vi.mocked(publicClient.readContract)
        .mockRejectedValueOnce(new Error('native isInRange unavailable'))
        .mockResolvedValueOnce([owner, -100, 0, 1000n, 0n, false] as any)
        .mockResolvedValueOnce(2) // phase (Closed)
        .mockResolvedValueOnce(true) // isToken0
        .mockResolvedValueOnce(0); // estimatedClearingTick = tickUpper

      const result = await auction.isInRange(1n);
      expect(result).toBe(false); // 0 is NOT < 0
    });

    it('uses clearingTick for settled phase', async () => {
      vi.mocked(publicClient.readContract)
        .mockRejectedValueOnce(new Error('native isInRange unavailable'))
        .mockResolvedValueOnce([owner, -100, 0, 1000n, 0n, false] as any) // positions
        .mockResolvedValueOnce(3) // phase (Settled)
        .mockResolvedValueOnce(true) // isToken0
        // getSettlementData reads: clearingTick, totalTokensSold, totalProceeds, totalAuctionTokens, incentiveTokensTotal
        .mockResolvedValueOnce(-50) // clearingTick
        .mockResolvedValueOnce(1000n) // totalTokensSold
        .mockResolvedValueOnce(500n) // totalProceeds
        .mockResolvedValueOnce(2000n) // totalAuctionTokens
        .mockResolvedValueOnce(100n); // incentiveTokensTotal

      const result = await auction.isInRange(1n);
      expect(result).toBe(true); // -50 < 0
    });
  });

  describe('simulateSettleAuction', () => {
    it('returns request and gas estimate from simulation', async () => {
      const request = { address: hookAddress, functionName: 'settleAuction' };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { ...request, gas: 200000n },
      } as any);

      const result = await auction.simulateSettleAuction();

      expect(result.request).toMatchObject(request);
      expect(result.gasEstimate).toBe(200000n);
      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          functionName: 'settleAuction',
          account: walletClient.account,
        }),
      );
    });

    it('falls back to estimateContractGas when request has no gas field', async () => {
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: hookAddress },
      } as any);
      vi.mocked(publicClient.estimateContractGas).mockResolvedValueOnce(
        150000n,
      );

      const result = await auction.simulateSettleAuction();

      expect(result.gasEstimate).toBe(150000n);
      expect(publicClient.estimateContractGas).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          functionName: 'settleAuction',
        }),
      );
    });
  });

  describe('estimateSettleAuctionGas', () => {
    it('returns the gas estimate from simulateSettleAuction', async () => {
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { gas: 250000n },
      } as any);

      const gas = await auction.estimateSettleAuctionGas();
      expect(gas).toBe(250000n);
    });
  });

  describe('simulateClaimIncentives', () => {
    it('returns request and gas estimate for a position', async () => {
      const positionId = 5n;
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { gas: 180000n },
      } as any);

      const result = await auction.simulateClaimIncentives(positionId);

      expect(result.gasEstimate).toBe(180000n);
      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          functionName: 'claimIncentives',
          args: [positionId],
          account: walletClient.account,
        }),
      );
    });

    it('falls back to estimateContractGas when request has no gas field', async () => {
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: hookAddress },
      } as any);
      vi.mocked(publicClient.estimateContractGas).mockResolvedValueOnce(
        120000n,
      );

      const result = await auction.simulateClaimIncentives(10n);

      expect(result.gasEstimate).toBe(120000n);
      expect(publicClient.estimateContractGas).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'claimIncentives',
          args: [10n],
        }),
      );
    });
  });

  describe('estimateClaimIncentivesGas', () => {
    it('returns the gas estimate from simulateClaimIncentives', async () => {
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { gas: 130000n },
      } as any);

      const gas = await auction.estimateClaimIncentivesGas(3n);
      expect(gas).toBe(130000n);
    });
  });

  describe('watchAuctionSettled', () => {
    it('calls watchContractEvent with correct params and returns unsubscribe', () => {
      const unsubFn = vi.fn();
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(unsubFn);

      const onSettled = vi.fn();
      const unsub = auction.watchAuctionSettled({ onSettled });

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: hookAddress,
          eventName: 'AuctionSettled',
        }),
      );
      expect(typeof unsub).toBe('function');
    });

    it('parses log events and calls onSettled callback', () => {
      let capturedOnLogs: any;
      vi.mocked(publicClient.watchContractEvent).mockImplementation((opts: any) => {
        capturedOnLogs = opts.onLogs;
        return () => {};
      });

      const onSettled = vi.fn();
      auction.watchAuctionSettled({ onSettled });

      capturedOnLogs([
        {
          args: {
            clearingTick: -200,
            tokensSold: 10000n,
            proceeds: 5000n,
          },
          transactionHash: `0x${'ff'.repeat(32)}`,
          blockNumber: 999n,
          logIndex: 1,
        },
      ]);

      expect(onSettled).toHaveBeenCalledWith({
        clearingTick: -200,
        tokensSold: 10000n,
        proceeds: 5000n,
        transactionHash: `0x${'ff'.repeat(32)}`,
        blockNumber: 999n,
        logIndex: 1,
      });
    });

    it('handles missing args gracefully with defaults', () => {
      let capturedOnLogs: any;
      vi.mocked(publicClient.watchContractEvent).mockImplementation((opts: any) => {
        capturedOnLogs = opts.onLogs;
        return () => {};
      });

      const onSettled = vi.fn();
      auction.watchAuctionSettled({ onSettled });

      capturedOnLogs([{ args: {}, transactionHash: undefined, blockNumber: undefined, logIndex: undefined }]);

      expect(onSettled).toHaveBeenCalledWith({
        clearingTick: 0,
        tokensSold: 0n,
        proceeds: 0n,
        transactionHash: expect.any(String),
        blockNumber: 0n,
        logIndex: 0,
      });
    });

    it('forwards onError and polling options', () => {
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(() => {});

      const onSettled = vi.fn();
      const onError = vi.fn();
      auction.watchAuctionSettled({
        onSettled,
        onError,
        poll: true,
        pollingInterval: 5000,
        fromBlock: 100n,
        strict: true,
      });

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          onError,
          poll: true,
          pollingInterval: 5000,
          fromBlock: 100n,
          strict: true,
        }),
      );
    });
  });

  describe('claimIncentivesByPositionKey', () => {
    const salt = `0x${'33'.repeat(32)}` as Hash;
    const txHash = `0x${'aa'.repeat(32)}` as Hash;

    it('resolves positionId then claims incentives', async () => {
      const getPositionIdSpy = vi
        .spyOn(auction, 'getPositionId')
        .mockResolvedValueOnce(9n);
      const claimSpy = vi
        .spyOn(auction, 'claimIncentives')
        .mockResolvedValueOnce(txHash);

      const result = await auction.claimIncentivesByPositionKey({
        owner: mockTokenAddress,
        tickLower: 0,
        tickUpper: 60,
        salt,
      });

      expect(result).toBe(txHash);
      expect(getPositionIdSpy).toHaveBeenCalledWith({
        owner: mockTokenAddress,
        tickLower: 0,
        tickUpper: 60,
        salt,
      });
      expect(claimSpy).toHaveBeenCalledWith(9n);

      getPositionIdSpy.mockRestore();
      claimSpy.mockRestore();
    });

    it('throws a friendly error when no position is found', async () => {
      vi.spyOn(auction, 'getPositionId').mockResolvedValueOnce(0n);

      await expect(
        auction.claimIncentivesByPositionKey({
          owner: mockTokenAddress,
          tickLower: 0,
          tickUpper: 60,
          salt,
        }),
      ).rejects.toThrow('Position not found for the given (owner,ticks,salt)');
    });
  });
});
