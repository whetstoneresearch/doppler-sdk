import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MulticurvePool } from '../../../src/entities/auction/MulticurvePool';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';
import type { Address } from 'viem';
import { LockablePoolStatus } from '../../../src/types';
import { computePoolId } from '../../../src/utils/poolKey';

vi.mock('../../../src/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

describe('MulticurvePool', () => {
  const mockTokenAddress =
    '0x1234567890123456789012345678901234567890' as Address;
  const mockNumeraire = '0x4200000000000000000000000000000000000006' as Address;
  const mockHook = '0xcccccccccccccccccccccccccccccccccccccccc' as Address;
  const mockMigratorHook =
    '0xdddddddddddddddddddddddddddddddddddddddd' as Address;
  const mockPoolKey = {
    currency0: mockTokenAddress,
    currency1: mockNumeraire,
    fee: 3000,
    tickSpacing: 60,
    hooks: mockHook,
  };
  const mockFarTick = 120;

  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    multicurvePool = new MulticurvePool(
      publicClient,
      walletClient,
      mockTokenAddress,
    );
    vi.clearAllMocks();
    // Reset getAddresses mock to default behavior
    const { getAddresses } = await import('../../../src/addresses');
    vi.mocked(getAddresses).mockReturnValue(mockAddresses);
  });

  describe('getTokenAddress', () => {
    it('should return the token address', () => {
      expect(multicurvePool.getTokenAddress()).toBe(mockTokenAddress);
    });
  });

  describe('getState', () => {
    it('should fetch and return pool state', async () => {
      const mockState = {
        asset: mockTokenAddress,
        numeraire: mockNumeraire,
        fee: 3000,
        tickSpacing: 60,
        status: LockablePoolStatus.Initialized,
        poolKey: mockPoolKey,
        farTick: mockFarTick,
      };

      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any);

      const state = await multicurvePool.getState();

      expect(state).toEqual(mockState);
      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.v4MulticurveInitializer,
          functionName: 'getState',
          args: [mockTokenAddress],
        }),
      );
    });

    it('should throw error if no initializer addresses are configured', async () => {
      const { getAddresses } = await import('../../../src/addresses');
      vi.mocked(getAddresses).mockReturnValue({
        ...mockAddresses,
        v4MulticurveInitializer: undefined,
        v4ScheduledMulticurveInitializer: undefined,
      } as any);

      await expect(multicurvePool.getState()).rejects.toThrow(
        'No V4 multicurve initializer addresses configured for this chain',
      );
    });

    it('should fallback to scheduled initializer when pool not found in standard initializer', async () => {
      const mockScheduledInitializer =
        '0x8888888888888888888888888888888888888888' as Address;
      const { getAddresses } = await import('../../../src/addresses');
      vi.mocked(getAddresses).mockReturnValue({
        ...mockAddresses,
        v4ScheduledMulticurveInitializer: mockScheduledInitializer,
      } as any);

      // First call returns zeroed data (pool not found in standard initializer)
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          '0x0000000000000000000000000000000000000000',
          0,
          {
            currency0: '0x0000000000000000000000000000000000000000',
            currency1: '0x0000000000000000000000000000000000000000',
            fee: 0,
            tickSpacing: 0,
            hooks: '0x0000000000000000000000000000000000000000',
          },
          0,
        ] as any)
        // Second call returns valid data (pool found in scheduled initializer)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Initialized,
          mockPoolKey,
          mockFarTick,
        ] as any);

      const state = await multicurvePool.getState();

      expect(state.poolKey).toEqual(mockPoolKey);
      expect(publicClient.readContract).toHaveBeenCalledTimes(2);
      expect(publicClient.readContract).toHaveBeenLastCalledWith(
        expect.objectContaining({
          address: mockScheduledInitializer,
        }),
      );
    });

    it('should throw error with tried initializers when pool not found in any', async () => {
      const mockScheduledInitializer =
        '0x8888888888888888888888888888888888888888' as Address;
      const { getAddresses } = await import('../../../src/addresses');
      vi.mocked(getAddresses).mockReturnValue({
        ...mockAddresses,
        v4ScheduledMulticurveInitializer: mockScheduledInitializer,
      } as any);

      // Both calls return zeroed data (pool not found)
      vi.mocked(publicClient.readContract).mockResolvedValue([
        '0x0000000000000000000000000000000000000000',
        0,
        {
          currency0: '0x0000000000000000000000000000000000000000',
          currency1: '0x0000000000000000000000000000000000000000',
          fee: 0,
          tickSpacing: 0,
          hooks: '0x0000000000000000000000000000000000000000',
        },
        0,
      ] as any);

      await expect(multicurvePool.getState()).rejects.toThrow(
        `Pool not found for token ${mockTokenAddress}. Tried initializers:`,
      );
    });
  });

  describe('collectFees', () => {
    it('should collect fees and return amounts with transaction hash', async () => {
      const mockFees0 = 1000n;
      const mockFees1 = 2000n;
      const mockTxHash = '0xabcdef1234567890';
      const expectedPoolId = computePoolId(mockPoolKey);

      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Locked,
        mockPoolKey,
        mockFarTick,
      ] as any);

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.v4MulticurveInitializer,
          functionName: 'collectFees',
          args: [expectedPoolId],
        },
        result: [mockFees0, mockFees1],
      } as any);

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        {} as any,
      );

      const result = await multicurvePool.collectFees();

      expect(result).toEqual({
        fees0: mockFees0,
        fees1: mockFees1,
        transactionHash: mockTxHash,
      });

      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.v4MulticurveInitializer,
          functionName: 'collectFees',
          args: [expectedPoolId],
        }),
      );

      expect(walletClient.writeContract).toHaveBeenCalled();
      expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: mockTxHash,
          confirmations: 1,
        }),
      );
    });

    it('should collect fees from locker when pool has migrated', async () => {
      const mockFees0 = 500n;
      const mockFees1 = 750n;
      const mockTxHash = '0xfeedfacecafebeef';
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      };
      const expectedPoolId = computePoolId(migratedPoolKey);

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([
          true,
          migratedPoolKey,
          3600,
          [],
          [
            {
              beneficiary: mockTokenAddress,
              shares: 10n,
            },
          ],
        ] as any)
        .mockResolvedValueOnce([
          migratedPoolKey,
          mockTokenAddress,
          123,
          3600,
          false,
          [],
          [],
        ] as any);

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.streamableFeesLocker,
          functionName: 'collectFees',
          args: [expectedPoolId],
        },
        result: [mockFees0, mockFees1],
      } as any);

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        {} as any,
      );

      const result = await multicurvePool.collectFees();

      expect(result).toEqual({
        fees0: mockFees0,
        fees1: mockFees1,
        transactionHash: mockTxHash,
      });

      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.streamableFeesLocker,
          functionName: 'collectFees',
          args: [expectedPoolId],
        }),
      );
    });

    it('should throw error if wallet client is not provided', async () => {
      const multicurvePoolWithoutWallet = new MulticurvePool(
        publicClient,
        undefined,
        mockTokenAddress,
      );

      await expect(multicurvePoolWithoutWallet.collectFees()).rejects.toThrow(
        'Wallet client required to collect fees',
      );
    });

    it('should throw error if no initializer addresses are configured', async () => {
      const { getAddresses } = await import('../../../src/addresses');
      vi.mocked(getAddresses).mockReturnValue({
        ...mockAddresses,
        v4MulticurveInitializer: undefined,
        v4ScheduledMulticurveInitializer: undefined,
      } as any);

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'No V4 multicurve initializer addresses configured for this chain',
      );
    });

    it('should throw error if v4 multicurve migrator is missing for migrated pool', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Exited,
        mockPoolKey,
        mockFarTick,
      ] as any);

      const { getAddresses } = await import('../../../src/addresses');
      vi.mocked(getAddresses).mockReturnValueOnce({
        ...mockAddresses,
        v4Migrator: undefined,
      } as any);

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'V4 multicurve migrator address not configured for this chain',
      );
    });

    it('should throw error if migrated multicurve pool has no beneficiaries configured', async () => {
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      };

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([true, migratedPoolKey, 3600, [], []] as any);

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'Migrated multicurve pool has no beneficiaries configured',
      );
    });

    it('should throw error if migrated multicurve stream has not been initialized yet', async () => {
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      };

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([
          true,
          migratedPoolKey,
          3600,
          [],
          [
            {
              beneficiary: mockTokenAddress,
              shares: 10n,
            },
          ],
        ] as any)
        .mockResolvedValueOnce([
          migratedPoolKey,
          mockTokenAddress,
          0,
          3600,
          false,
          [],
          [],
        ] as any);

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'Migrated multicurve stream not initialized',
      );
    });

    it('should resolve locker from migrator when not provided in addresses', async () => {
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      };
      const expectedPoolId = computePoolId(migratedPoolKey);
      const mockLockerAddress =
        '0x9999999999999999999999999999999999999999' as Address;
      const mockFees0 = 100n;
      const mockFees1 = 200n;
      const mockTxHash = '0xdecafbaddecafbad';

      const { getAddresses } = await import('../../../src/addresses');
      vi.mocked(getAddresses).mockReturnValueOnce({
        ...mockAddresses,
        streamableFeesLocker: undefined,
      } as any);

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([
          true,
          migratedPoolKey,
          3600,
          [],
          [
            {
              beneficiary: mockTokenAddress,
              shares: 10n,
            },
          ],
        ] as any)
        .mockResolvedValueOnce(mockLockerAddress as any)
        .mockResolvedValueOnce([
          migratedPoolKey,
          mockTokenAddress,
          123,
          3600,
          false,
          [],
          [],
        ] as any);

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockLockerAddress,
          functionName: 'collectFees',
          args: [expectedPoolId],
        },
        result: [mockFees0, mockFees1],
      } as any);

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        {} as any,
      );

      const result = await multicurvePool.collectFees();

      expect(result).toEqual({
        fees0: mockFees0,
        fees1: mockFees1,
        transactionHash: mockTxHash,
      });

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.v4Migrator,
          functionName: 'locker',
        }),
      );
    });

    it('should throw error if pool is not locked or migrated', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any);

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'Multicurve pool is not locked or migrated',
      );
    });
  });

  describe('getTokenAddress', () => {
    it('should return the asset address from state', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any);

      const tokenAddress = await multicurvePool.getTokenAddress();

      expect(tokenAddress).toBe(mockTokenAddress);
    });
  });

  describe('getNumeraireAddress', () => {
    it('should return the numeraire address from state', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any);

      const numeraireAddress = await multicurvePool.getNumeraireAddress();

      expect(numeraireAddress).toBe(mockNumeraire);
    });
  });
});
