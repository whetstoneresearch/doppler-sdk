import { Address } from 'viem';

// Common constants
export const WAD = 10n ** 18n;
export const DEAD_ADDRESS =
  '0x000000000000000000000000000000000000dEaD' as Address;
export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as Address;

// =============================================================================
// Fee Tiers - V3 vs V4 Distinction
// =============================================================================
//
// Uniswap V3 (Static Auctions): Fees are COUPLED to tick spacings. Only 4 tiers allowed.
// Uniswap V4 (Dynamic/Multicurve): Fees are DECOUPLED. Any fee 0-100,000 is valid.
//
// The standard fee tiers below are recognized by both V3 and V4, but V4 pools
// can use ANY fee value as long as you provide an explicit tickSpacing.

/** Standard fee tiers recognized by both Uniswap V3 and V4 */
export const FEE_TIERS = {
  LOWEST: 100, // 0.01%
  LOW: 500, // 0.05%
  MEDIUM: 3000, // 0.30%
  HIGH: 10000, // 1.00%
} as const;

/** Valid fee tier values (100, 500, 3000, 10000) */
export type FeeTier = (typeof FEE_TIERS)[keyof typeof FEE_TIERS];

/**
 * Standard fee tiers - REQUIRED for V3 (Static Auctions).
 * V4 pools can use custom fees but these are the recommended defaults.
 */
export const VALID_FEE_TIERS: readonly FeeTier[] = [
  100, 500, 3000, 10000,
] as const;

// Tick spacings for different fee tiers (standard Uniswap V3 mapping)
// In V4, tickSpacing is independent of fee - you can use any combination
export const TICK_SPACINGS = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
} as const;

// Time constants
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

// Default values
export const DEFAULT_EPOCH_LENGTH = 43200; // 12 hours in seconds (matching V4 SDK)
export const DEFAULT_AUCTION_DURATION = 7 * SECONDS_PER_DAY; // 7 days
export const DEFAULT_LOCK_DURATION = SECONDS_PER_YEAR; // 1 year
export const DEFAULT_PD_SLUGS = 5; // Default price discovery slugs
export const DAY_SECONDS = SECONDS_PER_DAY; // Alias for consistency

// Default gas limit to fall back on when create() simulations do not return a value
export const DEFAULT_CREATE_GAS_LIMIT = 13_500_000n;

// Price bounds
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO =
  1461446703485210103287273052203988822378723970342n;

// Basis points
export const BASIS_POINTS = 10000;
