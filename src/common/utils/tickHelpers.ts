/**
 * Tick calculation utilities for auction builders.
 */

import type { PriceRange, TickRange } from '../types';

/**
 * Convert a price range to ticks, rounding to the nearest valid tick spacing.
 *
 * @param priceRange - The start and end prices
 * @param tickSpacing - The tick spacing for the pool
 * @returns The computed tick range
 */
export function computeTicks(
  priceRange: PriceRange,
  tickSpacing: number,
): TickRange {
  const startTick =
    Math.floor(
      Math.log(priceRange.startPrice) / Math.log(1.0001) / tickSpacing,
    ) * tickSpacing;
  const endTick =
    Math.ceil(Math.log(priceRange.endPrice) / Math.log(1.0001) / tickSpacing) *
    tickSpacing;
  return { startTick, endTick };
}
