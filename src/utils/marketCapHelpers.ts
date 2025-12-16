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
import type { MarketCapRange, MarketCapValidationResult } from '../types'
import { MIN_TICK, MAX_TICK } from './tickMath'
import { isToken0Expected } from './isToken0Expected'

// Re-export types from types.ts for convenience
export type { MarketCapRange, MarketCapValidationResult } from '../types'

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
  // tokenPriceUSD / numerairePriceUSD = numeraire per token
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

/**
 * Complete conversion from market cap to usable tick
 *
 * This is the main entry point combining all conversion steps:
 * 1. Market cap → Token price
 * 2. Token price → Ratio
 * 3. Ratio → Raw tick
 * 4. Raw tick → Nearest usable tick (aligned to spacing)
 * 5. Handle token ordering (negate if token is token1)
 *
 * **Important**: The returned tick includes token ordering adjustment.
 * When the token is token1 (determined from numeraire address), the tick is NEGATED:
 * - Higher market cap → smaller (more negative) tick
 * - Lower market cap → larger (less negative) tick
 *
 * Builders apply additional transformations based on auction type.
 * See builder implementations for auction-specific tick conventions.
 *
 * @param marketCapUSD - Target market cap in USD
 * @param tokenSupply - Total token supply (with decimals, as bigint)
 * @param numerairePriceUSD - Price of numeraire in USD (e.g., ETH = 3000)
 * @param tokenDecimals - Token decimals (default: 18)
 * @param numeraireDecimals - Numeraire decimals (default: 18)
 * @param tickSpacing - Tick spacing of the pool (e.g., 60, 100)
 * @param numeraire - Address of the numeraire token (e.g., WETH). Used to determine token ordering.
 * @returns Nearest usable tick (negated when token is token1)
 *
 * @throws Error if calculated tick is out of bounds [-887272, 887272]
 *
 * @example
 * ```ts
 * // With WETH numeraire on Base:
 * const tick = marketCapToTick(
 *   1_000_000,             // $1M market cap
 *   parseEther('1000000000'), // 1B tokens
 *   3000,                  // ETH = $3000
 *   18, 18,                // both 18 decimals
 *   60,                    // tick spacing
 *   '0x4200000000000000000000000000000000000006' // WETH address
 * )
 * // Returns negative tick (e.g., -149100) because token will be token1
 * ```
 */
export function marketCapToTick(
  marketCapUSD: number,
  tokenSupply: bigint,
  numerairePriceUSD: number,
  tokenDecimals: number = 18,
  numeraireDecimals: number = 18,
  tickSpacing: number,
  numeraire: Address
): number {
  // Determine token ordering from numeraire address
  const tokenIsToken1 = !isToken0Expected(numeraire)

  // Step 1: Market cap → token price
  const tokenPrice = marketCapToTokenPrice(marketCapUSD, tokenSupply, tokenDecimals)

  // Step 2: Token price → ratio
  const ratio = tokenPriceToRatio(
    tokenPrice,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals
  )

  // Step 3: Ratio → raw tick
  const rawTick = ratioToTick(ratio)

  // Step 4: Round to tick spacing using floor division
  let tick = Math.floor(rawTick / tickSpacing) * tickSpacing

  // Step 5: Handle token ordering
  // When token is token1: negate tick (V4 multicurve convention)
  // When token is token0: keep tick as-is
  // Note: V3 static auctions handle this differently and negate at the builder level
  if (tokenIsToken1) {
    tick = -tick
  }

  // Normalize -0 to 0 (JavaScript quirk: -0 !== 0 in Object.is)
  if (tick === 0) tick = 0

  // Step 6: Validate bounds
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error(
      `Calculated tick ${tick} is out of bounds [${MIN_TICK}, ${MAX_TICK}]. ` +
        `Market cap ${marketCapUSD.toLocaleString()} may be too extreme for the given parameters.`
    )
  }

  return tick
}

/**
 * Convert a market cap range to tick range
 *
 * Used for V3 Static Auctions and V4 Dynamic Auctions where you need
 * a start and end tick for the bonding curve.
 *
 * **Important**: This function applies token ordering via marketCapToTick
 * (negates ticks when token is token1), then normalizes so startTick < endTick.
 *
 * Due to the negation + normalization:
 * - When token is token1: both ticks are NEGATIVE
 *   - startTick = more negative (corresponds to LOWER market cap)
 *   - endTick = less negative (corresponds to HIGHER market cap)
 * - When token is token0: both ticks are POSITIVE
 *   - startTick = smaller positive (corresponds to LOWER market cap)
 *   - endTick = larger positive (corresponds to HIGHER market cap)
 *
 * Builders apply additional transformations based on auction type semantics.
 * See builder implementations for auction-specific tick handling.
 *
 * @param marketCapRange - Start and end market caps in USD (start < end required)
 * @param tokenSupply - Total token supply (with decimals)
 * @param numerairePriceUSD - Price of numeraire in USD
 * @param tokenDecimals - Token decimals (default: 18)
 * @param numeraireDecimals - Numeraire decimals (default: 18)
 * @param tickSpacing - Tick spacing
 * @param numeraire - Address of the numeraire token. Used to determine token ordering.
 * @returns Object with startTick and endTick (startTick < endTick numerically)
 *
 * @throws Error if start >= end market cap or if ticks are out of bounds
 *
 * @example
 * ```ts
 * // With WETH numeraire on Base:
 * const { startTick, endTick } = marketCapRangeToTicks(
 *   { start: 500_000, end: 50_000_000 },  // $500k → $50M
 *   parseEther('1000000000'),
 *   3000,
 *   18, 18,
 *   60,
 *   '0x4200000000000000000000000000000000000006' // WETH address
 * )
 * // Returns: startTick=-156080 (500k), endTick=-110020 (50M)
 * // Note: startTick < endTick, but startTick corresponds to LOWER market cap
 * ```
 */
export function marketCapRangeToTicks(
  marketCapRange: MarketCapRange,
  tokenSupply: bigint,
  numerairePriceUSD: number,
  tokenDecimals: number = 18,
  numeraireDecimals: number = 18,
  tickSpacing: number,
  numeraire: Address
): { startTick: number; endTick: number } {
  if (marketCapRange.start <= 0 || marketCapRange.end <= 0) {
    throw new Error('Market cap values must be positive')
  }

  if (marketCapRange.start >= marketCapRange.end) {
    throw new Error('Start market cap must be less than end market cap')
  }

  const tickStart = marketCapToTick(
    marketCapRange.start,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
    numeraire
  )

  const tickEnd = marketCapToTick(
    marketCapRange.end,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
    numeraire
  )

  // Ensure startTick < endTick (Uniswap requirement)
  const startTick = Math.min(tickStart, tickEnd)
  const endTick = Math.max(tickStart, tickEnd)

  if (startTick === endTick) {
    throw new Error(
      `Market cap range ${marketCapRange.start.toLocaleString()} - ${marketCapRange.end.toLocaleString()} ` +
        `resulted in same tick (${startTick}). Try a wider range or smaller tick spacing.`
    )
  }

  return { startTick, endTick }
}

/**
 * Transform ticks from marketCapRangeToTicks format to auction contract format.
 *
 * For range-based auctions (Static V3, Dynamic V4), the contracts expect ticks
 * in a specific format based on token ordering. This function handles the
 * negation and swapping required when the token is token1.
 *
 * @param rawStartTick - Start tick from marketCapRangeToTicks (lower market cap)
 * @param rawEndTick - End tick from marketCapRangeToTicks (higher market cap)
 * @param numeraire - Address of the numeraire token. Used to determine token ordering.
 * @returns Transformed ticks ready for auction contract
 *
 * @example
 * ```ts
 * const { startTick: raw1, endTick: raw2 } = marketCapRangeToTicks(...)
 * const { startTick, endTick } = transformTicksForAuction(raw1, raw2, WETH_ADDRESS)
 * ```
 */
export function transformTicksForAuction(
  rawStartTick: number,
  rawEndTick: number,
  numeraire: Address
): { startTick: number; endTick: number } {
  const tokenIsToken1 = !isToken0Expected(numeraire)

  if (tokenIsToken1) {
    // For token1: negate and swap to satisfy contract requirements
    // Raw ticks are negative, negating makes them positive, swapping maintains startTick < endTick
    return {
      startTick: -rawEndTick,
      endTick: -rawStartTick,
    }
  }

  // For token0: use raw ticks as-is
  return { startTick: rawStartTick, endTick: rawEndTick }
}

/**
 * Apply curvature offsets to a peg tick for Multicurve positions
 *
 * Multicurve positions are defined relative to a "peg" tick (starting market cap).
 * Offsets define how far above/below the peg each curve extends.
 *
 * Token ordering (determined from numeraire address) affects how offsets are applied:
 * - token1: tickLower = pegTick + offsetLower, tickUpper = pegTick + offsetUpper
 * - token0: tickLower = pegTick - offsetUpper, tickUpper = pegTick - offsetLower
 *
 * @param pegTick - Base tick calculated from starting market cap
 * @param offsetLower - Lower offset in ticks (distance from peg)
 * @param offsetUpper - Upper offset in ticks (distance from peg)
 * @param numeraire - Address of the numeraire token. Used to determine token ordering.
 * @returns Tick range with offsets applied
 *
 * @example
 * ```ts
 * // Peg at -200000, curve from peg to 10000 ticks above (WETH numeraire)
 * const { tickLower, tickUpper } = applyTickOffsets(
 *   -200000, 0, 10000,
 *   '0x4200000000000000000000000000000000000006'
 * )
 * // Returns: { tickLower: -200000, tickUpper: -190000 }
 * ```
 */
export function applyTickOffsets(
  pegTick: number,
  offsetLower: number,
  offsetUpper: number,
  numeraire: Address
): { tickLower: number; tickUpper: number } {
  const tokenIsToken1 = !isToken0Expected(numeraire)

  if (tokenIsToken1) {
    // For token1, add offsets directly
    return {
      tickLower: pegTick + offsetLower,
      tickUpper: pegTick + offsetUpper,
    }
  } else {
    // For token0, subtract offsets in reverse order
    return {
      tickLower: pegTick - offsetUpper,
      tickUpper: pegTick - offsetLower,
    }
  }
}

/**
 * Convert a market cap range to tick range for Multicurve curves.
 *
 * Unlike range-based auctions, Multicurve curves use ticks directly without
 * the negate-and-swap transformation. This function converts market cap
 * bounds to the appropriate tick bounds based on token ordering.
 *
 * @param marketCapLower - Lower market cap bound in USD
 * @param marketCapUpper - Upper market cap bound in USD
 * @param tokenSupply - Total token supply (with decimals)
 * @param numerairePriceUSD - Price of numeraire in USD
 * @param tokenDecimals - Token decimals (default: 18)
 * @param numeraireDecimals - Numeraire decimals (default: 18)
 * @param tickSpacing - Tick spacing
 * @param numeraire - Address of the numeraire token
 * @returns Tick range { tickLower, tickUpper } where tickLower < tickUpper
 *
 * @example
 * ```ts
 * const { tickLower, tickUpper } = marketCapRangeToTicksForCurve(
 *   500_000,    // $500k lower
 *   1_000_000,  // $1M upper
 *   parseEther('1000000000'),
 *   3000,
 *   18, 18,
 *   60,
 *   WETH_ADDRESS
 * )
 * ```
 */
export function marketCapRangeToTicksForCurve(
  marketCapLower: number,
  marketCapUpper: number,
  tokenSupply: bigint,
  numerairePriceUSD: number,
  tokenDecimals: number = 18,
  numeraireDecimals: number = 18,
  tickSpacing: number,
  numeraire: Address
): { tickLower: number; tickUpper: number } {
  if (marketCapLower <= 0 || marketCapUpper <= 0) {
    throw new Error('Market cap values must be positive')
  }

  if (marketCapLower >= marketCapUpper) {
    throw new Error('Lower market cap must be less than upper market cap')
  }

  // Get ticks for both bounds
  const tickAtLower = marketCapToTick(
    marketCapLower,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
    numeraire
  )

  const tickAtUpper = marketCapToTick(
    marketCapUpper,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
    numeraire
  )

  // Ensure tickLower < tickUpper (may need to swap depending on token ordering)
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
 *
 * @param tick - Uniswap tick value
 * @param tokenSupply - Total token supply (with decimals)
 * @param numerairePriceUSD - Price of numeraire in USD
 * @param tokenDecimals - Token decimals (default: 18)
 * @param numeraireDecimals - Numeraire decimals (default: 18)
 * @param numeraire - Address of the numeraire token. Used to determine token ordering.
 * @returns Market cap in USD
 *
 * @example
 * ```ts
 * const marketCap = tickToMarketCap(
 *   -192100,
 *   parseEther('1000000000'),
 *   3000,
 *   18, 18,
 *   '0x4200000000000000000000000000000000000006' // WETH address
 * )
 * ```
 */
export function tickToMarketCap(
  tick: number,
  tokenSupply: bigint,
  numerairePriceUSD: number,
  tokenDecimals: number = 18,
  numeraireDecimals: number = 18,
  numeraire: Address
): number {
  const tokenIsToken1 = !isToken0Expected(numeraire)

  // Reverse the token ordering adjustment
  // When token IS token1, the tick was negated, so negate again to reverse
  let adjustedTick = tick
  if (tokenIsToken1) {
    adjustedTick = -tick
  }

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

