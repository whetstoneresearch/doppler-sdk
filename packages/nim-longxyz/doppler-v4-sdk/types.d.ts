import { Address, Hash, PublicClient, TestClient, WalletClient } from 'viem';
export interface Clients {
    publicClient: PublicClient;
    walletClient?: WalletClient;
    testClient?: TestClient;
}
export interface DopplerAddresses {
    airlock: Address;
    tokenFactory: Address;
    uniswapV4Initializer: Address;
    governanceFactory: Address;
    liquidityMigrator: Address;
    stateView: Address;
    quoter: Address;
    customRouter: Address;
    poolManager: Address;
    uniswapV3Initializer?: Address;
}
export interface TokenConfig {
    name: string;
    symbol: string;
    totalSupply: bigint;
}
export interface DeploymentConfigParams {
    assetToken: Address;
    quoteToken: Address;
    startTime: number;
    endTime: number;
    epochLength: number;
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
export interface PriceRange {
    startPrice: number;
    endPrice: number;
}
export interface DopplerPreDeploymentConfig {
    name: string;
    symbol: string;
    totalSupply: bigint;
    numTokensToSell: bigint;
    blockTimestamp: number;
    startTimeOffset: number;
    duration: number;
    epochLength: number;
    priceRange: PriceRange;
    tickSpacing: number;
    fee: number;
    minProceeds: bigint;
    maxProceeds: bigint;
    numPdSlugs?: number;
}
export interface AssetData {
    numeraire: Address;
    poolInitializer: Address;
    timelock: Address;
    governance: Address;
    liquidityMigrator: Address;
    migrationPool: Address;
    integrator: Address;
    totalSupply: bigint;
}
export interface PoolConfig {
    tickSpacing: number;
    fee: number;
}
export interface DopplerDeploymentConfig {
    salt: Hash;
    dopplerAddress: Address;
    poolKey: PoolKey;
    token: TokenConfig;
    hook: DeploymentConfigParams;
    pool: PoolConfig;
}
export interface DeployerParams {
    publicClient: PublicClient;
    walletClient: WalletClient;
    addresses?: DopplerAddresses;
}
