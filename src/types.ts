import { base, baseSepolia, ink, unichain } from 'viem/chains';
import { CHAIN_IDS, type SupportedChainId } from './addresses';
// Re-export SupportedChainId so consumers can import from this module
export { type SupportedChainId } from './addresses';
import type { Address, WalletClient } from 'viem';

export type SupportedChain =
  | typeof base
  | typeof baseSepolia
  | typeof ink
  | typeof unichain
  | typeof baseSepolia;
// Use a wide type to avoid cross-package viem type identity issues when linking packages locally.
export type SupportedPublicClient = unknown;

// Core configuration types
// Token configuration (discriminated union)
export interface StandardTokenConfig {
  type?: 'standard'; // default behavior (backwards compatible)
  name: string;
  symbol: string;
  tokenURI: string;
  yearlyMintRate?: bigint; // Optional yearly mint rate (in WAD, default: 2% = 0.02e18)
}

export interface Doppler404TokenConfig {
  type: 'doppler404';
  name: string;
  symbol: string;
  baseURI: string;
  // Optional unit for DN404 factory (uint256). Defaults to 1000 when omitted.
  unit?: bigint;
}

export type TokenConfig = StandardTokenConfig | Doppler404TokenConfig;

export interface SaleConfig {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address; // e.g., WETH address
}

// Static Auction Pool configuration
export interface StaticPoolConfig {
  startTick: number;
  endTick: number;
  fee: number; // e.g., 3000 for 0.3%
  // Optional parameters for lockable initializer
  numPositions?: number; // Number of liquidity positions (default: based on tick range)
  maxShareToBeSold?: bigint; // Maximum share of tokens to sell (in WAD, default: 1e18 = 100%)
  beneficiaries?: BeneficiaryData[]; // Optional beneficiaries for fee streaming
}

// Dynamic Auction configuration
export interface DynamicAuctionConfig {
  duration: number; // in seconds
  epochLength: number; // in seconds
  startTick: number;
  endTick: number;
  gamma?: number; // Optional, can be auto-calculated
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // Price discovery slugs (optional)
}

// Opening Auction configuration
export interface OpeningAuctionConfig {
  auctionDuration: number; // in seconds
  minAcceptableTickToken0: number;
  minAcceptableTickToken1: number;
  incentiveShareBps: number;
  tickSpacing: number;
  fee: number; // e.g., 3000 for 0.3%
  minLiquidity: bigint;
  shareToAuctionBps: number;
}

// Doppler handoff configuration used by opening-auction initializer
export interface OpeningAuctionDopplerConfig {
  minProceeds: bigint;
  maxProceeds: bigint;
  startTick: number;
  endTick: number;
  epochLength: number; // in seconds
  duration: number; // in seconds
  gamma?: number;
  numPdSlugs?: number;
  fee: number; // e.g., 10000 for 1%
  tickSpacing: number;
  // Optional time controls for deterministic simulations/builds
  startTimeOffset?: number;
  startingTime?: number;
}

// Vesting configuration
export interface VestingConfig {
  duration: number; // in seconds
  cliffDuration: number; // in seconds
  recipients?: Address[]; // Optional array of recipient addresses (defaults to [userAddress] if not specified)
  amounts?: bigint[]; // Optional array of vesting amounts per recipient (must match recipients length if provided)
}

// Chains where no-op governance is enabled
export const NO_OP_ENABLED_CHAIN_IDS = [
  CHAIN_IDS.BASE,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.UNICHAIN,
  CHAIN_IDS.UNICHAIN_SEPOLIA,
  CHAIN_IDS.MONAD_TESTNET,
  CHAIN_IDS.MONAD_MAINNET,
] as const;

export type NoOpEnabledChainId = (typeof NO_OP_ENABLED_CHAIN_IDS)[number];

/**
 * Check if a chain supports no-op governance
 */
export function isNoOpEnabledChain(
  chainId: number,
): chainId is NoOpEnabledChainId {
  return (NO_OP_ENABLED_CHAIN_IDS as readonly number[]).includes(chainId);
}

// Chains where launchpad governance is enabled
export const LAUNCHPAD_ENABLED_CHAIN_IDS = [
  CHAIN_IDS.BASE,
  CHAIN_IDS.MONAD_MAINNET,
] as const;

export type LaunchpadEnabledChainId =
  (typeof LAUNCHPAD_ENABLED_CHAIN_IDS)[number];

/**
 * Check if a chain supports launchpad governance
 */
export function isLaunchpadEnabledChain(
  chainId: number,
): chainId is LaunchpadEnabledChainId {
  return (LAUNCHPAD_ENABLED_CHAIN_IDS as readonly number[]).includes(chainId);
}

// Governance configuration (discriminated union)
export type GovernanceDefault = { type: 'default' };
export interface GovernanceCustom {
  type: 'custom';
  initialVotingDelay: number;
  initialVotingPeriod: number;
  initialProposalThreshold: bigint;
}
export type GovernanceNoOp = { type: 'noOp' };
export interface GovernanceLaunchpad {
  type: 'launchpad';
  multisig: Address;
}

export type GovernanceOption<C extends SupportedChainId> =
  | GovernanceDefault
  | GovernanceCustom
  | (C extends NoOpEnabledChainId ? GovernanceNoOp : never)
  | (C extends LaunchpadEnabledChainId ? GovernanceLaunchpad : never);

// Unified beneficiary data used for fee streaming, lockable initializers, and migration configs
// Uses shares in WAD format (1e18 = 100%) for consistency across all beneficiary configurations
export interface BeneficiaryData {
  beneficiary: Address;
  shares: bigint; // shares in WAD (1e18 = 100%)
}

// Pool status for lockable initializer
export enum LockablePoolStatus {
  Uninitialized = 0,
  Initialized = 1,
  Locked = 2,
  Exited = 3,
}

// Opening auction phase (hook-level)
export enum OpeningAuctionPhase {
  NotStarted = 0,
  Active = 1,
  Closed = 2,
  Settled = 3,
}

// Opening auction status (initializer-level)
export enum OpeningAuctionStatus {
  Uninitialized = 0,
  AuctionActive = 1,
  DopplerActive = 2,
  Exited = 3,
}

// Lockable pool state
export interface LockablePoolState {
  asset: Address;
  numeraire: Address;
  tickLower: number;
  tickUpper: number;
  maxShareToBeSold: bigint;
  totalTokensOnBondingCurve: bigint;
  status: LockablePoolStatus;
}

// Multicurve pool state (V4 initializer)
export interface MulticurvePoolState {
  asset: Address;
  numeraire: Address;
  fee: number;
  tickSpacing: number;
  status: LockablePoolStatus; // Reuses the same enum
  poolKey: V4PoolKey;
  farTick: number;
}

// Migration configuration (discriminated union)
export type MigrationConfig =
  | { type: 'uniswapV2' } // Basic migration to a new Uniswap v2 pool
  | {
      type: 'uniswapV4';
      fee: number;
      tickSpacing: number;
      // Configuration for fee streaming via StreamableFeesLocker (optional)
      // When omitted, fees are not locked and beneficiaries are not configured
      // This is useful when using noOp governance where lock duration is not meaningful
      streamableFees?: {
        lockDuration: number; // in seconds
        beneficiaries: BeneficiaryData[]; // Uses shares in WAD (1e18 = 100%)
      };
    }
  | { type: 'noOp' }; // No migration - used with lockable beneficiaries

// Create Static Auction parameters
export interface CreateStaticAuctionParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Static Auction (Uniswap v3) Pool configuration
  pool: StaticPoolConfig;

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration (required). Use `{ type: 'noOp' }` where enabled,
  // `{ type: 'default' }` for standard defaults, or `{ type: 'custom', ... }` to customize.
  governance: GovernanceOption<C>;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;

  // Optional transaction gas limit override for the create() transaction
  // If omitted, SDK will default to 13,500,000 gas for create()
  gas?: bigint;
}

// Create Dynamic Auction parameters
export interface CreateDynamicAuctionParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Dynamic Auction (Uniswap v4 Hook) configuration
  auction: DynamicAuctionConfig;

  // Pool configuration
  pool: {
    fee: number; // e.g., 3000 for 0.3%
    tickSpacing: number;
  };

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration (required). Use `{ type: 'noOp' }` where enabled,
  // `{ type: 'default' }` for standard defaults, or `{ type: 'custom', ... }` to customize.
  governance: GovernanceOption<C>;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Time configuration (internal use)
  startTimeOffset?: number;
  blockTimestamp?: number; // Optional: use this block timestamp instead of fetching latest

  // Optional transaction gas limit override for the create() transaction
  // If omitted, SDK will default to 13,500,000 gas for create()
  gas?: bigint;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;
}

// Create Opening Auction parameters
export interface CreateOpeningAuctionParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Opening auction configuration
  openingAuction: OpeningAuctionConfig;

  // Doppler handoff configuration
  doppler: OpeningAuctionDopplerConfig;

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration (required). Use `{ type: 'noOp' }` where enabled,
  // `{ type: 'default' }` for standard defaults, or `{ type: 'custom', ... }` to customize.
  governance: GovernanceOption<C>;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Optional timing controls for Doppler handoff start
  startTimeOffset?: number;
  startingTime?: number;

  // Optional: use this block timestamp instead of fetching latest
  blockTimestamp?: number;

  // Optional transaction gas limit override for the create() transaction
  // If omitted, SDK will default to 13,500,000 gas for create()
  gas?: bigint;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;
}

// Price range configuration for automatic tick calculation
export interface PriceRange {
  startPrice: number;
  endPrice: number;
}

// Tick range configuration
export interface TickRange {
  startTick: number;
  endTick: number;
}

// ============================================================================
// Market Cap Configuration Types
// ============================================================================

/**
 * Market cap range in USD for price configurations.
 * Used to define start and end market caps for bonding curves.
 */
export interface MarketCapRange {
  /** Starting market cap in USD (e.g., 100_000 for $100k) */
  start: number;
  /** Ending market cap in USD (e.g., 10_000_000 for $10M) */
  end: number;
}

/**
 * Base configuration for market cap-based tick calculations.
 * Used by builder methods to convert market caps to ticks.
 */
export interface MarketCapConfig {
  /** Target market cap range in USD */
  marketCap: MarketCapRange;
  /** Price of numeraire in USD (e.g., 3000 for ETH at $3000) */
  numerairePrice: number;
  /**
   * Token supply override. If not provided, inferred from saleConfig.initialSupply.
   * Must include decimals (e.g., parseEther('1000000000') for 1B tokens).
   */
  tokenSupply?: bigint;
  /** Token decimals (default: 18) */
  tokenDecimals?: number;
  /** Numeraire decimals (default: 18) */
  numeraireDecimals?: number;
}

/**
 * Market cap configuration for V3 Static Auctions.
 * Extends base config with V3-specific parameters.
 */
export interface StaticAuctionMarketCapConfig extends MarketCapConfig {
  /** Fee tier in basis points (e.g., 10000 for 1%). Default: 10000 */
  fee?: number;
  /** Number of liquidity positions. Default: 15 */
  numPositions?: number;
  /** Maximum share of tokens to sell per position (WAD). Default: 35% */
  maxShareToBeSold?: bigint;
}

/**
 * Market cap range for V4 Dynamic Auctions (Dutch auctions).
 * Uses start/min because price descends from start to minimum.
 */
export interface DynamicMarketCapRange {
  /** Starting market cap in USD - auction begins here (e.g., 500_000 for $500k) */
  start: number;
  /** Minimum market cap in USD - floor price the auction descends to (e.g., 50_000 for $50k) */
  min: number;
}

/**
 * Market cap configuration for V4 Dynamic Auctions.
 * Uses start/min (not start/end) because Dutch auctions descend from start to minimum.
 */
export interface DynamicAuctionMarketCapConfig {
  /** Target market cap range (start = launch price, min = floor price) */
  marketCap: DynamicMarketCapRange;
  /** Price of numeraire in USD (e.g., 3000 for ETH at $3000) */
  numerairePrice: number;
  /**
   * Token supply override. If not provided, inferred from saleConfig.initialSupply.
   * Must include decimals (e.g., parseEther('1000000000') for 1B tokens).
   */
  tokenSupply?: bigint;
  /** Token decimals (default: 18) */
  tokenDecimals?: number;
  /** Numeraire decimals (default: 18) */
  numeraireDecimals?: number;
  /**
   * Pool fee in basis points. Default: 10000 (1%)
   *
   * V4 pools support any fee from 0 to 100,000 (10%).
   * Standard tiers (100, 500, 3000, 10000) auto-derive tickSpacing.
   * Custom fees require explicit tickSpacing parameter.
   */
  fee?: number;
  /**
   * Tick spacing for the pool. Required for custom fees.
   *
   * Must be <= 30 for Doppler pools (MAX_TICK_SPACING constraint).
   * If not provided with a standard fee tier, defaults to 30.
   */
  tickSpacing?: number;
  /** Minimum proceeds required for successful auction */
  minProceeds: bigint;
  /** Maximum proceeds cap for the auction */
  maxProceeds: bigint;
  /** Auction duration in seconds. Default: 7 days */
  duration?: number;
  /** Epoch length in seconds. Default: 3600 (1 hour) */
  epochLength?: number;
  /** Gamma (tick decay per epoch). Auto-calculated if not provided */
  gamma?: number;
  /** Number of price discovery slugs. Default: 5 */
  numPdSlugs?: number;
}

/**
 * Result of market cap parameter validation.
 */
export interface MarketCapValidationResult {
  /** Whether all parameters are within normal bounds */
  valid: boolean;
  /** Warning messages for unusual but technically valid values */
  warnings: string[];
}

// ============================================================================
// Market Cap Helper Function Parameter Types
// ============================================================================

/**
 * Parameters for converting market cap range to ticks for V3 Static Auctions.
 */
export interface StaticAuctionTickParams {
  marketCapRange: MarketCapRange;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting market cap range to ticks for V4 Dynamic Auctions.
 */
export interface DynamicAuctionTickParams {
  marketCapRange: MarketCapRange;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  numeraire: Address;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting market cap range to ticks for V4 Multicurve pools.
 */
export interface MulticurveTickRangeParams {
  marketCapLower: number;
  marketCapUpper: number | 'max';
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting a single market cap to a tick for Multicurve.
 */
export interface MulticurveTickParams {
  marketCapUSD: number;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting a tick to market cap (reverse conversion).
 */
export interface TickToMarketCapParams {
  tick: number;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

// ============================================================================
// New Multicurve Market Cap API (no tick math required)
// ============================================================================

/**
 * Curve configuration for Multicurve pools using market cap ranges.
 * Each curve defines a market cap range and liquidity distribution.
 */
export interface MulticurveMarketCapRangeCurve {
  /** Market cap range for this curve */
  marketCap: {
    /** Start market cap in USD (for the first curve, this is the launch price) */
    start: number;
    /** End market cap in USD, or 'max' for MAX_TICK rounded to tick spacing */
    end: number | 'max';
  };
  /** Number of liquidity positions in this curve */
  numPositions: number;
  /** Share of total supply allocated to this curve (WAD, e.g., parseEther('0.3') = 30%) */
  shares: bigint;
}

/**
 * Market cap-based configuration for Multicurve pools.
 * No tick math required - just specify market caps in USD.
 */
export interface MulticurveMarketCapCurvesConfig {
  /** Price of numeraire in USD (e.g., 3000 for ETH at $3000) */
  numerairePrice: number;
  /**
   * Array of curves defining market cap ranges and liquidity distribution.
   * The first curve's marketCap.start is the launch price.
   * Curves must be contiguous (no gaps allowed).
   */
  curves: MulticurveMarketCapRangeCurve[];
  /** Token supply override */
  tokenSupply?: bigint;
  /** Token decimals (default: 18) */
  tokenDecimals?: number;
  /** Numeraire decimals (default: 18) */
  numeraireDecimals?: number;
  /** Fee tier (default: FEE_TIERS.LOW) */
  fee?: number;
  /** Tick spacing (derived from fee if not provided) */
  tickSpacing?: number;
  /** Optional beneficiaries for fee streaming */
  beneficiaries?: BeneficiaryData[];
}

// Build configuration for static auctions (V3-style)
export interface StaticAuctionBuildConfig {
  // Token details
  name: string;
  symbol: string;
  totalSupply?: bigint; // default: 1 billion
  numTokensToSell?: bigint; // default: 900 million
  tokenURI: string;

  // Time parameters
  startTimeOffset?: number; // Optional - seconds to add to current block timestamp (default: 30)

  // Price parameters - must provide either priceRange or tickRange
  numeraire: Address; // Required for V3
  tickRange?: TickRange;
  priceRange?: PriceRange;
  fee?: number; // default: 10000 (1%)

  // Pool parameters (V3 specific)
  numPositions?: number; // default: 15
  maxShareToBeSold?: bigint; // default: 35% in WAD

  // Vesting parameters
  yearlyMintRate?: bigint; // default: 2%
  vestingDuration?: bigint; // default: 1 year
  recipients?: Address[]; // defaults to [userAddress]
  amounts?: bigint[]; // defaults based on pre-mint calculation

  // Migration configuration
  migration: MigrationConfig;

  // Other parameters
  integrator?: Address;
  useGovernance?: boolean; // default: true
}

// Build configuration for dynamic auctions (V4-style)
export interface DynamicAuctionBuildConfig {
  // Token details
  name: string;
  symbol: string;
  totalSupply: bigint;
  numTokensToSell: bigint;
  tokenURI: string;

  // Time parameters
  startTimeOffset?: number; // Optional - seconds to add to block timestamp (default: 30)
  blockTimestamp?: number; // Optional - specific block timestamp to use (default: fetch latest)
  duration?: number; // in seconds (default: 604800 = 7 days)
  epochLength?: number; // in seconds (default: 3600)

  // Price parameters - must provide either priceRange or tickRange
  numeraire?: Address; // defaults to zero address
  tickRange?: TickRange;
  priceRange?: PriceRange;
  tickSpacing: number;
  gamma?: number; // auto-calculated if not provided
  fee: number; // In basis points

  // Sale parameters
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // default: 5

  // Vesting parameters
  yearlyMintRate?: bigint; // default: 2%
  vestingDuration: bigint;
  recipients: Address[];
  amounts: bigint[];

  // Migration configuration
  migration: MigrationConfig;

  // Other parameters
  integrator?: Address;
  useGovernance?: boolean; // default: true
}

// SDK initialization configuration
export interface DopplerSDKConfig {
  publicClient: SupportedPublicClient;
  walletClient?: WalletClient;
  chainId: number;
}

// Pool information types
export interface PoolInfo {
  address: Address;
  tokenAddress: Address;
  numeraireAddress: Address;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
}

export interface HookInfo {
  hookAddress: Address;
  tokenAddress: Address;
  numeraireAddress: Address;
  poolId: string;
  currentEpoch: number;
  totalProceeds: bigint;
  totalTokensSold: bigint;
  earlyExit: boolean;
  insufficientProceeds: boolean;
  startingTime: bigint;
  endingTime: bigint;
  epochLength: bigint;
  minimumProceeds: bigint;
  maximumProceeds: bigint;
}

export interface OpeningAuctionPosition {
  owner: Address;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  rewardDebtX128: bigint;
  hasClaimedIncentives: boolean;
}

export interface OpeningAuctionState {
  numeraire: Address;
  auctionStartTime: bigint;
  auctionEndTime: bigint;
  auctionTokens: bigint;
  dopplerTokens: bigint;
  status: OpeningAuctionStatus;
  openingAuctionHook: Address;
  dopplerHook: Address;
  openingAuctionPoolKey: V4PoolKey;
  dopplerInitData: `0x${string}`;
  isToken0: boolean;
}

export interface OpeningAuctionCreateResult {
  tokenAddress: Address;
  openingAuctionHookAddress: Address;
  transactionHash: string;
  createParams: CreateParams;
  minedSalt: `0x${string}`;
}

export interface OpeningAuctionCompleteResult {
  asset: Address;
  dopplerHookAddress: Address;
  transactionHash: string;
  dopplerSalt: `0x${string}`;
}

// Quote result type
export interface QuoteResult {
  amountOut: bigint;
  priceImpact: number;
  fee: bigint;
  route: string[];
}

// Lockable Uniswap V3 Initializer encode params
export interface LockableV3InitializerParams {
  fee: number;
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  maxShareToBeSold: bigint;
  beneficiaries: BeneficiaryData[];
}

// Multicurve curve configuration (mirrors solidity struct)
export interface MulticurveCurve {
  tickLower: number; // int24
  tickUpper: number; // int24
  numPositions: number; // uint16
  shares: bigint; // uint256 (WAD)
}

export type MulticurveMarketCapPreset = 'low' | 'medium' | 'high';

export interface V4PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface MulticurveBundleExactOutResult {
  asset: Address;
  poolKey: V4PoolKey;
  amountIn: bigint;
  gasEstimate: bigint;
}

export interface MulticurveBundleExactInResult {
  asset: Address;
  poolKey: V4PoolKey;
  amountOut: bigint;
  gasEstimate: bigint;
}

// RehypeDopplerHook configuration for fee distribution and buyback
export interface RehypeDopplerHookConfig {
  // The hook contract address (must be whitelisted in the initializer)
  hookAddress: Address;
  // Destination address for buyback tokens
  buybackDestination: Address;
  // Custom swap fee in basis points (e.g., 3000 = 0.3%)
  customFee: number;
  // Fee distribution percentages (must sum to 100% / WAD)
  // Percentage of fees used for asset buyback (in WAD, e.g., 0.2e18 = 20%)
  assetBuybackPercentWad: bigint;
  // Percentage of fees used for numeraire buyback (in WAD, e.g., 0.2e18 = 20%)
  numeraireBuybackPercentWad: bigint;
  // Percentage of fees distributed to beneficiaries (in WAD, e.g., 0.3e18 = 30%)
  beneficiaryPercentWad: bigint;
  // Percentage of fees distributed to LPs (in WAD, e.g., 0.3e18 = 30%)
  lpPercentWad: bigint;
  // Optional graduation calldata (called when pool graduates)
  graduationCalldata?: `0x${string}`;

  // Graduation threshold configuration (rehype-only)
  // Market cap in USD at which pool can graduate. Requires numerairePrice (from withCurves() or explicit).
  graduationMarketCap?: number;
  // Price of numeraire in USD. Optional if using withCurves() (reuses that value). Required with poolConfig().
  numerairePrice?: number;
  // Direct tick value for graduation threshold. Use graduationMarketCap for USD-based config.
  farTick?: number;
}

// Create Multicurve initializer parameters
export interface CreateMulticurveParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Pool configuration for multicurve initializer
  pool: {
    fee: number;
    tickSpacing: number;
    curves: MulticurveCurve[];
    // Optional beneficiaries to lock the pool (fee collection only, no migration)
    beneficiaries?: BeneficiaryData[];
  };

  // Optional scheduled launch configuration
  schedule?: {
    startTime: number;
  };

  dopplerHook?: RehypeDopplerHookConfig;

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration
  governance: GovernanceOption<C>;

  // Migration configuration (can be any supported migrator: V2, V3, or V4)
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;

  // Optional transaction gas limit override for the create() transaction
  gas?: bigint;
}

// Final Params object that gets passed as arg to create
export interface CreateParams {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address;
  tokenFactory: Address;
  tokenFactoryData: `0x${string}`;
  governanceFactory: Address;
  governanceFactoryData: `0x${string}`;
  poolInitializer: Address;
  poolInitializerData: `0x${string}`;
  liquidityMigrator: Address;
  liquidityMigratorData: `0x${string}`;
  integrator: Address;
  salt: `0x${string}`;
}

// Optional per-call module address overrides. When provided, these take precedence
// over chain defaults resolved via getAddresses(chainId).
export interface ModuleAddressOverrides {
  // Core deployment & routing
  airlock?: Address;
  tokenFactory?: Address;

  // Initializers
  v3Initializer?: Address;
  lockableV3Initializer?: Address;
  v4Initializer?: Address;
  v4MulticurveInitializer?: Address;
  v4ScheduledMulticurveInitializer?: Address;
  openingAuctionInitializer?: Address;
  openingAuctionPositionManager?: Address;
  dopplerHookInitializer?: Address;

  // DopplerHooks
  rehypeDopplerHook?: Address;

  // Governance
  governanceFactory?: Address;

  // Dynamic auction infra
  poolManager?: Address;
  dopplerDeployer?: Address;

  // Migrators
  v2Migrator?: Address;
  v4Migrator?: Address;
  noOpMigrator?: Address;
}
