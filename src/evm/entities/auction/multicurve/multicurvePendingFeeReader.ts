import { decodeFunctionResult, encodeFunctionData, type Address } from 'viem';
import { getAddresses, type SupportedChainId } from '../../../addresses';
import { LockablePoolStatus, type SupportedPublicClient } from '../../../types';
import { computePoolId } from '../../../utils/poolKey';
import {
  callAggregate3,
  type Aggregate3Call,
  type Aggregate3Result,
  type Multicall3Client,
} from '../../../utils/multicall3';
import {
  calculatePendingFees,
  createPendingFeePreviewCalls,
  PENDING_FEE_PREVIEW_CALL_COUNT,
  type MulticurvePendingFees,
  type MulticurveTokenPendingFees,
} from './multicurvePendingFees';
import {
  getMulticurveInitializerAbi,
  getMulticurveInitializerCandidates,
  isAbsentPoolRevertData,
  isInitializedMulticurvePoolKey,
  parseMulticurveInitializerDiscoveryResult,
  type InitializerDiscoveryResult,
  type MulticurveInitializerCandidate,
} from './multicurveInitializerDiscovery';

export type MulticurvePendingFeesClient = Multicall3Client & {
  getChainId(): Promise<number>;
};

type DiscoveryCallContext = {
  tokenAddress: Address;
  initializer: MulticurveInitializerCandidate;
};

export async function getPendingFeesForMulticurvePool({
  client,
  beneficiary,
  poolContext,
}: {
  client: MulticurvePendingFeesClient;
  beneficiary: Address;
  poolContext: InitializerDiscoveryResult;
}): Promise<MulticurvePendingFees> {
  const pendingFees = await getPendingFeesForDiscoveredMulticurvePools({
    client,
    beneficiary,
    poolContexts: [poolContext],
  });
  const poolPendingFees = pendingFees[0];
  if (!poolPendingFees) {
    throw new Error('Pending fee preview returned no pool result');
  }

  return {
    fees0: poolPendingFees.fees0,
    fees1: poolPendingFees.fees1,
  };
}

export async function getPendingFeesForMulticurveTokens({
  client,
  beneficiary,
  tokenAddresses,
}: {
  client: SupportedPublicClient;
  beneficiary: Address;
  tokenAddresses: readonly Address[];
}): Promise<readonly MulticurveTokenPendingFees[]> {
  if (tokenAddresses.length === 0) {
    return [];
  }

  const feeClient = client as MulticurvePendingFeesClient;
  const poolContexts = await discoverMulticurveFeePoolContexts(
    feeClient,
    tokenAddresses,
  );
  return getPendingFeesForDiscoveredMulticurvePools({
    client: feeClient,
    beneficiary,
    poolContexts,
  });
}

export async function discoverMulticurveFeePoolContexts(
  client: MulticurvePendingFeesClient,
  tokenAddresses: readonly Address[],
): Promise<readonly InitializerDiscoveryResult[]> {
  const chainId = await client.getChainId();
  const addresses = getAddresses(chainId as SupportedChainId);
  const initializers = getMulticurveInitializerCandidates(addresses);

  if (initializers.length === 0) {
    throw new Error(
      'No V4 multicurve initializer addresses configured for this chain',
    );
  }

  const discoveryContexts = createDiscoveryCallContexts(
    tokenAddresses,
    initializers,
  );
  const discoveryResults = await callAggregate3(
    client,
    createDiscoveryCalls(discoveryContexts),
  );

  if (discoveryResults.length !== discoveryContexts.length) {
    throw new Error(
      'Multicall3 aggregate3 returned an incomplete initializer discovery result',
    );
  }

  return tokenAddresses.map((tokenAddress, tokenIndex) =>
    findInitializedPoolForToken({
      tokenAddress,
      initializers,
      discoveryResults: discoveryResults.slice(
        tokenIndex * initializers.length,
        (tokenIndex + 1) * initializers.length,
      ),
    }),
  );
}

function createDiscoveryCallContexts(
  tokenAddresses: readonly Address[],
  initializers: readonly MulticurveInitializerCandidate[],
): readonly DiscoveryCallContext[] {
  return tokenAddresses.flatMap((tokenAddress) =>
    initializers.map((initializer) => ({
      tokenAddress,
      initializer,
    })),
  );
}

function createDiscoveryCalls(
  contexts: readonly DiscoveryCallContext[],
): readonly Aggregate3Call[] {
  return contexts.map(({ tokenAddress, initializer }) => ({
    target: initializer.address,
    allowFailure: true,
    callData: encodeFunctionData({
      abi: getMulticurveInitializerAbi(initializer.kind),
      functionName: 'getState',
      args: [tokenAddress],
    }),
  }));
}

function findInitializedPoolForToken({
  tokenAddress,
  initializers,
  discoveryResults,
}: {
  tokenAddress: Address;
  initializers: readonly MulticurveInitializerCandidate[];
  discoveryResults: readonly Aggregate3Result[];
}): InitializerDiscoveryResult {
  for (const [index, result] of discoveryResults.entries()) {
    const initializer = initializers[index];
    if (!initializer) {
      throw new Error(
        'Multicall3 aggregate3 returned an incomplete initializer discovery result',
      );
    }

    if (!result.success) {
      if (isAbsentPoolRevertData(result.returnData)) {
        continue;
      }

      throw new Error(
        `${initializer.address} getState failed for token ${tokenAddress}`,
      );
    }

    if (!result.returnData || result.returnData === '0x') {
      throw new Error(
        `${initializer.address} getState returned no data for token ${tokenAddress}`,
      );
    }

    const discoveryResult = parseMulticurveInitializerDiscoveryResult({
      tokenAddress,
      initializerAddress: initializer.address,
      kind: initializer.kind,
      stateData: decodeFunctionResult({
        abi: getMulticurveInitializerAbi(initializer.kind),
        functionName: 'getState',
        data: result.returnData,
      }),
    });

    if (isInitializedMulticurvePoolKey(discoveryResult.state.poolKey)) {
      assertPendingFeePreviewable(discoveryResult);
      return discoveryResult;
    }
  }

  throw new Error(
    `Pool not found for token ${tokenAddress}. ` +
      `Tried initializers: ${initializers
        .map((initializer) => initializer.address)
        .join(', ')}`,
  );
}

function assertPendingFeePreviewable(
  discoveryResult: InitializerDiscoveryResult,
) {
  const { asset, status } = discoveryResult.state;
  if (status === LockablePoolStatus.Exited) {
    throw new Error(
      `Pending fee preview is only supported for initializer-side multicurve pools: ${asset}`,
    );
  }

  if (status !== LockablePoolStatus.Locked) {
    throw new Error(`Multicurve pool is not locked or was migrated: ${asset}`);
  }
}

async function getPendingFeesForDiscoveredMulticurvePools({
  client,
  beneficiary,
  poolContexts,
}: {
  client: MulticurvePendingFeesClient;
  beneficiary: Address;
  poolContexts: readonly InitializerDiscoveryResult[];
}): Promise<readonly MulticurveTokenPendingFees[]> {
  for (const poolContext of poolContexts) {
    assertPendingFeePreviewable(poolContext);
  }

  const previewCalls = poolContexts.flatMap(({ initializerAddress, state }) =>
    createPendingFeePreviewCalls(
      initializerAddress,
      computePoolId(state.poolKey),
      beneficiary,
    ),
  );
  const previewResults = await callAggregate3(client, previewCalls);

  return poolContexts.map(({ state }, index) => ({
    tokenAddress: state.asset,
    ...calculatePendingFees(
      previewResults.slice(
        index * PENDING_FEE_PREVIEW_CALL_COUNT,
        (index + 1) * PENDING_FEE_PREVIEW_CALL_COUNT,
      ),
    ),
  }));
}
