import {
  decodeFunctionResult,
  encodeFunctionData,
  type Address,
  type Hex,
} from 'viem';
import { feeClaimsInitializerAbi } from '../../../abis';
import { WAD } from '../../../constants';
import type {
  Aggregate3Call,
  Aggregate3Result,
} from '../../../utils/multicall3';

export interface MulticurvePendingFees {
  fees0: bigint;
  fees1: bigint;
}

type PendingFeeReadFunctionName =
  | 'getShares'
  | 'getCumulatedFees0'
  | 'getCumulatedFees1'
  | 'getLastCumulatedFees0'
  | 'getLastCumulatedFees1';

type PendingFeeCallFunctionName = PendingFeeReadFunctionName | 'collectFees';

const PENDING_FEE_CALL_ORDER = [
  'collectFees',
  'getShares',
  'getCumulatedFees0',
  'getCumulatedFees1',
  'getLastCumulatedFees0',
  'getLastCumulatedFees1',
] as const satisfies readonly PendingFeeCallFunctionName[];

export function createPendingFeePreviewCalls(
  target: Address,
  poolId: Hex,
  beneficiary: Address,
): readonly Aggregate3Call[] {
  return PENDING_FEE_CALL_ORDER.map((functionName) => ({
    target,
    allowFailure: true,
    callData: encodeFunctionData({
      abi: feeClaimsInitializerAbi,
      functionName,
      args:
        functionName === 'collectFees' ||
        functionName === 'getCumulatedFees0' ||
        functionName === 'getCumulatedFees1'
          ? [poolId]
          : [poolId, beneficiary],
    }),
  }));
}

export function calculatePendingFees(
  callResults: readonly Aggregate3Result[],
): MulticurvePendingFees {
  const preview = decodePendingFeePreview(callResults);

  if (preview.cumulatedFees0 < preview.lastCumulatedFees0) {
    throw new Error('Accumulated fees are below beneficiary checkpoint');
  }

  if (preview.cumulatedFees1 < preview.lastCumulatedFees1) {
    throw new Error('Accumulated fees are below beneficiary checkpoint');
  }

  return {
    fees0:
      ((preview.cumulatedFees0 - preview.lastCumulatedFees0) * preview.shares) /
      WAD,
    fees1:
      ((preview.cumulatedFees1 - preview.lastCumulatedFees1) * preview.shares) /
      WAD,
  };
}

function decodePendingFeePreview(callResults: readonly Aggregate3Result[]): {
  shares: bigint;
  cumulatedFees0: bigint;
  cumulatedFees1: bigint;
  lastCumulatedFees0: bigint;
  lastCumulatedFees1: bigint;
} {
  if (callResults.length !== PENDING_FEE_CALL_ORDER.length) {
    throw new Error('Multicall3 aggregate3 returned an incomplete pool result');
  }

  for (const [index, result] of callResults.entries()) {
    const functionName = PENDING_FEE_CALL_ORDER[index];
    if (!result.success) {
      throw new Error(`${functionName} call failed`);
    }

    if (!result.returnData || result.returnData === '0x') {
      throw new Error(`${functionName} returned no data`);
    }
  }

  decodeFunctionResult({
    abi: feeClaimsInitializerAbi,
    functionName: 'collectFees',
    data: callResults[0].returnData,
  });

  return {
    shares: decodeUint256('getShares', callResults[1].returnData),
    cumulatedFees0: decodeUint256(
      'getCumulatedFees0',
      callResults[2].returnData,
    ),
    cumulatedFees1: decodeUint256(
      'getCumulatedFees1',
      callResults[3].returnData,
    ),
    lastCumulatedFees0: decodeUint256(
      'getLastCumulatedFees0',
      callResults[4].returnData,
    ),
    lastCumulatedFees1: decodeUint256(
      'getLastCumulatedFees1',
      callResults[5].returnData,
    ),
  };
}

function decodeUint256(
  functionName: PendingFeeReadFunctionName,
  data: Hex,
): bigint {
  const value = decodeFunctionResult({
    abi: feeClaimsInitializerAbi,
    functionName,
    data,
  });

  if (typeof value !== 'bigint') {
    throw new Error(`${functionName} returned invalid data`);
  }

  return value;
}
