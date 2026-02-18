import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpeningAuctionLifecycle } from '../../../src/entities/auction/OpeningAuctionLifecycle';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockAddresses, mockHookAddress, mockTokenAddress } from '../../setup/fixtures/addresses';
import type { Address } from 'viem';

describe('OpeningAuctionLifecycle', () => {
  const mockInitializerAddress =
    '0x1111111111111111111111111111111111111111' as Address;
  const mockDopplerHook = '0x2222222222222222222222222222222222222222' as Address;
  const mockAsset = mockTokenAddress;
  const mockDopplerSalt = `0x${'11'.repeat(32)}` as `0x${string}`;
  const mockTxHash = `0x${'aa'.repeat(32)}` as `0x${string}`;
  const mockPositionManagerAddress =
    '0x7777777777777777777777777777777777777777' as Address;

  let lifecycle: OpeningAuctionLifecycle;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    lifecycle = new OpeningAuctionLifecycle(
      publicClient,
      walletClient,
      mockInitializerAddress,
    );
  });

  describe('getAddress', () => {
    it('returns the initializer address', () => {
      expect(lifecycle.getAddress()).toBe(mockInitializerAddress);
    });
  });

  describe('getState', () => {
    it('normalizes tuple state and tuple pool key', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockAddresses.weth,
        1_700_000_000n,
        1_700_086_400n,
        500_000n,
        300_000n,
        2,
        mockHookAddress,
        mockDopplerHook,
        [mockTokenAddress, mockAddresses.weth, 3000n, 60n, mockHookAddress],
        '0x1234',
        true,
      ] as any);

      const state = await lifecycle.getState(mockAsset);

      expect(state).toEqual({
        numeraire: mockAddresses.weth,
        auctionStartTime: 1_700_000_000n,
        auctionEndTime: 1_700_086_400n,
        auctionTokens: 500_000n,
        dopplerTokens: 300_000n,
        status: 2,
        openingAuctionHook: mockHookAddress,
        dopplerHook: mockDopplerHook,
        openingAuctionPoolKey: {
          currency0: mockTokenAddress,
          currency1: mockAddresses.weth,
          fee: 3000,
          tickSpacing: 60,
          hooks: mockHookAddress,
        },
        dopplerInitData: '0x1234',
        isToken0: true,
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'getState',
        args: [mockAsset],
      });
    });

    it('normalizes object state and object pool key numeric/boolean fields', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce({
        numeraire: mockAddresses.weth,
        auctionStartTime: 1_700_000_000n,
        auctionEndTime: 1_700_086_400n,
        auctionTokens: 500_000n,
        dopplerTokens: 300_000n,
        status: 3n,
        openingAuctionHook: mockHookAddress,
        dopplerHook: mockDopplerHook,
        openingAuctionPoolKey: {
          currency0: mockTokenAddress,
          currency1: mockAddresses.weth,
          fee: 500n,
          tickSpacing: 10n,
          hooks: mockHookAddress,
        },
        dopplerInitData: '0xabcd',
        isToken0: 1,
      } as any);

      const state = await lifecycle.getState(mockAsset);

      expect(state.status).toBe(3);
      expect(state.isToken0).toBe(true);
      expect(state.openingAuctionPoolKey.fee).toBe(500);
      expect(state.openingAuctionPoolKey.tickSpacing).toBe(10);
    });
  });

  describe('hook getters', () => {
    it('getOpeningAuctionHook reads initializer hook mapping', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockHookAddress);

      const result = await lifecycle.getOpeningAuctionHook(mockAsset);

      expect(result).toBe(mockHookAddress);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'getOpeningAuctionHook',
        args: [mockAsset],
      });
    });

    it('getDopplerHook reads initializer hook mapping', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockDopplerHook);

      const result = await lifecycle.getDopplerHook(mockAsset);

      expect(result).toBe(mockDopplerHook);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'getDopplerHook',
        args: [mockAsset],
      });
    });
  });

  describe('position manager', () => {
    it('reads the initializer position manager address', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(
        mockPositionManagerAddress,
      );

      const result = await lifecycle.getPositionManager();

      expect(result).toBe(mockPositionManagerAddress);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'positionManager',
        args: [],
      });
    });
  });

  describe('complete auction', () => {
    it('simulateCompleteAuction uses wallet account by default', async () => {
      const request = {
        address: mockInitializerAddress,
        functionName: 'completeAuction',
        args: [mockAsset, mockDopplerSalt],
      };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);

      const simulation = await lifecycle.simulateCompleteAuction(
        mockAsset,
        mockDopplerSalt,
      );

      expect(simulation).toEqual({ request });
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'completeAuction',
        args: [mockAsset, mockDopplerSalt],
        account: walletClient.account,
      });
    });

    it('simulateCompleteAuction accepts explicit account override', async () => {
      const explicitAccount =
        '0x3333333333333333333333333333333333333333' as Address;
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { functionName: 'completeAuction' },
      } as any);

      await lifecycle.simulateCompleteAuction(
        mockAsset,
        mockDopplerSalt,
        explicitAccount,
      );

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'completeAuction',
        args: [mockAsset, mockDopplerSalt],
        account: explicitAccount,
      });
    });

    it('completeAuction simulates then writes transaction', async () => {
      const request = {
        address: mockInitializerAddress,
        functionName: 'completeAuction',
        args: [mockAsset, mockDopplerSalt],
      };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash);

      const txHash = await lifecycle.completeAuction(mockAsset, mockDopplerSalt);

      expect(txHash).toBe(mockTxHash);
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'completeAuction',
        args: [mockAsset, mockDopplerSalt],
        account: walletClient.account,
      });
      expect(walletClient.writeContract).toHaveBeenCalledWith(request);
    });

    it('completeAuction throws when wallet client is missing', async () => {
      const readOnlyLifecycle = new OpeningAuctionLifecycle(
        publicClient,
        undefined,
        mockInitializerAddress,
      );

      await expect(
        readOnlyLifecycle.completeAuction(mockAsset, mockDopplerSalt),
      ).rejects.toThrow('Wallet client required for write operations');
    });
  });

  describe('recover opening auction incentives', () => {
    it('simulateRecoverOpeningAuctionIncentives defaults account to wallet', async () => {
      const request = { functionName: 'recoverOpeningAuctionIncentives' };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);

      const simulation =
        await lifecycle.simulateRecoverOpeningAuctionIncentives(mockAsset);

      expect(simulation).toEqual({ request });
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'recoverOpeningAuctionIncentives',
        args: [mockAsset],
        account: walletClient.account,
      });
    });

    it('simulateRecoverOpeningAuctionIncentives accepts explicit account', async () => {
      const explicitAccount =
        '0x4444444444444444444444444444444444444444' as Address;
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { functionName: 'recoverOpeningAuctionIncentives' },
      } as any);

      await lifecycle.simulateRecoverOpeningAuctionIncentives(
        mockAsset,
        explicitAccount,
      );

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'recoverOpeningAuctionIncentives',
        args: [mockAsset],
        account: explicitAccount,
      });
    });

    it('recoverOpeningAuctionIncentives writes the simulated request', async () => {
      const request = { functionName: 'recoverOpeningAuctionIncentives' };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash);

      const txHash = await lifecycle.recoverOpeningAuctionIncentives(mockAsset);

      expect(txHash).toBe(mockTxHash);
      expect(walletClient.writeContract).toHaveBeenCalledWith(request);
    });

    it('recoverOpeningAuctionIncentives throws when wallet client is missing', async () => {
      const readOnlyLifecycle = new OpeningAuctionLifecycle(
        publicClient,
        undefined,
        mockInitializerAddress,
      );

      await expect(
        readOnlyLifecycle.recoverOpeningAuctionIncentives(mockAsset),
      ).rejects.toThrow('Wallet client required for write operations');
    });
  });

  describe('sweep opening auction incentives', () => {
    it('simulateSweepOpeningAuctionIncentives defaults account to wallet', async () => {
      const request = { functionName: 'sweepOpeningAuctionIncentives' };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);

      const simulation = await lifecycle.simulateSweepOpeningAuctionIncentives(
        mockAsset,
      );

      expect(simulation).toEqual({ request });
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'sweepOpeningAuctionIncentives',
        args: [mockAsset],
        account: walletClient.account,
      });
    });

    it('simulateSweepOpeningAuctionIncentives accepts explicit account', async () => {
      const explicitAccount =
        '0x5555555555555555555555555555555555555555' as Address;
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { functionName: 'sweepOpeningAuctionIncentives' },
      } as any);

      await lifecycle.simulateSweepOpeningAuctionIncentives(
        mockAsset,
        explicitAccount,
      );

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockInitializerAddress,
        abi: expect.any(Array),
        functionName: 'sweepOpeningAuctionIncentives',
        args: [mockAsset],
        account: explicitAccount,
      });
    });

    it('sweepOpeningAuctionIncentives writes the simulated request', async () => {
      const request = { functionName: 'sweepOpeningAuctionIncentives' };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash);

      const txHash = await lifecycle.sweepOpeningAuctionIncentives(mockAsset);

      expect(txHash).toBe(mockTxHash);
      expect(walletClient.writeContract).toHaveBeenCalledWith(request);
    });

    it('sweepOpeningAuctionIncentives throws when wallet client is missing', async () => {
      const readOnlyLifecycle = new OpeningAuctionLifecycle(
        publicClient,
        undefined,
        mockInitializerAddress,
      );

      await expect(
        readOnlyLifecycle.sweepOpeningAuctionIncentives(mockAsset),
      ).rejects.toThrow('Wallet client required for write operations');
    });
  });
});
