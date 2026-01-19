/**
 * Types specific to Static Auctions (V3-style).
 */

import type { Address } from 'viem';
import type {
  TokenConfig,
  SaleConfig,
  VestingConfig,
  GovernanceOption,
  MigrationConfig,
  ModuleAddressOverrides,
  BeneficiaryData,
  MarketCapRange,
  MarketCapConfig,
} from '../common/types';
import type { SupportedChainId } from '../common/addresses';

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

// Lockable Uniswap V3 Initializer encode params
export interface LockableV3InitializerParams {
  fee: number;
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  maxShareToBeSold: bigint;
  beneficiaries: BeneficiaryData[];
}

// Pool status for lockable initializer
export enum LockablePoolStatus {
  Uninitialized = 0,
  Initialized = 1,
  Locked = 2,
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
  tickRange?: { startTick: number; endTick: number };
  priceRange?: { startPrice: number; endPrice: number };
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
