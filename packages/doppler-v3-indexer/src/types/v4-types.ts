import { Address, Hex } from "viem";

/**
 * V4-specific address configuration
 */
export interface V4Addresses {
  poolManager: Address;
  dopplerDeployer: Address;
  v4Initializer: Address;
  v4Initializer2: Address;
  v4InitializerSelfCorrecting: Address;
  v4InitializerLatest: Address;
  stateView: Address;
  dopplerLens: Address;
  v4Migrator: Address;
  v4MigratorHook: Address;
  v4MulticurveInitializer: Address;
  v4MulticurveInitializerHook: Address;
}

/**
 * V4 pool key structure
 */
export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

/**
 * V4 pool configuration
 */
export interface V4PoolConfig {
  numTokensToSell: bigint;
  minProceeds: bigint;
  maxProceeds: bigint;
  startingTime: bigint;
  endingTime: bigint;
  startingTick: number;
  endingTick: number;
  epochLength: bigint;
  gamma: number;
  isToken0: boolean;
  numPdSlugs: bigint;
}

/**
 * V4 position data
 */
export interface PositionData {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  salt: number;
}

/**
 * V4 slot0 data
 */
export interface Slot0Data {
  sqrtPrice: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

/**
 * V4 pool data structure
 */
export interface V4PoolData {
  poolKey: PoolKey;
  slot0Data: Slot0Data;
  liquidity: bigint;
  price: bigint;
  poolConfig: V4PoolConfig;
}

/**
 * Parameters for quoting exact single swap
 */
export interface QuoteExactSingleParams {
  poolKey: PoolKey;
  zeroForOne: boolean;
  exactAmount: bigint;
  hookData: Hex;
}
