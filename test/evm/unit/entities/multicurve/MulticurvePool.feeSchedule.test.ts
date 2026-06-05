import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractFunctionZeroDataError } from 'viem';
import { MulticurvePool } from '@/entities/auction/MulticurvePool';
import { DYNAMIC_FEE_FLAG } from '@/constants';
import { LockablePoolStatus } from '@/types';
import { mockAddresses } from '@test/setup/fixtures/addresses';
import {
  createMulticurvePoolHarness,
  mockDynamicPoolKey,
  mockFarTick,
  mockNumeraire,
  mockPoolKey,
  type MockPublicClient,
} from './multicurvePoolTestHelpers';

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

describe('MulticurvePool getFeeSchedule', () => {
  let publicClient: MockPublicClient;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    ({ publicClient, multicurvePool } = await createMulticurvePoolHarness());
  });

  it('returns null for non-dynamic multicurve pools', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([
      mockNumeraire,
      LockablePoolStatus.Initialized,
      mockPoolKey,
      mockFarTick,
    ]);

    const schedule = await multicurvePool.getFeeSchedule();

    expect(schedule).toBeNull();
  });

  it('returns decay fee schedule for dynamic-fee pools', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockDynamicPoolKey,
        mockFarTick,
      ])
      .mockResolvedValueOnce([1700000000, 10000, 1000, 8000, 3600]);

    const schedule = await multicurvePool.getFeeSchedule();

    expect(schedule).toEqual({
      startingTime: 1700000000,
      startFee: 10000,
      endFee: 1000,
      lastFee: 8000,
      durationSeconds: 3600,
    });
  });

  it('throws when dynamic hook does not expose getFeeScheduleOf', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        {
          ...mockPoolKey,
          fee: DYNAMIC_FEE_FLAG,
        },
        mockFarTick,
      ])
      .mockRejectedValueOnce(
        new ContractFunctionZeroDataError({
          functionName: 'getFeeScheduleOf',
        }),
      );

    await expect(multicurvePool.getFeeSchedule()).rejects.toThrow(
      'does not expose getFeeScheduleOf(poolId)',
    );
  });

  it('preserves provider failures while reading a dynamic fee schedule', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        {
          ...mockPoolKey,
          fee: DYNAMIC_FEE_FLAG,
        },
        mockFarTick,
      ])
      .mockRejectedValueOnce(new Error('HTTP request failed'));

    await expect(multicurvePool.getFeeSchedule()).rejects.toThrow(
      'HTTP request failed',
    );
  });
});
