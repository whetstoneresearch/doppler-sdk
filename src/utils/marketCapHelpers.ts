/**
 * Market cap conversion utilities for token launches
 *
 * These utilities convert between market cap (USD) and Uniswap ticks
 * following the mathematical relationship:
 *
 *   Market Cap (USD) → Token Price (USD) → Ratio (numeraire/token) → Tick
 *
 * Based on reference implementation: plan/priceMultiCurve.py
 */

import type { Address } from 'viem'
import type {
  MarketCapRange,
  MarketCapValidationResult,
  StaticAuctionTickParams,
  DynamicAuctionTickParams,
  MulticurveTickRangeParams,
  MulticurveTickParams,
  TickToMarketCapParams,
} from '../types'
import { MIN_TICK, MAX_TICK } from './tickMath'
import { isToken0Expected } from './isToken0Expected'

// Re-export types from types.ts for convenience
export type {
  MarketCapRange,
  MarketCapValidationResult,
  StaticAuctionTickParams,
  DynamicAuctionTickParams,
  MulticurveTickRangeParams,
  MulticurveTickParams,
  TickToMarketCapParams,
} from '../types'

/**
 * Convert market cap to token price
 *
 * @param marketCapUSD - Market capitalization in USD
 * @param tokenSupply - Total token supply (as bigint with decimals, e.g., parseEther('1000000000'))
 * @param tokenDecimals - Token decimals (default: 18)
 * @returns Price of one token in USD
 *
 * @example
 * ```ts
 * // $1M market cap with 1B tokens (18 decimals)
 * const price = marketCapToTokenPrice(1_000_000, parseEther('1000000000'))
 * // Returns: 0.001 (each token is worth $0.001)
 * ```
 */
export function marketCapToTokenPrice(
  marketCapUSD: number,
  tokenSupply: bigint,
  tokenDecimals: number = 18
): number {
  if (marketCapUSD <= 0) {
    throw new Error('Market cap must be positive')
  }
  if (tokenSupply <= 0n) {
    throw new Error('Token supply must be positive')
  }

  // Convert supply from bigint with decimals to human-readable number
  const supplyNum = Number(tokenSupply) / 10 ** tokenDecimals
  return marketCapUSD / supplyNum
}

/**
 * Convert token price to price ratio (numeraire per token)
 *
 * @param tokenPriceUSD - Price of one token in USD
 * @param numerairePriceUSD - Price of numeraire (e.g., ETH) in USD
 * @param tokenDecimals - Token decimals (default: 18)
 * @param numeraireDecimals - Numeraire decimals (default: 18)
 * @returns Price ratio adjusted for decimals
 *
 * @example
 * ```ts
 * // Token at $0.001, ETH at $3000, both 18 decimals
 * const ratio = tokenPriceToRatio(0.001, 3000, 18, 18)
 * // Returns: 3,000,000 (3M ETH wei per token wei at this ratio)
 * ```
 */
export function tokenPriceToRatio(
  tokenPriceUSD: number,
  numerairePriceUSD: number,
  tokenDecimals: number = 18,
  numeraireDecimals: number = 18
): number {
  if (tokenPriceUSD <= 0) {
    throw new Error('Token price must be positive')
  }
  if (numerairePriceUSD <= 0) {
    throw new Error('Numeraire price must be positive')
  }

  // How much numeraire per token (in USD terms first)
  // numerairePriceUSD / tokenPriceUSD = numeraire units per token
  const ratio = numerairePriceUSD / tokenPriceUSD

  // Adjust for decimal differences
  // Formula: (numeraire / tokenPrice) * (10 ** (assetDecimals - numeraireDecimals))
  const decimalAdjustment = 10 ** (tokenDecimals - numeraireDecimals)

  return ratio * decimalAdjustment
}

/**
 * Convert ratio to tick using Uniswap's formula: tick = log(ratio) / log(1.0001)
 *
 * @param ratio - Price ratio (must be positive)
 * @returns Raw tick value (before spacing adjustment)
 *
 * @example
 * ```ts
 * ratioToTick(1)       // Returns: 0
 * ratioToTick(1.0001)  // Returns: ~1
 * ratioToTick(Math.pow(1.0001, 1000)) // Returns: ~1000
 * ```
 */
export function ratioToTick(ratio: number): number {
  if (ratio <= 0) {
    throw new Error('Ratio must be positive')
  }

  // Uniswap tick formula: tick = log(price) / log(1.0001)
  return Math.log(ratio) / Math.log(1.0001)
}

/**
 * Determine if the new token will be token1 in the Uniswap pair
 *
 * Uniswap orders tokens by address (token0 < token1 in hex comparison).
 * This affects how ticks are interpreted for price calculations.
 *
 * @param tokenAddress - Address of the new token
 * @param numeraireAddress - Address of the numeraire (e.g., WETH)
 * @returns true if token will be token1, false if token0
 *
 * @example
 * ```ts
 * isToken1('0xB000...', '0xA000...') // true (B > A)
 * isToken1('0xA000...', '0xB000...') // false (A < B)
 * ```
 */
export function isToken1(
  tokenAddress: string,
  numeraireAddress: string
): boolean {
  return tokenAddress.toLowerCase() > numeraireAddress.toLowerCase()
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE TICK COMPUTATION (Internal)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Core tick computation - NO sign manipulation.
 * Returns the raw mathematical tick for a given market cap.
 *
 * @internal Not exported - use auction-specific functions instead.
 */
function _computeRawTick(
  marketCapUSD: number,
  tokenSupply: bigint,
  numerairePriceUSD: number,
  tokenDecimals: number,
  numeraireDecimals: number,
  tickSpacing: number
): number {
  if (marketCapUSD <= 0) {
    throw new Error('Market cap must be positive')
  }

  // Step 1: Market cap → token price
  const tokenPrice = marketCapToTokenPrice(marketCapUSD, tokenSupply, tokenDecimals)

  // Step 2: Token price → ratio
  const ratio = tokenPriceToRatio(tokenPrice, numerairePriceUSD, tokenDecimals, numeraireDecimals)

  // Step 3: Ratio → raw tick
  const rawTick = ratioToTick(ratio)

  // Step 4: Align to tick spacing (floor division)
  const alignedTick = Math.floor(rawTick / tickSpacing) * tickSpacing

  // Step 5: Bounds check
  if (alignedTick < MIN_TICK || alignedTick > MAX_TICK) {
    throw new Error(
      `Calculated tick ${alignedTick} is out of bounds [${MIN_TICK}, ${MAX_TICK}]. ` +
        `Market cap ${marketCapUSD.toLocaleString()} may be too extreme for the given parameters.`
    )
  }

  return alignedTick
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUCTION-SPECIFIC TICK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert market cap range to ticks for V3 Static Auctions.
 *
 * V3 Static auctions ALWAYS use positive ticks with startTick < endTick.
 * This is because CREATE2 mining ensures token address > numeraire (token1).
 *
 * @param params - Configuration object with market cap range and token parameters
 * @returns { startTick, endTick } - positive ticks, startTick < endTick
 *
 * @example
 * ```ts
 * const { startTick, endTick } = marketCapToTicksForStaticAuction({
 *   marketCapRange: { start: 100_000, end: 10_000_000 },
 *   tokenSupply: parseEther('1000000000'),
 *   numerairePriceUSD: 3000,
 *   tickSpacing: 60,
 * })
 * // Returns: { startTick: 120000, endTick: 170000 } (both positive)
 * ```
 */
export function marketCapToTicksForStaticAuction(
  params: StaticAuctionTickParams
): { startTick: number; endTick: number } {
  const {
    marketCapRange,
    tokenSupply,
    numerairePriceUSD,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params

  if (marketCapRange.start <= 0 || marketCapRange.end <= 0) {
    throw new Error('Market cap values must be positive')
  }
  if (marketCapRange.start >= marketCapRange.end) {
    throw new Error('Start market cap must be less than end market cap')
  }

  // Compute raw ticks
  const tickAtStart = _computeRawTick(
    marketCapRange.start,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing
  )
  const tickAtEnd = _computeRawTick(
    marketCapRange.end,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing
  )

  // V3 Static: Always positive ticks, startTick < endTick
  // Take absolute value and ensure proper ordering
  const startTick = Math.min(Math.abs(tickAtStart), Math.abs(tickAtEnd))
  const endTick = Math.max(Math.abs(tickAtStart), Math.abs(tickAtEnd))

  if (startTick === endTick) {
    throw new Error(
      `Market cap range ${marketCapRange.start.toLocaleString()} - ${marketCapRange.end.toLocaleString()} ` +
        `resulted in same tick (${startTick}). Try a wider range or smaller tick spacing.`
    )
  }

  return { startTick, endTick }
}

/**
 * Convert market cap range to ticks for V4 Dynamic Auctions (Doppler).
 *
 * Dynamic auctions compute tick sign based on expected token ordering:
 * - Token1 (ETH numeraire): positive ticks, startTick < endTick
 * - Token0 (stablecoin numeraire): negative ticks, startTick > endTick
 *
 * Unlike Multicurve, Doppler contract does NOT auto-flip ticks.
 *
 * @param params - Configuration object with market cap range and token parameters
 * @returns { startTick, endTick } with correct sign and ordering for Doppler contract
 *
 * @example
 * ```ts
 * // ETH numeraire (token1) - positive ticks
 * const eth = marketCapToTicksForDynamicAuction({
 *   marketCapRange: { start: 50_000, end: 500_000 },
 *   tokenSupply: parseEther('1000000000'),
 *   numerairePriceUSD: 3000,
 *   numeraire: WETH_ADDRESS,
 *   tickSpacing: 30,
 * })
 * // Returns: { startTick: 120000, endTick: 170000 } (positive, ascending)
 *
 * // USDC numeraire (token0) - negative ticks
 * const usdc = marketCapToTicksForDynamicAuction({
 *   marketCapRange: { start: 50_000, end: 500_000 },
 *   tokenSupply: parseEther('1000000000'),
 *   numerairePriceUSD: 1,
 *   numeraire: USDC_ADDRESS,
 *   tickSpacing: 30,
 *   tokenDecimals: 18,
 *   numeraireDecimals: 6,
 * })
 * // Returns: { startTick: -120000, endTick: -170000 } (negative, descending)
 * ```
 */
export function marketCapToTicksForDynamicAuction(
  params: DynamicAuctionTickParams
): { startTick: number; endTick: number } {
  const {
    marketCapRange,
    tokenSupply,
    numerairePriceUSD,
    numeraire,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params

  if (marketCapRange.start <= 0 || marketCapRange.end <= 0) {
    throw new Error('Market cap values must be positive')
  }
  if (marketCapRange.start >= marketCapRange.end) {
    throw new Error('Start market cap must be less than end market cap')
  }

  // Compute raw ticks
  const tickAtStart = _computeRawTick(
    marketCapRange.start,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing
  )
  const tickAtEnd = _computeRawTick(
    marketCapRange.end,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing
  )

  // Determine token ordering from numeraire address
  const tokenIsToken0 = isToken0Expected(numeraire)

  if (tokenIsToken0) {
    // Token0 (stablecoin numeraire): negative ticks, startTick > endTick
    const startTick = -Math.min(Math.abs(tickAtStart), Math.abs(tickAtEnd))
    const endTick = -Math.max(Math.abs(tickAtStart), Math.abs(tickAtEnd))

    if (startTick === endTick) {
      throw new Error(
        `Market cap range resulted in same tick (${startTick}). Try a wider range.`
      )
    }

    return { startTick, endTick } // e.g., { -120000, -170000 }
  } else {
    // Token1 (ETH numeraire): positive ticks, startTick < endTick
    const startTick = Math.min(Math.abs(tickAtStart), Math.abs(tickAtEnd))
    const endTick = Math.max(Math.abs(tickAtStart), Math.abs(tickAtEnd))

    if (startTick === endTick) {
      throw new Error(
        `Market cap range resulted in same tick (${startTick}). Try a wider range.`
      )
    }

    return { startTick, endTick } // e.g., { 120000, 170000 }
  }
}

/**
 * Convert market cap range to ticks for V4 Multicurve pools.
 *
 * Tick sign depends on the underlying price ratio - can be positive or negative.
 * The contract's adjustCurves() handles token ordering internally.
 *
 * @param params - Configuration object with market cap range and token parameters
 * @returns { tickLower, tickUpper } - tick range where tickLower < tickUpper
 *
 * @example
 * ```ts
 * const { tickLower, tickUpper } = marketCapToTicksForMulticurve({
 *   marketCapLower: 500_000,
 *   marketCapUpper: 5_000_000,
 *   tokenSupply: parseEther('1000000000'),
 *   numerairePriceUSD: 3000,
 *   tickSpacing: 60,
 * })
 * ```
 */
export function marketCapToTicksForMulticurve(
  params: MulticurveTickRangeParams
): { tickLower: number; tickUpper: number } {
  const {
    marketCapLower,
    marketCapUpper,
    tokenSupply,
    numerairePriceUSD,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params

  if (marketCapLower <= 0 || marketCapUpper <= 0) {
    throw new Error('Market cap values must be positive')
  }
  if (marketCapLower >= marketCapUpper) {
    throw new Error('Lower market cap must be less than upper market cap')
  }

  // Compute raw ticks
  const tickAtLower = _computeRawTick(
    marketCapLower,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing
  )
  const tickAtUpper = _computeRawTick(
    marketCapUpper,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing
  )

  // Use natural tick ordering (lower market cap = lower tick value)
  const tickLower = Math.min(tickAtLower, tickAtUpper)
  const tickUpper = Math.max(tickAtLower, tickAtUpper)

  if (tickLower === tickUpper) {
    throw new Error(
      `Market cap range $${marketCapLower.toLocaleString()} - $${marketCapUpper.toLocaleString()} ` +
        `resulted in same tick (${tickLower}). Try a wider range or smaller tick spacing.`
    )
  }

  return { tickLower, tickUpper }
}

/**
 * Convert a single market cap to a tick for Multicurve use cases.
 *
 * Used for farTick and pegTick calculations.
 * Tick sign depends on the underlying price ratio - can be positive or negative.
 *
 * @param params - Configuration object with market cap and token parameters
 * @returns Tick value (sign depends on price ratio)
 *
 * @example
 * ```ts
 * const farTick = marketCapToTickForMulticurve({
 *   marketCapUSD: 50_000_000,
 *   tokenSupply: supply,
 *   numerairePriceUSD: 3000,
 *   tickSpacing: 60,
 * })
 * ```
 */
export function marketCapToTickForMulticurve(
  params: MulticurveTickParams
): number {
  const {
    marketCapUSD,
    tokenSupply,
    numerairePriceUSD,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params

  const rawTick = _computeRawTick(
    marketCapUSD,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing
  )

  // Normalize -0 to 0
  return rawTick === 0 ? 0 : rawTick
}

// OLD FUNCTIONS REMOVED - use auction-specific functions above:
// - marketCapToTicksForStaticAuction() for V3 Static
// - marketCapToTicksForDynamicAuction() for V4 Dynamic
// - marketCapToTicksForMulticurve() for V4 Multicurve
// - marketCapToTickForMulticurve() for single tick (farTick, pegTick)

/**
 * Apply curvature offsets to a peg tick for Multicurve positions.
 *
 * Tick sign depends on the underlying price ratio - can be positive or negative.
 * The contract's adjustCurves() handles token ordering internally.
 *
 * @example
 * ```ts
 * // Peg at 200000, curve extends 10000 ticks toward higher market cap
 * applyTickOffsets(200000, 0, 10000, WETH)
 * // Returns: { tickLower: 200000, tickUpper: 210000 }
 * ```
 */
export function applyTickOffsets(
  pegTick: number,
  offsetLower: number,
  offsetUpper: number,
  numeraire: Address
): { tickLower: number; tickUpper: number } {
  void numeraire // Kept for API compatibility
  return {
    tickLower: pegTick + offsetLower,
    tickUpper: pegTick + offsetUpper,
  }
}


/**
 * Validate market cap parameters and return warnings for unusual values
 *
 * This doesn't prevent execution but helps catch potential mistakes:
 * - Very small market caps (< $1,000)
 * - Very large market caps (> $1 trillion)
 * - Extreme token prices (< $0.000001 or > $1M)
 *
 * @param marketCap - Market cap value to validate
 * @param tokenSupply - Token supply (with decimals)
 * @param tokenDecimals - Token decimals (default: 18)
 * @returns Validation result with warnings array
 *
 * @example
 * ```ts
 * const result = validateMarketCapParameters(500, parseEther('1000000'))
 * if (result.warnings.length > 0) {
 *   console.warn('Warnings:', result.warnings)
 * }
 * ```
 */
export function validateMarketCapParameters(
  marketCap: number,
  tokenSupply: bigint,
  tokenDecimals: number = 18
): MarketCapValidationResult {
  const warnings: string[] = []

  // Check for unreasonably small market caps
  if (marketCap < 1000) {
    warnings.push(
      `Market cap $${marketCap.toLocaleString()} is very small. Consider if this is intentional.`
    )
  }

  // Check for unreasonably large market caps
  if (marketCap > 1_000_000_000_000) {
    warnings.push(
      `Market cap $${marketCap.toLocaleString()} is very large (> $1T). Verify this is correct.`
    )
  }

  // Calculate implied token price
  const tokenPrice = marketCapToTokenPrice(marketCap, tokenSupply, tokenDecimals)

  // Check for extremely small token prices
  if (tokenPrice < 0.000001) {
    warnings.push(
      `Implied token price $${tokenPrice.toExponential(2)} is very small. ` +
        `This may cause precision issues.`
    )
  }

  // Check for extremely large token prices
  if (tokenPrice > 1_000_000) {
    warnings.push(
      `Implied token price $${tokenPrice.toLocaleString()} is very large. ` +
        `Verify your token supply and market cap values.`
    )
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}

/**
 * Calculate market cap from a tick (reverse conversion)
 *
 * Useful for displaying what market cap a given tick represents.
 * Works with ticks from any auction type (Static, Dynamic, Multicurve).
 *
 * @param params - Configuration object with tick and token parameters
 * @returns Market cap in USD
 *
 * @example
 * ```ts
 * // Works with negative ticks (Multicurve)
 * tickToMarketCap({
 *   tick: -156000,
 *   tokenSupply: supply,
 *   numerairePriceUSD: 3000,
 * })
 *
 * // Works with positive ticks (Static/Dynamic)
 * tickToMarketCap({
 *   tick: 156000,
 *   tokenSupply: supply,
 *   numerairePriceUSD: 3000,
 * })
 * ```
 */
export function tickToMarketCap(
  params: TickToMarketCapParams
): number {
  const {
    tick,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params

  // Use absolute value since tick sign varies by auction type
  // but the underlying ratio is always positive
  const adjustedTick = Math.abs(tick)

  // Tick → ratio (reverse of ratioToTick)
  const ratio = Math.pow(1.0001, adjustedTick)

  // Ratio → token price (reverse of tokenPriceToRatio)
  // ratio = (numerairePriceUSD / tokenPriceUSD) * 10^(tokenDecimals - numeraireDecimals)
  // tokenPriceUSD = numerairePriceUSD / (ratio / decimalAdjustment)
  const decimalAdjustment = 10 ** (tokenDecimals - numeraireDecimals)
  const tokenPriceUSD = numerairePriceUSD / (ratio / decimalAdjustment)

  // Token price → market cap (reverse of marketCapToTokenPrice)
  const supplyNum = Number(tokenSupply) / 10 ** tokenDecimals
  return tokenPriceUSD * supplyNum
}
