/**
 * Market cap conversion utilities for V3 Static Auctions.
 */

import type { MarketCapValidationResult, MarketCapRange } from '../../common/types';
import type { StaticAuctionTickParams } from '../types';
import { MIN_TICK, MAX_TICK } from '../../common/utils/tickMath';

/**
 * Convert market cap to token price
 *
 * @param marketCapUSD - Market capitalization in USD
 * @param tokenSupply - Total token supply (as bigint with decimals, e.g., parseEther('1000000000'))
 * @param tokenDecimals - Token decimals (default: 18)
 * @returns Price of one token in USD
 */
export function marketCapToTokenPrice(
  marketCapUSD: number,
  tokenSupply: bigint,
  tokenDecimals: number = 18,
): number {
  if (marketCapUSD <= 0) {
    throw new Error('Market cap must be positive');
  }
  if (tokenSupply <= 0n) {
    throw new Error('Token supply must be positive');
  }

  // Convert supply from bigint with decimals to human-readable number
  const supplyNum = Number(tokenSupply) / 10 ** tokenDecimals;
  return marketCapUSD / supplyNum;
}

/**
 * Convert token price to price ratio (numeraire per token)
 *
 * @param tokenPriceUSD - Price of one token in USD
 * @param numerairePriceUSD - Price of numeraire (e.g., ETH) in USD
 * @param tokenDecimals - Token decimals (default: 18)
 * @param numeraireDecimals - Numeraire decimals (default: 18)
 * @returns Price ratio adjusted for decimals
 */
export function tokenPriceToRatio(
  tokenPriceUSD: number,
  numerairePriceUSD: number,
  tokenDecimals: number = 18,
  numeraireDecimals: number = 18,
): number {
  if (tokenPriceUSD <= 0) {
    throw new Error('Token price must be positive');
  }
  if (numerairePriceUSD <= 0) {
    throw new Error('Numeraire price must be positive');
  }

  // How much numeraire per token (in USD terms first)
  const ratio = numerairePriceUSD / tokenPriceUSD;

  // Adjust for decimal differences
  const decimalAdjustment = 10 ** (tokenDecimals - numeraireDecimals);

  return ratio * decimalAdjustment;
}

/**
 * Convert ratio to tick using Uniswap's formula: tick = log(ratio) / log(1.0001)
 *
 * @param ratio - Price ratio (must be positive)
 * @returns Raw tick value (before spacing adjustment)
 */
export function ratioToTick(ratio: number): number {
  if (ratio <= 0) {
    throw new Error('Ratio must be positive');
  }

  // Uniswap tick formula: tick = log(price) / log(1.0001)
  return Math.log(ratio) / Math.log(1.0001);
}

/**
 * Core tick computation - NO sign manipulation.
 * Returns the raw mathematical tick for a given market cap.
 *
 * @internal
 */
function _computeRawTick(
  marketCapUSD: number,
  tokenSupply: bigint,
  numerairePriceUSD: number,
  tokenDecimals: number,
  numeraireDecimals: number,
  tickSpacing: number,
): number {
  if (marketCapUSD <= 0) {
    throw new Error('Market cap must be positive');
  }

  // Step 1: Market cap → token price
  const tokenPrice = marketCapToTokenPrice(
    marketCapUSD,
    tokenSupply,
    tokenDecimals,
  );

  // Step 2: Token price → ratio
  const ratio = tokenPriceToRatio(
    tokenPrice,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
  );

  // Step 3: Ratio → raw tick
  const rawTick = ratioToTick(ratio);

  // Step 4: Align to tick spacing (floor division)
  const alignedTick = Math.floor(rawTick / tickSpacing) * tickSpacing;

  // Step 5: Bounds check
  if (alignedTick < MIN_TICK || alignedTick > MAX_TICK) {
    throw new Error(
      `Calculated tick ${alignedTick} is out of bounds [${MIN_TICK}, ${MAX_TICK}]. ` +
        `Market cap ${marketCapUSD.toLocaleString()} may be too extreme for the given parameters.`,
    );
  }

  return alignedTick;
}

/**
 * Convert market cap range to ticks for V3 Static Auctions.
 *
 * V3 Static auctions ALWAYS use positive ticks with startTick < endTick.
 * This is because CREATE2 mining ensures token address > numeraire (token1).
 *
 * @param params - Configuration object with market cap range and token parameters
 * @returns { startTick, endTick } - positive ticks, startTick < endTick
 */
export function marketCapToTicksForStaticAuction(
  params: StaticAuctionTickParams,
): { startTick: number; endTick: number } {
  const {
    marketCapRange,
    tokenSupply,
    numerairePriceUSD,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params;

  if (marketCapRange.start <= 0) {
    throw new Error('Start market cap must be positive');
  }
  if (marketCapRange.end <= 0) {
    throw new Error('End market cap must be positive');
  }
  if (marketCapRange.start >= marketCapRange.end) {
    throw new Error('Start market cap must be less than end market cap');
  }

  // Compute raw ticks
  const tickAtStart = _computeRawTick(
    marketCapRange.start,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
  );
  const tickAtEnd = _computeRawTick(
    marketCapRange.end,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
  );

  // V3 Static: Always positive ticks, startTick < endTick
  // Take absolute value and ensure proper ordering
  const startTick = Math.min(Math.abs(tickAtStart), Math.abs(tickAtEnd));
  const endTick = Math.max(Math.abs(tickAtStart), Math.abs(tickAtEnd));

  if (startTick === endTick) {
    throw new Error(
      `Market cap range ${marketCapRange.start.toLocaleString()} - ${marketCapRange.end.toLocaleString()} ` +
        `resulted in same tick (${startTick}). Try a wider range or smaller tick spacing.`,
    );
  }

  return { startTick, endTick };
}

/**
 * Validate market cap parameters and return warnings for unusual values
 *
 * @param marketCap - Market cap value to validate
 * @param tokenSupply - Token supply (with decimals)
 * @param tokenDecimals - Token decimals (default: 18)
 * @returns Validation result with warnings array
 */
export function validateMarketCapParameters(
  marketCap: number,
  tokenSupply: bigint,
  tokenDecimals: number = 18,
): MarketCapValidationResult {
  const warnings: string[] = [];

  // Check for unreasonably small market caps
  if (marketCap < 1000) {
    warnings.push(
      `Market cap $${marketCap.toLocaleString()} is very small. Consider if this is intentional.`,
    );
  }

  // Check for unreasonably large market caps
  if (marketCap > 1_000_000_000_000) {
    warnings.push(
      `Market cap $${marketCap.toLocaleString()} is very large (> $1T). Verify this is correct.`,
    );
  }

  // Calculate implied token price
  const tokenPrice = marketCapToTokenPrice(
    marketCap,
    tokenSupply,
    tokenDecimals,
  );

  // Check for extremely small token prices
  if (tokenPrice < 0.000001) {
    warnings.push(
      `Implied token price $${tokenPrice.toExponential(2)} is very small. ` +
        `This may cause precision issues.`,
    );
  }

  // Check for extremely large token prices
  if (tokenPrice > 1_000_000) {
    warnings.push(
      `Implied token price $${tokenPrice.toLocaleString()} is very large. ` +
        `Verify your token supply and market cap values.`,
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// Re-export types for convenience
export type { StaticAuctionTickParams } from '../types';
export type { MarketCapRange, MarketCapValidationResult } from '../../common/types';
