import { Address } from "viem";

/**
 * V2-specific address configuration
 */
export interface V2Addresses {
  factory: Address;
}

/**
 * V2 pool data structure (for future use)
 */
export interface V2PoolData {
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  price: bigint;
}