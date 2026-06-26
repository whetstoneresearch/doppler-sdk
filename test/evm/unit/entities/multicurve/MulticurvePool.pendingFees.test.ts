import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import { LockablePoolStatus } from '@/types';
import { computePoolId } from '@/utils/poolKey';
import { mockAddresses } from '@test/setup/fixtures/addresses';
import {
  buildPendingFeeAggregateResults,
  createMulticurvePoolHarness,
  createState,
  decodePendingFeeAggregateCalls,
  decodePendingFeeInnerCall,
  encodePendingFeeAggregateResults,
  expectedPendingFeeCallOrder,
  mockBeneficiary,
  mockPoolKey,
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

describe('MulticurvePool getPendingFees', () => {
  let publicClient: MockPublicClient;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    ({ publicClient, multicurvePool } = await createMulticurvePoolHarness());
  });

  it('returns pending fees after simulated collectFees updates cumulative fee reads', async () => {
    const expectedPoolId = computePoolId(mockPoolKey);
    mockLockedState();
    mockPendingFeeAggregate({
      simulatedFees0: 300n,
      simulatedFees1: 600n,
      shares: 500000000000000000n,
      cumulatedFees0: 1300n,
      cumulatedFees1: 2600n,
      lastCumulatedFees0: 100n,
      lastCumulatedFees1: 400n,
    });

    const result = await multicurvePool.getPendingFees(mockBeneficiary);

    expect(result).toEqual({
      fees0: 600n,
      fees1: 1100n,
    });
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
    expect(publicClient.call).toHaveBeenCalledTimes(1);

    const aggregateCalls = decodeAggregateCalls();
    expect(aggregateCalls.map((call) => call.target)).toEqual(
      Array(expectedPendingFeeCallOrder.length).fill(
        mockAddresses.dopplerHookInitializer,
      ),
    );
    expect(aggregateCalls.map((call) => call.allowFailure)).toEqual(
      Array(expectedPendingFeeCallOrder.length).fill(true),
    );
    expect(
      aggregateCalls.map(
        (call) => decodePendingFeeInnerCall(call.callData).functionName,
      ),
    ).toEqual(expectedPendingFeeCallOrder);
    expect(
      aggregateCalls.map(
        (call) => decodePendingFeeInnerCall(call.callData).args,
      ),
    ).toEqual([
      [expectedPoolId],
      [expectedPoolId, getAddress(mockBeneficiary)],
      [expectedPoolId],
      [expectedPoolId],
      [expectedPoolId, getAddress(mockBeneficiary)],
      [expectedPoolId, getAddress(mockBeneficiary)],
    ]);
  });

  it('returns zero pending fees when the beneficiary has zero shares', async () => {
    mockLockedState();
    mockPendingFeeAggregate({
      simulatedFees0: 300n,
      simulatedFees1: 600n,
      cumulatedFees0: 1300n,
      cumulatedFees1: 2600n,
      lastCumulatedFees0: 100n,
      lastCumulatedFees1: 400n,
      shares: 0n,
    });

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).resolves.toEqual({
      fees0: 0n,
      fees1: 0n,
    });
  });

  it('returns zero pending fees when no new fees have accrued', async () => {
    mockLockedState();
    mockPendingFeeAggregate({
      simulatedFees0: 0n,
      simulatedFees1: 0n,
      cumulatedFees0: 1000n,
      cumulatedFees1: 2000n,
      lastCumulatedFees0: 1000n,
      lastCumulatedFees1: 2000n,
      shares: 500000000000000000n,
    });

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).resolves.toEqual({
      fees0: 0n,
      fees1: 0n,
    });
  });

  it('preserves token0-only pending fees independently', async () => {
    mockLockedState();
    mockPendingFeeAggregate({
      simulatedFees0: 300n,
      simulatedFees1: 0n,
      cumulatedFees0: 1300n,
      cumulatedFees1: 2000n,
      lastCumulatedFees0: 100n,
      lastCumulatedFees1: 2000n,
      shares: 500000000000000000n,
    });

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).resolves.toEqual({
      fees0: 600n,
      fees1: 0n,
    });
  });

  it('preserves token1-only pending fees independently', async () => {
    mockLockedState();
    mockPendingFeeAggregate({
      simulatedFees0: 0n,
      simulatedFees1: 600n,
      cumulatedFees0: 1000n,
      cumulatedFees1: 2600n,
      lastCumulatedFees0: 1000n,
      lastCumulatedFees1: 400n,
      shares: 500000000000000000n,
    });

    await expect(
      multicurvePool.getPendingFees(mockBeneficiary),
    ).resolves.toEqual({
      fees0: 0n,
      fees1: 1100n,
    });
  });

  function mockLockedState() {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(
      createState(LockablePoolStatus.Locked),
    );
  }

  function mockPendingFeeAggregate(values: PendingFeeValues) {
    vi.mocked(publicClient.call).mockResolvedValueOnce({
      data: encodePendingFeeAggregateResults(
        buildPendingFeeAggregateResults(values),
      ),
    });
  }

  function decodeAggregateCalls() {
    const request = vi.mocked(publicClient.call).mock.calls[0]?.[0];
    if (!request) {
      throw new Error('Expected aggregate3 call');
    }

    return decodePendingFeeAggregateCalls(request.data);
  }
});
