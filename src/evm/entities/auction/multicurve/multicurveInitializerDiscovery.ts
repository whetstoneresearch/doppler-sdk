import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  type Address,
  type Hex,
  zeroAddress,
} from 'viem';
import type { ChainAddresses } from '../../../addresses';
import { dopplerHookInitializerAbi } from '../../../abis';
import type { MulticurvePoolState, V4PoolKey } from '../../../types';

export interface InitializerDiscoveryResult {
  initializerAddress: Address;
  state: MulticurvePoolState;
}

export type InitializerDiscoveryClient = {
  readContract(parameters: {
    address: Address;
    abi: typeof dopplerHookInitializerAbi;
    functionName: 'getState';
    args: readonly [Address];
  }): Promise<unknown>;
};

export type MulticurveInitializerCandidate = {
  address: Address;
};

type StructLike = Record<string, unknown> & {
  readonly [index: number]: unknown;
};

interface ParsedInitializerState {
  numeraire: Address;
  status: number;
  poolKey: V4PoolKey;
  farTick: number;
}

const ABSENT_POOL_ERROR_ABI = [
  { type: 'error', name: 'PoolNotFound', inputs: [] },
  { type: 'error', name: 'PoolNotInitialized', inputs: [] },
] as const;

export async function findMulticurveInitializerForPool({
  client,
  tokenAddress,
  addresses,
}: {
  client: InitializerDiscoveryClient;
  tokenAddress: Address;
  addresses: ChainAddresses;
}): Promise<InitializerDiscoveryResult> {
  const initializersToTry = getMulticurveInitializerCandidates(addresses);

  if (initializersToTry.length === 0) {
    throw new Error(
      'No DopplerHookInitializer address configured for this chain',
    );
  }

  const triedInitializers: Address[] = [];
  const failedInitializers: Error[] = [];

  for (const initializer of initializersToTry) {
    const { address: initializerAddress } = initializer;
    triedInitializers.push(initializerAddress);

    let stateData: unknown;
    try {
      stateData = await client.readContract({
        address: initializerAddress,
        abi: dopplerHookInitializerAbi,
        functionName: 'getState',
        args: [tokenAddress],
      });
    } catch (error) {
      if (!isAbsentPoolReadFailure(error)) {
        throw error;
      }

      const reason = error instanceof Error ? error.message : String(error);
      failedInitializers.push(
        new Error(`${initializerAddress} getState failed: ${reason}`),
      );
      continue;
    }

    const discoveryResult = parseMulticurveInitializerDiscoveryResult({
      tokenAddress,
      initializerAddress,
      stateData,
    });

    if (isInitializedMulticurvePoolKey(discoveryResult.state.poolKey)) {
      return discoveryResult;
    }
  }

  const notFoundError = new Error(
    `Pool not found for token ${tokenAddress}. ` +
      `Tried initializers: ${triedInitializers.join(', ')}` +
      (failedInitializers.length > 0
        ? `. Failed initializers: ${failedInitializers
            .map((error) => error.message)
            .join(' | ')}`
        : ''),
  );

  if (failedInitializers.length > 0) {
    (notFoundError as Error & { cause?: AggregateError }).cause =
      new AggregateError(
        failedInitializers,
        `Initializer discovery failed for token ${tokenAddress}`,
      );
  }

  throw notFoundError;
}

export function parseMulticurvePoolKey(rawPoolKey: unknown): V4PoolKey {
  const poolKeyStruct = rawPoolKey as StructLike;
  return {
    currency0: (poolKeyStruct.currency0 ?? poolKeyStruct[0]) as Address,
    currency1: (poolKeyStruct.currency1 ?? poolKeyStruct[1]) as Address,
    fee: Number(poolKeyStruct.fee ?? poolKeyStruct[2]),
    tickSpacing: Number(poolKeyStruct.tickSpacing ?? poolKeyStruct[3]),
    hooks: (poolKeyStruct.hooks ?? poolKeyStruct[4]) as Address,
  };
}

export function getMulticurveInitializerCandidates(
  addresses: ChainAddresses,
): readonly MulticurveInitializerCandidate[] {
  const candidates: MulticurveInitializerCandidate[] = [];
  if (
    addresses.dopplerHookInitializer &&
    addresses.dopplerHookInitializer !== zeroAddress
  ) {
    candidates.push({
      address: addresses.dopplerHookInitializer,
    });
  }
  return candidates;
}

export function parseMulticurveInitializerDiscoveryResult({
  tokenAddress,
  initializerAddress,
  stateData,
}: {
  tokenAddress: Address;
  initializerAddress: Address;
  stateData: unknown;
}): InitializerDiscoveryResult {
  const parsedState = parseDopplerHookInitializerState(stateData);

  const { numeraire, status, poolKey, farTick } = parsedState;
  return {
    initializerAddress,
    state: {
      asset: tokenAddress,
      numeraire,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      status,
      poolKey,
      farTick: Number(farTick),
    },
  };
}

export function isInitializedMulticurvePoolKey(poolKey: V4PoolKey): boolean {
  return poolKey.hooks !== zeroAddress && poolKey.tickSpacing !== 0;
}

export function isAbsentPoolRevertData(data: Hex): boolean {
  if (data === '0x') {
    return false;
  }

  try {
    const decodedError = decodeErrorResult({
      abi: ABSENT_POOL_ERROR_ABI,
      data,
    });
    return (
      decodedError.errorName === 'PoolNotFound' ||
      decodedError.errorName === 'PoolNotInitialized'
    );
  } catch (error) {
    if (error instanceof Error) {
      return false;
    }
    throw error;
  }
}

function parseDopplerHookInitializerState(
  stateData: unknown,
): ParsedInitializerState {
  const state = stateData as StructLike;
  return {
    numeraire: (state.numeraire ?? state[0]) as Address,
    status: Number(state.status ?? state[4]),
    poolKey: parseMulticurvePoolKey(state.poolKey ?? state[5]),
    farTick: Number(state.farTick ?? state[6]),
  };
}

function isAbsentPoolReadFailure(error: unknown): boolean {
  if (!(error instanceof BaseError)) {
    return false;
  }

  const revertedError = error.walk(
    (cause) => cause instanceof ContractFunctionRevertedError,
  );
  if (!(revertedError instanceof ContractFunctionRevertedError)) {
    return false;
  }

  return (
    revertedError.data?.errorName === 'PoolNotFound' ||
    revertedError.data?.errorName === 'PoolNotInitialized'
  );
}
