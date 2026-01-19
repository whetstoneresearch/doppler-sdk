/**
 * Market cap conversion utilities shared by V4 modules (dynamic and multicurve).
 * NOT exported directly - used internally by dynamic/ and multicurve/.
 */

import type { Address } from 'viem';
import type { MarketCapRange } from '../../common/types';
import { MIN_TICK, MAX_TICK } from '../../common/utils/tickMath';

/**
 * Convert market cap to token price
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

  const supplyNum = Number(tokenSupply) / 10 ** tokenDecimals;
  return marketCapUSD / supplyNum;
}

/**
 * Convert token price to price ratio (numeraire per token)
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

  const ratio = numerairePriceUSD / tokenPriceUSD;
  const decimalAdjustment = 10 ** (tokenDecimals - numeraireDecimals);
  return ratio * decimalAdjustment;
}

/**
 * Convert ratio to tick
 */
export function ratioToTick(ratio: number): number {
  if (ratio <= 0) {
    throw new Error('Ratio must be positive');
  }
  return Math.log(ratio) / Math.log(1.0001);
}

/**
 * Determine if the new token will be token1 in the Uniswap pair
 */
export function isToken1(
  tokenAddress: string,
  numeraireAddress: string,
): boolean {
  return tokenAddress.toLowerCase() > numeraireAddress.toLowerCase();
}

/**
 * Determine token ordering based on numeraire address.
 */
export function isToken0Expected(numeraire: Address): boolean {
  const numeraireBigInt = BigInt(numeraire);
  const halfMaxUint160 = 2n ** 159n - 1n;

  if (numeraireBigInt === 0n) {
    return false; // ETH paired, token will be > 0x0
  } else if (numeraireBigInt > halfMaxUint160) {
    return true; // Large numeraire, token will be < numeraire
  } else {
    return false; // Normal case, token will be > numeraire
  }
}

export function getMaxTickRounded(tickSpacing: number): number {
  return Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
}

/**
 * Core tick computation - NO sign manipulation.
 * @internal
 */
export function computeRawTick(
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

  const tokenPrice = marketCapToTokenPrice(
    marketCapUSD,
    tokenSupply,
    tokenDecimals,
  );

  const ratio = tokenPriceToRatio(
    tokenPrice,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
  );

  const rawTick = ratioToTick(ratio);
  const alignedTick = Math.floor(rawTick / tickSpacing) * tickSpacing;

  if (alignedTick < MIN_TICK || alignedTick > MAX_TICK) {
    throw new Error(
      `Calculated tick ${alignedTick} is out of bounds [${MIN_TICK}, ${MAX_TICK}]. ` +
        `Market cap ${marketCapUSD.toLocaleString()} may be too extreme for the given parameters.`,
    );
  }

  return alignedTick;
}

/**
 * Convert market cap range to ticks for V4 Dynamic Auctions (Doppler).
 */
export function marketCapToTicksForDynamicAuction(params: {
  marketCapRange: MarketCapRange;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  numeraire: Address;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}): { startTick: number; endTick: number } {
  const {
    marketCapRange,
    tokenSupply,
    numerairePriceUSD,
    numeraire,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params;

  if (marketCapRange.start <= 0 || marketCapRange.end <= 0) {
    throw new Error('Market cap values must be positive');
  }
  if (marketCapRange.start >= marketCapRange.end) {
    throw new Error('Start market cap must be less than end market cap');
  }

  const tickAtStart = computeRawTick(
    marketCapRange.start,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
  );
  const tickAtEnd = computeRawTick(
    marketCapRange.end,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
  );

  const tokenIsToken0 = isToken0Expected(numeraire);

  if (tokenIsToken0) {
    const startTick = -Math.min(Math.abs(tickAtStart), Math.abs(tickAtEnd));
    const endTick = -Math.max(Math.abs(tickAtStart), Math.abs(tickAtEnd));

    if (startTick === endTick) {
      throw new Error(
        `Market cap range resulted in same tick (${startTick}). Try a wider range.`,
      );
    }

    return { startTick, endTick };
  } else {
    const startTick = Math.min(Math.abs(tickAtStart), Math.abs(tickAtEnd));
    const endTick = Math.max(Math.abs(tickAtStart), Math.abs(tickAtEnd));

    if (startTick === endTick) {
      throw new Error(
        `Market cap range resulted in same tick (${startTick}). Try a wider range.`,
      );
    }

    return { startTick, endTick };
  }
}

/**
 * Convert market cap range to ticks for V4 Multicurve pools.
 */
export function marketCapToTicksForMulticurve(params: {
  marketCapLower: number;
  marketCapUpper: number | 'max';
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}): { tickLower: number; tickUpper: number } {
  const {
    marketCapLower,
    marketCapUpper,
    tokenSupply,
    numerairePriceUSD,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params;

  if (marketCapLower <= 0) {
    throw new Error('Lower market cap must be positive');
  }
  if (marketCapUpper !== 'max' && marketCapUpper <= 0) {
    throw new Error('Upper market cap must be positive');
  }
  if (marketCapUpper !== 'max' && marketCapLower >= marketCapUpper) {
    throw new Error('Lower market cap must be less than upper market cap');
  }

  const tickAtLower = -computeRawTick(
    marketCapLower,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
  );
  const tickAtUpper = marketCapUpper === 'max'
    ? getMaxTickRounded(tickSpacing)
    : -computeRawTick(
        marketCapUpper,
        tokenSupply,
        numerairePriceUSD,
        tokenDecimals,
        numeraireDecimals,
        tickSpacing,
      );

  const tickLower = Math.min(tickAtLower, tickAtUpper);
  const tickUpper = Math.max(tickAtLower, tickAtUpper);

  if (tickLower === tickUpper) {
    const upperLabel = marketCapUpper === 'max' ? 'max' : `$${marketCapUpper.toLocaleString()}`;
    throw new Error(
      `Market cap range $${marketCapLower.toLocaleString()} - ${upperLabel} ` +
        `resulted in same tick (${tickLower}). Try a wider range or smaller tick spacing.`,
    );
  }

  return { tickLower, tickUpper };
}

/**
 * Convert a single market cap to a tick for Multicurve use cases.
 */
export function marketCapToTickForMulticurve(params: {
  marketCapUSD: number;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}): number {
  const {
    marketCapUSD,
    tokenSupply,
    numerairePriceUSD,
    tickSpacing,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params;

  const rawTick = -computeRawTick(
    marketCapUSD,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals,
    numeraireDecimals,
    tickSpacing,
  );

  return rawTick === 0 ? 0 : rawTick;
}

/**
 * Calculate market cap from a tick (reverse conversion)
 */
export function tickToMarketCap(params: {
  tick: number;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}): number {
  const {
    tick,
    tokenSupply,
    numerairePriceUSD,
    tokenDecimals = 18,
    numeraireDecimals = 18,
  } = params;

  const adjustedTick = Math.abs(tick);
  const ratio = Math.pow(1.0001, adjustedTick);
  const decimalAdjustment = 10 ** (tokenDecimals - numeraireDecimals);
  const tokenPriceUSD = numerairePriceUSD / (ratio / decimalAdjustment);
  const supplyNum = Number(tokenSupply) / 10 ** tokenDecimals;
  return tokenPriceUSD * supplyNum;
}

/**
 * Apply curvature offsets to a peg tick for Multicurve positions.
 */
export function applyTickOffsets(
  pegTick: number,
  offsetLower: number,
  offsetUpper: number,
  numeraire: Address,
): { tickLower: number; tickUpper: number } {
  void numeraire;
  return {
    tickLower: pegTick + offsetLower,
    tickUpper: pegTick + offsetUpper,
  };
}
