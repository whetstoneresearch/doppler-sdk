import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import {
  dopplerHookInitializerAbi,
  feesManagerAbi,
  v4MulticurveInitializerAbi,
} from '@/abis';
import { DYNAMIC_FEE_FLAG, WAD } from '@/constants';
import { MulticurveFees } from '@/entities/auction/MulticurveFees';
import { LockablePoolStatus, type V4PoolKey } from '@/types';
import { computePoolId } from '@/utils/poolKey';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '@test/setup/fixtures/clients';
import {
  buildPendingFeeAggregateResults,
  createZeroState,
  decodePendingFeeAggregateCalls,
  defaultAddresses,
  encodePendingFeeAggregateResults,
  mockBeneficiary,
  mockDopplerHookInitializer,
  mockFarTick,
  mockNumeraire,
  mockRehypeHook,
  type AggregateResult,
  type MockPublicClient,
  type PendingFeeValues,
} from './multicurvePoolTestHelpers';

const breakdownAddresses = {
  ...defaultAddresses,
  v4ScheduledMulticurveInitializer: undefined,
  v4DecayMulticurveInitializer: undefined,
  dopplerHookInitializer: mockDopplerHookInitializer,
};

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => breakdownAddresses),
  };
});

const tokenA = getAddress(
  '0x0aaa0000000000000000000000000000000000aa',
) as Address;
const tokenB = getAddress(
  '0x0bbb0000000000000000000000000000000000bb',
) as Address;

const zeroPoolKey: V4PoolKey = {
  currency0: zeroAddress,
  currency1: zeroAddress,
  fee: 0,
  tickSpacing: 0,
  hooks: zeroAddress,
};

type StandardStateResult = readonly [Address, number, V4PoolKey, number];
type DopplerHookStateResult = readonly [
  Address,
  bigint,
  Address,
  Hex,
  number,
  V4PoolKey,
  number,
];

describe('MulticurveFees getPendingFeeBreakdown', () => {
  let publicClient: MockPublicClient;

  beforeEach(() => {
    publicClient = createMockPublicClient() as MockPublicClient;
    vi.clearAllMocks();
  });

  it('retrieves pool and Rehype pending fees in one preview aggregate', async () => {
    const standardPoolKey = createStandardPoolKey(tokenA);
    const rehypePoolKey = createDopplerHookPoolKey(tokenB);
    mockDiscovery([
      encodeStandardState(createStandardState(standardPoolKey)),
      encodeDopplerHookState(createZeroDopplerHookState()),
      encodeStandardState(createZeroState()),
      encodeDopplerHookState(
        createDopplerHookState(rehypePoolKey, mockRehypeHook),
      ),
    ]);
    mockPreview([
      ...buildPendingFeeAggregateResults(pendingFees(100n)),
      ...buildPendingFeeAggregateResults(pendingFees(300n)),
      encodePoolKeyProbe(rehypePoolKey),
      ...buildPendingFeeAggregateResults(pendingFees(500n)),
    ]);

    const fees = new MulticurveFees(publicClient, createMockWalletClient(), [
      tokenA,
      tokenB,
    ]);

    await expect(fees.getPendingFeeBreakdown(mockBeneficiary)).resolves.toEqual(
      [
        {
          tokenAddress: tokenA,
          poolInitializerFees: { fees0: 100n, fees1: 110n },
          rehypeFees: {
            mode: 'notConfigured',
            fees0: 0n,
            fees1: 0n,
          },
        },
        {
          tokenAddress: tokenB,
          poolInitializerFees: { fees0: 300n, fees1: 310n },
          rehypeFees: {
            mode: 'feesManager',
            fees0: 500n,
            fees1: 510n,
          },
        },
      ],
    );
    expect(publicClient.call).toHaveBeenCalledTimes(2);

    const previewCalls = decodeAggregateCalls(1);
    expect(previewCalls).toHaveLength(19);
    expect(previewCalls.slice(0, 6).map(({ target }) => target)).toEqual(
      Array(6).fill(breakdownAddresses.v4MulticurveInitializer),
    );
    expect(previewCalls.slice(6, 12).map(({ target }) => target)).toEqual(
      Array(6).fill(mockDopplerHookInitializer),
    );
    expect(previewCalls.slice(12).map(({ target }) => target)).toEqual(
      Array(7).fill(mockRehypeHook),
    );
    expect(
      decodeFunctionData({
        abi: feesManagerAbi,
        data: previewCalls[12]?.callData ?? '0x',
      }),
    ).toEqual({
      functionName: 'getPoolKey',
      args: [computePoolId(rehypePoolKey)],
    });
  });

  it('returns zero unsupported fees for a pre-FeesManager Rehype contract', async () => {
    const poolKey = createDopplerHookPoolKey(tokenA);
    mockDopplerHookDiscovery(poolKey, mockRehypeHook);
    mockPreview([
      ...buildPendingFeeAggregateResults(pendingFees(100n)),
      failedResult(),
      ...Array.from({ length: 6 }, failedResult),
    ]);

    const fees = new MulticurveFees(publicClient, createMockWalletClient(), [
      tokenA,
    ]);

    await expect(fees.getPendingFeeBreakdown(mockBeneficiary)).resolves.toEqual(
      [
        {
          tokenAddress: tokenA,
          poolInitializerFees: { fees0: 100n, fees1: 110n },
          rehypeFees: {
            mode: 'unsupported',
            fees0: 0n,
            fees1: 0n,
          },
        },
      ],
    );
  });

  it('returns zero unsupported fees for an upgraded legacy Rehype pool', async () => {
    const poolKey = createDopplerHookPoolKey(tokenA);
    mockDopplerHookDiscovery(poolKey, mockRehypeHook);
    mockPreview([
      ...buildPendingFeeAggregateResults(pendingFees(100n)),
      encodePoolKeyProbe(zeroPoolKey),
      ...Array.from({ length: 6 }, failedResult),
    ]);

    const fees = new MulticurveFees(publicClient, createMockWalletClient(), [
      tokenA,
    ]);

    await expect(fees.getPendingFeeBreakdown(mockBeneficiary)).resolves.toEqual(
      [
        {
          tokenAddress: tokenA,
          poolInitializerFees: { fees0: 100n, fees1: 110n },
          rehypeFees: {
            mode: 'unsupported',
            fees0: 0n,
            fees1: 0n,
          },
        },
      ],
    );
  });

  it('does not probe Rehype when DopplerHookInitializer has no hook', async () => {
    const poolKey = createDopplerHookPoolKey(tokenA);
    mockDopplerHookDiscovery(poolKey, zeroAddress);
    mockPreview(buildPendingFeeAggregateResults(pendingFees(100n)));

    const fees = new MulticurveFees(publicClient, createMockWalletClient(), [
      tokenA,
    ]);

    await expect(fees.getPendingFeeBreakdown(mockBeneficiary)).resolves.toEqual(
      [
        {
          tokenAddress: tokenA,
          poolInitializerFees: { fees0: 100n, fees1: 110n },
          rehypeFees: {
            mode: 'notConfigured',
            fees0: 0n,
            fees1: 0n,
          },
        },
      ],
    );
    expect(decodeAggregateCalls(1)).toHaveLength(6);
  });

  it('preserves preview failures after detecting FeesManager support', async () => {
    const poolKey = createDopplerHookPoolKey(tokenA);
    mockDopplerHookDiscovery(poolKey, mockRehypeHook);
    mockPreview([
      ...buildPendingFeeAggregateResults(pendingFees(100n)),
      encodePoolKeyProbe(poolKey),
      failedResult(),
      ...buildPendingFeeAggregateResults(pendingFees(500n)).slice(1),
    ]);

    const fees = new MulticurveFees(publicClient, createMockWalletClient(), [
      tokenA,
    ]);

    await expect(fees.getPendingFeeBreakdown(mockBeneficiary)).rejects.toThrow(
      'collectFees call failed',
    );
  });

  it('uses two RPC calls per configured token batch', async () => {
    mockStandardBatch(tokenA, 100n);
    mockStandardBatch(tokenB, 200n);

    const fees = new MulticurveFees(
      publicClient,
      createMockWalletClient(),
      [tokenA, tokenB],
      { tokenBatchSize: 1 },
    );

    await expect(fees.getPendingFeeBreakdown(mockBeneficiary)).resolves.toEqual(
      [
        {
          tokenAddress: tokenA,
          poolInitializerFees: { fees0: 100n, fees1: 110n },
          rehypeFees: {
            mode: 'notConfigured',
            fees0: 0n,
            fees1: 0n,
          },
        },
        {
          tokenAddress: tokenB,
          poolInitializerFees: { fees0: 200n, fees1: 210n },
          rehypeFees: {
            mode: 'notConfigured',
            fees0: 0n,
            fees1: 0n,
          },
        },
      ],
    );
    expect(publicClient.call).toHaveBeenCalledTimes(4);
  });

  function mockStandardBatch(tokenAddress: Address, pendingFees0: bigint) {
    mockDiscovery([
      encodeStandardState(
        createStandardState(createStandardPoolKey(tokenAddress)),
      ),
      encodeDopplerHookState(createZeroDopplerHookState()),
    ]);
    mockPreview(buildPendingFeeAggregateResults(pendingFees(pendingFees0)));
  }

  function mockDopplerHookDiscovery(poolKey: V4PoolKey, rehypeHook: Address) {
    mockDiscovery([
      encodeStandardState(createZeroState()),
      encodeDopplerHookState(createDopplerHookState(poolKey, rehypeHook)),
    ]);
  }

  function mockDiscovery(results: readonly AggregateResult[]) {
    vi.mocked(publicClient.call).mockResolvedValueOnce({
      data: encodePendingFeeAggregateResults(results),
    });
  }

  function mockPreview(results: readonly AggregateResult[]) {
    vi.mocked(publicClient.call).mockResolvedValueOnce({
      data: encodePendingFeeAggregateResults(results),
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

function createStandardPoolKey(tokenAddress: Address): V4PoolKey {
  return {
    currency0: tokenAddress,
    currency1: mockNumeraire,
    fee: 3000,
    tickSpacing: 60,
    hooks: breakdownAddresses.v4MulticurveInitializer,
  };
}

function createDopplerHookPoolKey(tokenAddress: Address): V4PoolKey {
  return {
    currency0: tokenAddress,
    currency1: mockNumeraire,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: 60,
    hooks: mockDopplerHookInitializer,
  };
}

function createStandardState(poolKey: V4PoolKey): StandardStateResult {
  return [mockNumeraire, LockablePoolStatus.Locked, poolKey, mockFarTick];
}

function createDopplerHookState(
  poolKey: V4PoolKey,
  rehypeHook: Address,
): DopplerHookStateResult {
  return [
    mockNumeraire,
    400000n,
    rehypeHook,
    '0x',
    LockablePoolStatus.Locked,
    poolKey,
    mockFarTick,
  ];
}

function createZeroDopplerHookState(): DopplerHookStateResult {
  return [zeroAddress, 0n, zeroAddress, '0x', 0, zeroPoolKey, 0];
}

function encodeStandardState(result: StandardStateResult): AggregateResult {
  return {
    success: true,
    returnData: encodeFunctionResult({
      abi: v4MulticurveInitializerAbi,
      functionName: 'getState',
      result,
    }),
  };
}

function encodeDopplerHookState(
  result: DopplerHookStateResult,
): AggregateResult {
  return {
    success: true,
    returnData: encodeFunctionResult({
      abi: dopplerHookInitializerAbi,
      functionName: 'getState',
      result,
    }),
  };
}

function encodePoolKeyProbe(poolKey: V4PoolKey): AggregateResult {
  return {
    success: true,
    returnData: encodeFunctionResult({
      abi: feesManagerAbi,
      functionName: 'getPoolKey',
      result: [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ],
    }),
  };
}

function pendingFees(fees0: bigint): PendingFeeValues {
  return {
    simulatedFees0: 1n,
    simulatedFees1: 2n,
    shares: WAD,
    cumulatedFees0: fees0 + 10n,
    cumulatedFees1: fees0 + 20n,
    lastCumulatedFees0: 10n,
    lastCumulatedFees1: 10n,
  };
}

function failedResult(): AggregateResult {
  return { success: false, returnData: '0x' };
}
