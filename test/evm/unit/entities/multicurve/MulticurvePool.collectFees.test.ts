import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computePoolId } from '@/utils/poolKey';
import { LockablePoolStatus } from '@/types';
import { MulticurvePool } from '@/entities/auction/MulticurvePool';
import { mockAddresses } from '@test/setup/fixtures/addresses';
import {
  createMulticurvePoolHarness,
  defaultAddresses,
  mockFarTick,
  mockNumeraire,
  mockPoolKey,
  mockTokenAddress,
  type MockPublicClient,
} from './multicurvePoolTestHelpers';

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

describe('MulticurvePool collectFees', () => {
  let publicClient: MockPublicClient;
  let walletClient: ReturnType<
    typeof import('@test/setup/fixtures/clients').createMockWalletClient
  >;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    ({ publicClient, walletClient, multicurvePool } =
      await createMulticurvePoolHarness());
  });

  it('collects fees and returns amounts with transaction hash', async () => {
    const mockFees0 = 1000n;
    const mockFees1 = 2000n;
    const mockTxHash = '0xabcdef1234567890';
    const expectedPoolId = computePoolId(mockPoolKey);

    vi.mocked(publicClient.readContract).mockResolvedValueOnce([
      mockNumeraire,
      LockablePoolStatus.Locked,
      mockPoolKey,
      mockFarTick,
    ]);
    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockAddresses.v4MulticurveInitializer,
        functionName: 'collectFees',
        args: [expectedPoolId],
      },
      result: [mockFees0, mockFees1],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      mockTxHash as `0x${string}`,
    );
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce({});

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

  it('throws error if wallet client is not provided', async () => {
    const multicurvePoolWithoutWallet = new MulticurvePool(
      publicClient,
      undefined,
      mockTokenAddress,
    );

    await expect(multicurvePoolWithoutWallet.collectFees()).rejects.toThrow(
      'Wallet client required to collect fees',
    );
  });

  it('throws error if no initializer addresses are configured', async () => {
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue({
      ...defaultAddresses,
      v4MulticurveInitializer: undefined,
      v4ScheduledMulticurveInitializer: undefined,
      v4DecayMulticurveInitializer: undefined,
    });

    await expect(multicurvePool.collectFees()).rejects.toThrow(
      'No V4 multicurve initializer addresses configured for this chain',
    );
  });

  it('throws error if pool has exited or migrated', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([
      mockNumeraire,
      LockablePoolStatus.Exited,
      mockPoolKey,
      mockFarTick,
    ]);

    await expect(multicurvePool.collectFees()).rejects.toThrow(
      'Multicurve pool is not locked or was migrated',
    );
  });

  it('throws error if pool is not locked', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([
      mockNumeraire,
      LockablePoolStatus.Initialized,
      mockPoolKey,
      mockFarTick,
    ]);

    await expect(multicurvePool.collectFees()).rejects.toThrow(
      'Multicurve pool is not locked or was migrated',
    );
  });
});
