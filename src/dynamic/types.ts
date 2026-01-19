/**
 * Types specific to Dynamic Auctions (V4 Dutch auctions).
 */

import type { Address } from 'viem';
import type {
  TokenConfig,
  SaleConfig,
  VestingConfig,
  GovernanceOption,
  MigrationConfig,
  ModuleAddressOverrides,
  MarketCapRange,
} from '../common/types';
import type { SupportedChainId } from '../common/addresses';

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
  tickRange?: { startTick: number; endTick: number };
  priceRange?: { startPrice: number; endPrice: number };
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
