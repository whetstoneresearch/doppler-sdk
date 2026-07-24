import {
  decodeFunctionResult,
  encodeFunctionData,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { feesManagerAbi } from '../../../abis';
import type { SupportedPublicClient } from '../../../types';
import { computePoolId } from '../../../utils/poolKey';
import {
  callAggregate3,
  type Aggregate3Call,
  type Aggregate3Result,
} from '../../../utils/multicall3';
import {
  type InitializerDiscoveryResult,
  parseMulticurvePoolKey,
} from './multicurveInitializerDiscovery';
import {
  discoverMulticurveFeePoolContexts,
  type MulticurvePendingFeesClient,
} from './multicurvePendingFeeReader';
import {
  calculatePendingFees,
  createPendingFeePreviewCalls,
  PENDING_FEE_PREVIEW_CALL_COUNT,
  type MulticurvePendingFees,
} from './multicurvePendingFees';

export type RehypePendingFees =
  | {
      readonly mode: 'feesManager';
      readonly fees0: bigint;
      readonly fees1: bigint;
    }
  | {
      readonly mode: 'unsupported';
      readonly fees0: 0n;
      readonly fees1: 0n;
    }
  | {
      readonly mode: 'notConfigured';
      readonly fees0: 0n;
      readonly fees1: 0n;
    };

export interface MulticurveTokenPendingFeeBreakdown {
  readonly tokenAddress: Address;
  readonly poolInitializerFees: MulticurvePendingFees;
  readonly rehypeFees: RehypePendingFees;
}

type PoolOnlyPreviewPlan = {
  readonly kind: 'poolOnly';
  readonly poolContext: InitializerDiscoveryResult;
  readonly calls: readonly Aggregate3Call[];
};

type RehypePreviewPlan = {
  readonly kind: 'rehype';
  readonly poolContext: InitializerDiscoveryResult;
  readonly poolId: Hex;
  readonly calls: readonly Aggregate3Call[];
};

type PendingFeeBreakdownPreviewPlan = PoolOnlyPreviewPlan | RehypePreviewPlan;

const REHYPE_NOT_CONFIGURED = {
  mode: 'notConfigured',
  fees0: 0n,
  fees1: 0n,
} as const satisfies RehypePendingFees;

const REHYPE_UNSUPPORTED = {
  mode: 'unsupported',
  fees0: 0n,
  fees1: 0n,
} as const satisfies RehypePendingFees;

export async function getPendingFeeBreakdownForMulticurveTokens({
  client,
  beneficiary,
  tokenAddresses,
}: {
  client: SupportedPublicClient;
  beneficiary: Address;
  tokenAddresses: readonly Address[];
}): Promise<readonly MulticurveTokenPendingFeeBreakdown[]> {
  if (tokenAddresses.length === 0) {
    return [];
  }

  const feeClient = client as MulticurvePendingFeesClient;
  const poolContexts = await discoverMulticurveFeePoolContexts(
    feeClient,
    tokenAddresses,
  );
  const plans = poolContexts.map((poolContext) =>
    createPendingFeeBreakdownPreviewPlan(poolContext, beneficiary),
  );
  const calls = plans.flatMap(({ calls: planCalls }) => planCalls);
  const results = await callAggregate3(feeClient, calls);

  if (results.length !== calls.length) {
    throw new Error(
      'Multicall3 aggregate3 returned an incomplete pending fee breakdown result',
    );
  }

  let resultOffset = 0;
  return plans.map((plan) => {
    const planResults = results.slice(
      resultOffset,
      resultOffset + plan.calls.length,
    );
    resultOffset += plan.calls.length;
    return decodePendingFeeBreakdownPreview(plan, planResults);
  });
}

function createPendingFeeBreakdownPreviewPlan(
  poolContext: InitializerDiscoveryResult,
  beneficiary: Address,
): PendingFeeBreakdownPreviewPlan {
  const poolId = computePoolId(poolContext.state.poolKey);
  const poolCalls = createPendingFeePreviewCalls(
    poolContext.initializerAddress,
    poolId,
    beneficiary,
  );
  if (
    poolContext.initializerKind !== 'dopplerHook' ||
    poolContext.dopplerHookAddress === zeroAddress
  ) {
    return {
      kind: 'poolOnly',
      poolContext,
      calls: poolCalls,
    };
  }

  return {
    kind: 'rehype',
    poolContext,
    poolId,
    calls: [
      ...poolCalls,
      createRehypeCapabilityProbe(poolContext.dopplerHookAddress, poolId),
      ...createPendingFeePreviewCalls(
        poolContext.dopplerHookAddress,
        poolId,
        beneficiary,
      ),
    ],
  };
}

function createRehypeCapabilityProbe(
  target: Address,
  poolId: Hex,
): Aggregate3Call {
  return {
    target,
    allowFailure: true,
    callData: encodeFunctionData({
      abi: feesManagerAbi,
      functionName: 'getPoolKey',
      args: [poolId],
    }),
  };
}

function decodePendingFeeBreakdownPreview(
  plan: PendingFeeBreakdownPreviewPlan,
  results: readonly Aggregate3Result[],
): MulticurveTokenPendingFeeBreakdown {
  const poolInitializerFees = calculatePendingFees(
    results.slice(0, PENDING_FEE_PREVIEW_CALL_COUNT),
  );

  return {
    tokenAddress: plan.poolContext.state.asset,
    poolInitializerFees,
    rehypeFees:
      plan.kind === 'poolOnly'
        ? REHYPE_NOT_CONFIGURED
        : decodeRehypePendingFees(plan, results),
  };
}

function decodeRehypePendingFees(
  plan: RehypePreviewPlan,
  results: readonly Aggregate3Result[],
): RehypePendingFees {
  const capabilityResult = results[PENDING_FEE_PREVIEW_CALL_COUNT];
  if (
    !capabilityResult?.success ||
    !capabilityResult.returnData ||
    capabilityResult.returnData === '0x'
  ) {
    return REHYPE_UNSUPPORTED;
  }

  const poolKey = parseMulticurvePoolKey(
    decodeFunctionResult({
      abi: feesManagerAbi,
      functionName: 'getPoolKey',
      data: capabilityResult.returnData,
    }),
  );
  if (poolKey.hooks === zeroAddress) {
    return REHYPE_UNSUPPORTED;
  }
  if (computePoolId(poolKey) !== plan.poolId) {
    throw new Error(
      'Rehype FeesManager pool key does not match the discovered pool',
    );
  }

  return {
    mode: 'feesManager',
    ...calculatePendingFees(
      results.slice(
        PENDING_FEE_PREVIEW_CALL_COUNT + 1,
        PENDING_FEE_PREVIEW_CALL_COUNT * 2 + 1,
      ),
    ),
  };
}
