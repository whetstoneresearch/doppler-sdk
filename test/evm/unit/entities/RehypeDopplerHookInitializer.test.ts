import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  custom,
  encodeErrorResult,
  getAddress,
  type Address,
  type Hex,
} from 'viem';
import { rehypeDopplerHookInitializerAbi } from '@/abis';
import { WAD, ZERO_ADDRESS } from '@/constants';
import { DopplerSDK } from '@/DopplerSDK';
import { RehypeDopplerHookInitializer } from '@/entities/auction/RehypeDopplerHookInitializer';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '@test/setup/fixtures/clients';
import {
  buildPendingFeeAggregateResults,
  decodePendingFeeAggregateCalls,
  decodePendingFeeInnerCall,
  encodePendingFeeAggregateResults,
  expectedPendingFeeCallOrder,
} from './multicurve/multicurvePoolTestHelpers';

type RehypeTestClient = ReturnType<typeof createMockPublicClient> & {
  call: ReturnType<typeof vi.fn>;
  simulateContract: ReturnType<typeof vi.fn>;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
};

const hookAddress = '0x9999999999999999999999999999999999999999' as Address;
const beneficiary = '0x0000000000000000000000000000000000000abc' as Address;
const replacementBeneficiary =
  '0x0000000000000000000000000000000000000def' as Address;
const poolId =
  '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex;
const transactionHash =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;

describe('RehypeDopplerHookInitializer', () => {
  let publicClient: RehypeTestClient;
  let walletClient: ReturnType<typeof createMockWalletClient>;
  let initializer: RehypeDopplerHookInitializer;

  beforeEach(() => {
    publicClient = createMockPublicClient() as RehypeTestClient;
    walletClient = createMockWalletClient();
    initializer = new RehypeDopplerHookInitializer(
      publicClient,
      walletClient,
      hookAddress,
    );
  });

  it('is returned by the canonical SDK accessor', async () => {
    const sdk = new DopplerSDK({
      chainId: 1,
      publicClient,
      walletClient,
    });

    const result = await sdk.getRehypeDopplerHookInitializer(hookAddress);

    expect(result).toBeInstanceOf(RehypeDopplerHookInitializer);
    expect(result.getAddress()).toBe(hookAddress);
  });

  it('previews beneficiary fees using FeesManager accounting', async () => {
    publicClient.call.mockResolvedValueOnce({
      data: encodePendingFeeAggregateResults(
        buildPendingFeeAggregateResults({
          simulatedFees0: 300n,
          simulatedFees1: 600n,
          shares: WAD / 2n,
          cumulatedFees0: 1_300n,
          cumulatedFees1: 2_600n,
          lastCumulatedFees0: 100n,
          lastCumulatedFees1: 400n,
        }),
      ),
    });

    await expect(
      initializer.getPendingFees(poolId, beneficiary),
    ).resolves.toEqual({ fees0: 600n, fees1: 1_100n });

    const aggregateRequest = publicClient.call.mock.calls[0]?.[0];
    if (!aggregateRequest) {
      throw new Error('Expected pending-fee aggregate3 call');
    }
    const aggregateCalls = decodePendingFeeAggregateCalls(
      aggregateRequest.data,
    );
    expect(aggregateCalls.map(({ target }) => target)).toEqual(
      Array(expectedPendingFeeCallOrder.length).fill(hookAddress),
    );
    expect(
      aggregateCalls.map(({ callData }) => decodePendingFeeInnerCall(callData)),
    ).toEqual([
      { functionName: 'collectFees', args: [poolId] },
      {
        functionName: 'getShares',
        args: [poolId, getAddress(beneficiary)],
      },
      { functionName: 'getCumulatedFees0', args: [poolId] },
      { functionName: 'getCumulatedFees1', args: [poolId] },
      {
        functionName: 'getLastCumulatedFees0',
        args: [poolId, getAddress(beneficiary)],
      },
      {
        functionName: 'getLastCumulatedFees1',
        args: [poolId, getAddress(beneficiary)],
      },
    ]);
  });

  it('claims by pool id and returns the FeesManager collect values', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: {
        address: hookAddress,
        functionName: 'collectFees',
        args: [poolId],
      },
      result: [11n, 22n],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({});

    await expect(initializer.claimFees(poolId)).resolves.toEqual({
      fees0: 11n,
      fees1: 22n,
      transactionHash,
    });
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'collectFees',
        args: [poolId],
      }),
    );
  });

  it('decodes the missing-beneficiaries error when claiming a legacy pool', async () => {
    // Given
    const revertData = encodeErrorResult({
      abi: rehypeDopplerHookInitializerAbi,
      errorName: 'FeeBeneficiariesNotConfigured',
    });
    const revertingClient = createPublicClient({
      transport: custom({
        request: () =>
          Promise.reject({
            code: 3,
            message: 'execution reverted',
            data: revertData,
          }),
      }),
    });
    const revertingInitializer = new RehypeDopplerHookInitializer(
      revertingClient,
      walletClient,
      hookAddress,
    );

    // When
    let caughtError: unknown;
    try {
      await revertingInitializer.claimFees(poolId);
    } catch (error) {
      if (!(error instanceof BaseError)) {
        throw error;
      }
      caughtError = error;
    }

    // Then
    expect(caughtError).toBeInstanceOf(BaseError);
    if (!(caughtError instanceof BaseError)) {
      throw caughtError;
    }
    const revertedError = caughtError.walk(
      (error) => error instanceof ContractFunctionRevertedError,
    );
    expect(revertedError).toBeInstanceOf(ContractFunctionRevertedError);
    if (!(revertedError instanceof ContractFunctionRevertedError)) {
      throw revertedError;
    }
    expect(revertedError.data?.errorName).toBe('FeeBeneficiariesNotConfigured');
  });

  it('updates a beneficiary through FeesManager', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: {
        address: hookAddress,
        functionName: 'updateBeneficiary',
        args: [poolId, replacementBeneficiary],
      },
      result: undefined,
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({});

    await expect(
      initializer.updateBeneficiary(poolId, replacementBeneficiary),
    ).resolves.toEqual({ transactionHash });
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'updateBeneficiary',
        args: [poolId, replacementBeneficiary],
      }),
    );
  });

  it('rejects transferring beneficiary shares to the zero address', async () => {
    // Given / When
    const update = initializer.updateBeneficiary(poolId, ZERO_ADDRESS);

    // Then
    await expect(update).rejects.toThrow(
      'Rehype beneficiary cannot be updated to the zero address',
    );
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
  });
});
