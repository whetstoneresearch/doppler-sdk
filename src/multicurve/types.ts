/**
 * Types specific to Multicurve pools (V4 static multi-position).
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
} from '../common/types';
import type { SupportedChainId } from '../common/addresses';
import type { V4PoolKey } from '../internal/v4-shared/types';
import type { LockablePoolStatus } from '../static/types';

// Multicurve curve configuration (mirrors solidity struct)
export interface MulticurveCurve {
  tickLower: number; // int24
  tickUpper: number; // int24
  numPositions: number; // uint16
  shares: bigint; // uint256 (WAD)
}

export type MulticurveMarketCapPreset = 'low' | 'medium' | 'high';

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

// ============================================================================
// Market Cap Configuration Types for Multicurve
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
// Market Cap Preset Types
// ============================================================================

/**
 * Configuration for a single market cap preset curve.
 */
export type MarketCapPresetConfig = {
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  shares: bigint;
};

/**
 * Partial overrides for market cap preset configurations.
 * Allows customizing specific parameters while keeping preset defaults.
 */
export type MarketCapPresetOverrides = Partial<
  Record<
    MulticurveMarketCapPreset,
    {
      tickLower?: number;
      tickUpper?: number;
      numPositions?: number;
      shares?: bigint;
    }
  >
>;
