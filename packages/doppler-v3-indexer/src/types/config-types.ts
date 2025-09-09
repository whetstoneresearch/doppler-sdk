import { Address } from "viem";
import { V2Addresses } from "./v2-types";
import { V3Addresses } from "./v3-types";
import { V4Addresses } from "./v4-types";

/**
 * Network identifiers
 */
export type Network =
  | "unichain"
  | "baseSepolia"
  | "ink"
  | "base";

/**
 * Chain configuration
 */
export interface ChainConfig {
  id: number;
  name: Network;
  startBlock: number;
  v4StartBlock?: number;
  v4MigratorStartBlock?: number;
  zoraStartBlock?: number;
  oracleStartBlock: number;
  rpcEnvVar: string;
  addresses: ChainAddresses;
}

/**
 * Chain addresses structure
 */
export interface ChainAddresses {
  v2: V2Addresses;
  v3: V3Addresses;
  v4: V4Addresses;
  zora: ZoraAddresses;
  shared: SharedAddresses;
  stables?: StablesAddresses;
  oracle: OracleAddresses;
}

export interface StablesAddresses {
  usdc: Address;
}

export interface ZoraAddresses {
  zoraFactory: Address;
  zoraToken: Address;
  zoraTokenPool: Address;
  creatorCoinHook: Address;
  contentCoinHook: Address;
}

/**
 * Shared addresses across protocols
 */
export interface SharedAddresses {
  airlock: Address;
  tokenFactory: Address;
  universalRouter: Address;
  governanceFactory: Address;
  weth: Address;
  chainlinkEthOracle: Address;
}

/**
 * Oracle addresses
 */
export interface OracleAddresses {
  weth: Address;
  usdc: Address;
  chainlinkEth: Address;
  chainlinkBaseEth: Address;
}

/**
 * Indexer configurations
 */
export type IndexerConfigs = Record<Network, ChainConfig>;
export type DopplerConfig = IndexerConfigs; // Alias for compatibility

/**
 * Block configuration
 */
export interface BlockConfig {
  chain: string;
  startBlock: number;
  interval: number;
}

export type BlockConfigMap = Record<string, BlockConfig>;

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  name: string;
  chains: Network[];
  interval: number;
  getStartBlock: (chainConfig: ChainConfig) => number;
}

/**
 * Metric refresher configuration
 */
export interface MetricRefresherConfig {
  name: string;
  chains: Network[];
  interval: number;
  getStartBlock: (chainConfig: ChainConfig) => number;
}

/**
 * Contract configuration
 */
export interface ContractConfig {
  abi: any; // TODO: Type this properly
  chain: Partial<Record<Network, ChainContractConfig>>;
}

/**
 * Chain-specific contract configuration
 */
export interface ChainContractConfig {
  startBlock: number;
  address: Address | FactoryConfig;
}

/**
 * Factory configuration
 */
export interface FactoryConfig {
  address: Address;
  event: any; // TODO: Type this properly
  parameter: string;
}

export type ContractConfigMap = Record<string, ContractConfig>;

// Re-export protocol-specific addresses from their respective modules
export type { V2Addresses } from "./v2-types";
export type { V3Addresses } from "./v3-types";
export type { V4Addresses } from "./v4-types";