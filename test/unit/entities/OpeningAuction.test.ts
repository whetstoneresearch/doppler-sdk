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
        -100,
        0,
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
    it('delegates to the hook', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(true);

      const result = await auction.isInRange(2n);

      expect(result).toBe(true);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: hookAddress,
        abi: expect.any(Array),
        functionName: 'isInRange',
        args: [2n],
      });
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
    it('getPositionId forwards key data to the hook helper', async () => {
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
        functionName: 'getPositionId',
        args: [mockTokenAddress, -120, -60, salt],
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

