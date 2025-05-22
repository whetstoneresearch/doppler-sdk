import {
  Address,
  Hash,
  PublicClient,
  TestClient,
  WalletClient,
  Hex,
} from 'viem';

export interface Clients {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  testClient?: TestClient;
}

export interface DopplerV4Addresses {
  airlock: Address;
  tokenFactory: Address;
  v4Initializer: Address;
  v3Initializer?: Address;
  governanceFactory: Address;
  migrator: Address;
  poolManager: Address;
  dopplerDeployer: Address;
  universalRouter: Address;
  stateView: Address;
  v4Quoter: Address;
}

export interface TokenConfig {
  name: string;
  symbol: string;
  totalSupply: bigint;
}

export interface GovernanceConfig {
  initialVotingDelay: number;
  initialVotingPeriod: number;
  initialProposalThreshold: bigint;
}

export interface DeploymentConfigParams {
  assetToken: Address;
  quoteToken: Address;
  startTime: number; // in seconds
  endTime: number; // in seconds
  epochLength: number; // in seconds
  startTick: number;
  endTick: number;
  gamma: number;
  minProceeds: bigint;
  maxProceeds: bigint;
  numTokensToSell: bigint;
  numPdSlugs: number;
}

export type ViewOverrides = {
  blockNumber?: bigint;
  blockTag?: 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';
};

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

// this maps onto the tick range, startingTick -> endingTick
export interface PriceRange {
  startPrice: number;
  endPrice: number;
}

export interface TickRange {
  startTick: number;
  endTick: number;
}

export interface DopplerPreDeploymentConfig {
  // Token details
  name: string;
  symbol: string;
  totalSupply: bigint;
  numTokensToSell: bigint;
  tokenURI: string;

  // Time parameters
  blockTimestamp: number;
  startTimeOffset: number; // in days from now
  duration: number; // in days
  epochLength: number; // in seconds

  // Price parameters
  numeraire?: Address; // defaults to native if unset
  priceRange?: PriceRange;
  tickRange?: TickRange;
  tickSpacing: number;
  gamma?: number; // allow gamma to be passed directly instead of computed
  fee: number; // In bips

  // Sale parameters
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // uses a default if not set

  // vesting parameters
  yearlyMintRate: bigint;
  vestingDuration: bigint;
  recipients: Address[];
  amounts: bigint[];

  // Liquidity migration parameters
  liquidityMigratorData?: Hex;

  integrator: Address;
}

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

export interface PoolConfig {
  tickSpacing: number;
  fee: number; // In bips (e.g., 3000 for 0.3%)
}

export interface DopplerDeploymentConfig {
  salt: Hash;
  dopplerAddress: Address;
  poolKey: PoolKey;
  token: TokenConfig;
  hook: DeploymentConfigParams;
  pool: PoolConfig;
  governance: GovernanceConfig;
}

export interface DeployerParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  addresses?: DopplerV4Addresses;
}
