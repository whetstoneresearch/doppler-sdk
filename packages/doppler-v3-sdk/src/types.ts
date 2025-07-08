import { Address } from "viem";

export type DopplerV3Addresses = {
  airlock: Address;
  tokenFactory: Address;
  governanceFactory: Address;
  noOpGovernanceFactory?: Address;
  liquidityMigrator: Address;
  v3Initializer: Address;
  universalRouter: Address;
  permit2: Address;
  quoterV2: Address;
  univ2Router02: Address;
  bundler: Address;
  v4Migrator?: Address;
  streamableFeesLocker?: Address;
  lockableV3Initializer?: Address;
};

export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export interface AssetData {
  numeraire: Address;
  pool: Address;
  timelock: Address;
  governance: Address;
  liquidityMigrator: Address;
  poolInitializer: Address;
  migrationPool: Address;
}

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
}

export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

export interface BeneficiaryData {
  beneficiary: Address;
  shares: bigint; // in WAD (1e18)
}

export interface V4MigratorData {
  fee: number; // in bips
  tickSpacing: number;
  lockDuration: number; // in seconds
  beneficiaries: BeneficiaryData[];
}

export interface StreamableFeesConfig {
  lockDuration: number; // in seconds
  beneficiaries: BeneficiaryData[];
}
