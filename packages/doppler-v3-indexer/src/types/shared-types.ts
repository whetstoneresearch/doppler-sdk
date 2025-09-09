import { Address } from "viem";

/**
 * Asset data from Airlock contract
 */
export interface AssetData {
  numeraire: Address;
  timelock: Address;
  governance: Address;
  liquidityMigrator: Address;
  poolInitializer: Address;
  pool: Address;
  migrationPool: Address;
  numTokensToSell: bigint;
  totalSupply: bigint;
  integrator: Address;
}

/**
 * Common swap types
 */
export type SwapType = "buy" | "sell";

/**
 * Common pool states
 */
export enum PoolStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  GRADUATED = "graduated",
  EXITED = "exited"
}
