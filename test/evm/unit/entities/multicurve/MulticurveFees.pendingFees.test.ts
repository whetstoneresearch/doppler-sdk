import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  type Address,
} from 'viem';
import { dopplerHookInitializerAbi } from '@/abis';
import { MulticurveFees } from '@/entities/auction/MulticurveFees';
import { LockablePoolStatus, type V4PoolKey } from '@/types';
import { computePoolId } from '@/utils/poolKey';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '@test/setup/fixtures/clients';
import {
  buildPendingFeeAggregateResults,
  decodePendingFeeAggregateCalls,
  decodePendingFeeInnerCall,
  defaultAddresses,
  encodePendingFeeAggregateResults,
  expectedPendingFeeCallOrder,
  mockBeneficiary,
  mockDopplerHookInitializer,
  mockFarTick,
  mockHook,
  mockNumeraire,
  type AggregateResult,
  type MockPublicClient,
  type PendingFeeValues,
} from './multicurvePoolTestHelpers';

const batchAddresses = {
  ...defaultAddresses,
  dopplerHookInitializer: mockDopplerHookInitializer,
};

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => batchAddresses),
  };
});

const tokenA = getAddress(
  '0x0aaa0000000000000000000000000000000000aa',
) as Address;
const tokenB = getAddress(
  '0x0bbb0000000000000000000000000000000000bb',
) as Address;
const tokenC = getAddress(
  '0x0ccc0000000000000000000000000000000000cc',
) as Address;

type GetStateResult = readonly [
  Address,
  bigint,
  Address,
  `0x${string}`,
  number,
  V4PoolKey,
  number,
];

describe('MulticurveFees getPendingFees', () => {
  let publicClient: MockPublicClient;

  beforeEach(() => {
    publicClient = createMockPublicClient() as MockPublicClient;
    vi.clearAllMocks();
  });

  it('returns pending fees for multiple tokens with one fee-preview multicall', async () => {
    const poolKeyA = createPoolKey(tokenA);
    const poolKeyB = createPoolKey(tokenB);
    mockPendingFeeBatch(
      [createLockedState(poolKeyA), createLockedState(poolKeyB)],
      [
        {
          simulatedFees0: 300n,
          simulatedFees1: 600n,
          shares: 500000000000000000n,
          cumulatedFees0: 1300n,
          cumulatedFees1: 2600n,
          lastCumulatedFees0: 100n,
          lastCumulatedFees1: 400n,
        },
        {
          simulatedFees0: 100n,
          simulatedFees1: 200n,
          shares: 1000000000000000000n,
          cumulatedFees0: 1500n,
          cumulatedFees1: 2900n,
          lastCumulatedFees0: 1000n,
          lastCumulatedFees1: 2000n,
        },
      ],
    );

    const fees = new MulticurveFees(
      publicClient,
      createMockWalletClient(),
      [tokenA, tokenB],
    );
    const result = await fees.getPendingFees(mockBeneficiary);

    expect(result).toEqual([
      { tokenAddress: tokenA, fees0: 600n, fees1: 1100n },
      { tokenAddress: tokenB, fees0: 500n, fees1: 900n },
    ]);
    expect(publicClient.call).toHaveBeenCalledTimes(2);

    const discoveryCalls = decodeAggregateCalls(0);
    expect(discoveryCalls).toHaveLength(2);
    expect(
      discoveryCalls.map(
        (call) =>
          decodeFunctionData({
            abi: dopplerHookInitializerAbi,
            data: call.callData,
          }).args[0],
      ),
    ).toEqual([tokenA, tokenB]);

    const feeCalls = decodeAggregateCalls(1);
    expect(feeCalls).toHaveLength(expectedPendingFeeCallOrder.length * 2);
    expect(feeCalls.map((call) => call.target)).toEqual(
      Array(expectedPendingFeeCallOrder.length * 2).fill(
        mockDopplerHookInitializer,
      ),
    );
    expect(
      feeCalls.map((call) => decodePendingFeeInnerCall(call.callData)),
    ).toEqual([
      ...expectedFeeInnerCalls(poolKeyA),
      ...expectedFeeInnerCalls(poolKeyB),
    ]);
  });

  it('uses constructor tokens when no override tokens are provided', async () => {
    const poolKeyA = createPoolKey(tokenA);
    mockPendingFeeBatch([createLockedState(poolKeyA)], [defaultPendingFees()]);
    const fees = new MulticurveFees(
      publicClient,
      createMockWalletClient(),
      [tokenA],
    );

    await expect(fees.getPendingFees(mockBeneficiary)).resolves.toEqual([
      { tokenAddress: tokenA, fees0: 600n, fees1: 1100n },
    ]);
  });

  it('uses override tokens instead of constructor tokens when provided', async () => {
    const poolKeyB = createPoolKey(tokenB);
    const poolKeyC = createPoolKey(tokenC);
    mockPendingFeeBatch(
      [createLockedState(poolKeyB), createLockedState(poolKeyC)],
      [defaultPendingFees(), defaultPendingFees()],
    );
    const fees = new MulticurveFees(
      publicClient,
      createMockWalletClient(),
      [tokenA],
    );

    await expect(
      fees.getPendingFees(mockBeneficiary, [tokenB, tokenC]),
    ).resolves.toEqual([
      { tokenAddress: tokenB, fees0: 600n, fees1: 1100n },
      { tokenAddress: tokenC, fees0: 600n, fees1: 1100n },
    ]);

    const discoveryCalls = decodeAggregateCalls(0);
    expect(
      discoveryCalls.map(
        (call) =>
          decodeFunctionData({
            abi: dopplerHookInitializerAbi,
            data: call.callData,
          }).args[0],
      ),
    ).toEqual([tokenB, tokenC]);
  });

  function mockPendingFeeBatch(
    states: readonly GetStateResult[],
    pendingFeeValues: readonly PendingFeeValues[],
  ) {
    vi.mocked(publicClient.call)
      .mockResolvedValueOnce({
        data: encodePendingFeeAggregateResults(
          states.map((state) => encodeGetStateResult(state)),
        ),
      })
      .mockResolvedValueOnce({
        data: encodePendingFeeAggregateResults(
          pendingFeeValues.flatMap((values) =>
            buildPendingFeeAggregateResults(values),
          ),
        ),
      });
  }

  function decodeAggregateCalls(callIndex: number) {
    const request = vi.mocked(publicClient.call).mock.calls[callIndex]?.[0];
    if (!request) {
      throw new Error(`Expected aggregate3 call ${callIndex}`);
    }

    return decodePendingFeeAggregateCalls(request.data);
  }
});

function createPoolKey(tokenAddress: Address): V4PoolKey {
  return {
    currency0: tokenAddress,
    currency1: mockNumeraire,
    fee: 3000,
    tickSpacing: 60,
    hooks: mockHook,
  };
}

function createLockedState(poolKey: V4PoolKey): GetStateResult {
  return [
    mockNumeraire,
    0n,
    mockHook,
    '0x',
    LockablePoolStatus.Locked,
    poolKey,
    mockFarTick,
  ];
}

function encodeGetStateResult(result: GetStateResult): AggregateResult {
  return {
    success: true,
    returnData: encodeFunctionResult({
      abi: dopplerHookInitializerAbi,
      functionName: 'getState',
      result,
    }),
  };
}

function defaultPendingFees(): PendingFeeValues {
  return {
    simulatedFees0: 300n,
    simulatedFees1: 600n,
    shares: 500000000000000000n,
    cumulatedFees0: 1300n,
    cumulatedFees1: 2600n,
    lastCumulatedFees0: 100n,
    lastCumulatedFees1: 400n,
  };
}

function expectedFeeInnerCalls(poolKey: V4PoolKey) {
  const poolId = computePoolId(poolKey);
  const beneficiary = getAddress(mockBeneficiary);
  return expectedPendingFeeCallOrder.map((functionName) => ({
    functionName,
    args:
      functionName === 'collectFees' ||
      functionName === 'getCumulatedFees0' ||
      functionName === 'getCumulatedFees1'
        ? [poolId]
        : [poolId, beneficiary],
  }));
}
