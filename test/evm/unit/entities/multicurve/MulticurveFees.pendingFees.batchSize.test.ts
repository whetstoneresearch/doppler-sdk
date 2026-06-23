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
import {
  createMockPublicClient,
  createMockWalletClient,
} from '@test/setup/fixtures/clients';
import {
  buildPendingFeeAggregateResults,
  decodePendingFeeAggregateCalls,
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

describe('MulticurveFees getPendingFees token batch size', () => {
  let publicClient: MockPublicClient;

  beforeEach(() => {
    publicClient = createMockPublicClient() as MockPublicClient;
    vi.clearAllMocks();
  });

  it('splits pending fee previews by token batch size without splitting a token', async () => {
    mockPendingFeeBatch([tokenA, tokenB], [pendingFees(100n), pendingFees(200n)]);
    mockPendingFeeBatch([tokenC], [pendingFees(300n)]);
    const fees = new MulticurveFees(
      publicClient,
      createMockWalletClient(),
      [tokenA, tokenB, tokenC],
    );

    const result = await fees.getPendingFees(mockBeneficiary, {
      tokenBatchSize: 2,
    });

    expect(result).toEqual([
      { tokenAddress: tokenA, fees0: 100n, fees1: 110n },
      { tokenAddress: tokenB, fees0: 200n, fees1: 210n },
      { tokenAddress: tokenC, fees0: 300n, fees1: 310n },
    ]);
    expect(publicClient.call).toHaveBeenCalledTimes(4);
    expect(decodeDiscoveryTokens(0)).toEqual([tokenA, tokenB]);
    expect(decodeAggregateCalls(1)).toHaveLength(
      expectedPendingFeeCallOrder.length * 2,
    );
    expect(decodeDiscoveryTokens(2)).toEqual([tokenC]);
    expect(decodeAggregateCalls(3)).toHaveLength(
      expectedPendingFeeCallOrder.length,
    );
  });

  it('uses constructor token batch size unless a call override is provided', async () => {
    mockPendingFeeBatch([tokenB, tokenC], [pendingFees(200n), pendingFees(300n)]);
    const fees = new MulticurveFees(
      publicClient,
      createMockWalletClient(),
      [tokenA],
      { tokenBatchSize: 1 },
    );

    await expect(
      fees.getPendingFees(mockBeneficiary, [tokenB, tokenC], {
        tokenBatchSize: 2,
      }),
    ).resolves.toEqual([
      { tokenAddress: tokenB, fees0: 200n, fees1: 210n },
      { tokenAddress: tokenC, fees0: 300n, fees1: 310n },
    ]);
    expect(publicClient.call).toHaveBeenCalledTimes(2);
    expect(decodeDiscoveryTokens(0)).toEqual([tokenB, tokenC]);
  });

  it('throws when token batch size is not a positive integer', async () => {
    const fees = new MulticurveFees(
      publicClient,
      createMockWalletClient(),
      [tokenA],
    );

    await expect(
      fees.getPendingFees(mockBeneficiary, { tokenBatchSize: 0 }),
    ).rejects.toThrow('tokenBatchSize must be a positive integer');
    expect(publicClient.call).not.toHaveBeenCalled();
  });

  function mockPendingFeeBatch(
    tokenAddresses: readonly Address[],
    pendingFeeValues: readonly PendingFeeValues[],
  ) {
    vi.mocked(publicClient.call)
      .mockResolvedValueOnce({
        data: encodePendingFeeAggregateResults(
          tokenAddresses.map((tokenAddress) =>
            encodeGetStateResult(createLockedState(createPoolKey(tokenAddress))),
          ),
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

  function decodeDiscoveryTokens(callIndex: number) {
    return decodeAggregateCalls(callIndex).map(
      (call) =>
        decodeFunctionData({
          abi: dopplerHookInitializerAbi,
          data: call.callData,
        }).args[0],
    );
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

function pendingFees(fees0: bigint): PendingFeeValues {
  return {
    simulatedFees0: 0n,
    simulatedFees1: 0n,
    shares: 1000000000000000000n,
    cumulatedFees0: fees0,
    cumulatedFees1: fees0 + 10n,
    lastCumulatedFees0: 0n,
    lastCumulatedFees1: 0n,
  };
}
