import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Hex } from 'viem';
import { LockablePoolStatus } from '@/types';
import { mockAddresses } from '@test/setup/fixtures/addresses';
import {
  buildPendingFeeAggregateResults,
  createMulticurvePoolHarness,
  createState,
  encodePendingFeeAggregateResults,
  mockBeneficiary,
  type AggregateResult,
  type MockPublicClient,
  type PendingFeeValues,
} from './multicurvePoolTestHelpers';
import type { MulticurvePool } from '@/entities/auction/MulticurvePool';

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

describe('MulticurvePool getPendingFees errors', () => {
  let publicClient: MockPublicClient;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    ({ publicClient, multicurvePool } = await createMulticurvePoolHarness());
  });

  it('throws when getCumulatedFees0 call fails', async () => {
    mockLockedState();
    mockAggregateResults(
      defaultAggregateResults().map((result, index) =>
        index === 2 ? { success: false, returnData: '0x' as Hex } : result,
      ),
    );

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).rejects.toThrow('getCumulatedFees0 call failed');
  });

  it('throws when an inner call returns empty data', async () => {
    mockLockedState();
    mockAggregateResults(
      defaultAggregateResults().map((result, index) =>
        index === 1 ? { success: true, returnData: '0x' as Hex } : result,
      ),
    );

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).rejects.toThrow('getShares returned no data');
  });

  it('throws when aggregate3 returns an incomplete result', async () => {
    mockLockedState();
    mockAggregateResults(defaultAggregateResults().slice(0, -1));

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).rejects.toThrow(
      'Multicall3 aggregate3 returned an incomplete pool result',
    );
  });

  it('throws when aggregate3 returns no data', async () => {
    mockLockedState();
    vi.mocked(publicClient.call).mockResolvedValueOnce({});

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).rejects.toThrow('Multicall3 aggregate3 returned no data');
  });

  it('throws when accumulated fees are below a beneficiary checkpoint', async () => {
    mockLockedState();
    mockPendingFeeAggregate({
      simulatedFees0: 300n,
      simulatedFees1: 600n,
      shares: 500000000000000000n,
      cumulatedFees0: 99n,
      cumulatedFees1: 2600n,
      lastCumulatedFees0: 100n,
      lastCumulatedFees1: 400n,
    });

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).rejects.toThrow('Accumulated fees are below beneficiary checkpoint');
  });

  it('throws when the pool is initialized but not locked', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(
      createState(LockablePoolStatus.Initialized),
    );

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).rejects.toThrow('Multicurve pool is not locked or was migrated');
    expect(publicClient.call).not.toHaveBeenCalled();
  });

  function mockLockedState() {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(
      createState(LockablePoolStatus.Locked),
    );
  }

  function mockPendingFeeAggregate(values: PendingFeeValues) {
    mockAggregateResults(buildPendingFeeAggregateResults(values));
  }

  function mockAggregateResults(results: readonly AggregateResult[]) {
    vi.mocked(publicClient.call).mockResolvedValueOnce({
      data: encodePendingFeeAggregateResults(results),
    });
  }

  function defaultAggregateResults() {
    return buildPendingFeeAggregateResults({
      simulatedFees0: 300n,
      simulatedFees1: 600n,
      shares: 500000000000000000n,
      cumulatedFees0: 1300n,
      cumulatedFees1: 2600n,
      lastCumulatedFees0: 100n,
      lastCumulatedFees1: 400n,
    });
  }
});
