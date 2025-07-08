import { Address } from "viem";

/**
 * V3-specific address configuration
 */
export interface V3Addresses {
  v3Initializer: Address;
  lockableV3Initializer: Address;
}

/**
 * V3 pool state tracking
 */
export interface PoolState {
  asset: Address;
  numeraire: Address;
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  isInitialized: boolean;
  isExited: boolean;
  maxShareToBeSold: bigint;
  maxShareToBond: bigint;
  initializer: Address;
}

export interface BeneficiaryData {
  beneficiary: Address;
  shares: bigint;
}

export interface LpPosition {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  id: number;
}

export interface LockablePoolState {
  asset: Address;
  numeraire: Address;
  tickLower: number;
  tickUpper: number;
  maxShareToBeSold: bigint;
  totalTokensOnBondingCurve: bigint;
  poolStatus: number;
}

/**
 * V3 pool data structure
 */
export interface V3PoolData {
  slot0Data: {
    sqrtPrice: bigint;
    tick: number;
  };
  liquidity: bigint;
  token0: Address;
  token1: Address;
  poolState: PoolState;
  price: bigint;
  fee: number;
  reserve0: bigint;
  reserve1: bigint;
}
export interface LockableV3PoolData {
  slot0Data: {
    sqrtPrice: bigint;
    tick: number;
  };
  liquidity: bigint;
  token0: Address;
  token1: Address;
  poolState: LockablePoolState;
  price: bigint;
  fee: number;
  reserve0: bigint;
  reserve1: bigint;
}

