import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  type PublicClient,
} from 'viem';
import type {
  MulticurveDecayFeeSchedule,
  MulticurvePoolState,
} from '../../../types';
import { decayMulticurveInitializerHookAbi } from '../../../abis';
import { DYNAMIC_FEE_FLAG } from '../../../constants';
import { computePoolId } from '../../../utils/poolKey';

export async function getMulticurveFeeSchedule(
  client: Pick<PublicClient, 'readContract'>,
  state: MulticurvePoolState,
): Promise<MulticurveDecayFeeSchedule | null> {
  if (state.poolKey.fee !== DYNAMIC_FEE_FLAG) {
    return null;
  }

  const poolId = computePoolId(state.poolKey);
  try {
    const scheduleData = await client.readContract({
      address: state.poolKey.hooks,
      abi: decayMulticurveInitializerHookAbi,
      functionName: 'getFeeScheduleOf',
      args: [poolId],
    });

    return {
      startingTime: Number(readStructField(scheduleData, 'startingTime', 0)),
      startFee: Number(readStructField(scheduleData, 'startFee', 1)),
      endFee: Number(readStructField(scheduleData, 'endFee', 2)),
      lastFee: Number(readStructField(scheduleData, 'lastFee', 3)),
      durationSeconds: Number(
        readStructField(scheduleData, 'durationSeconds', 4),
      ),
    };
  } catch (error) {
    if (!isMissingFeeScheduleHook(error)) {
      throw error;
    }

    throw new Error(
      `Dynamic multicurve hook at ${state.poolKey.hooks} does not expose getFeeScheduleOf(poolId)`,
      { cause: error },
    );
  }
}

function isMissingFeeScheduleHook(error: unknown): boolean {
  if (!(error instanceof BaseError)) {
    return false;
  }

  return Boolean(
    error.walk(
      (cause) =>
        cause instanceof ContractFunctionZeroDataError ||
        (cause instanceof ContractFunctionRevertedError &&
          !cause.data &&
          !cause.reason &&
          !cause.signature),
    ),
  );
}

function readStructField(
  value: unknown,
  fieldName: string,
  tupleIndex: number,
): unknown {
  if (Array.isArray(value)) {
    return value[tupleIndex] ?? 0;
  }

  if (typeof value === 'object' && value !== null && fieldName in value) {
    return value[fieldName as keyof typeof value] ?? 0;
  }

  return 0;
}
