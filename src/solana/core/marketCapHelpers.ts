/**
 * Market cap conversion utilities for Solana token launches.
 *
 * Converts between human-readable market cap values (USD) and the raw
 * curve parameters used by the initializer program.
 *
 * For an XYK bonding curve the marginal spot price at any point is:
 *
 *   spotPrice (quote/base, raw units) = (quoteReserve + curveVirtualQuote)
 *                                     / (baseReserve  + curveVirtualBase)
 *
 * At launch open (quoteReserve = 0, baseReserve = baseForCurve):
 *
 *   spotPrice = curveVirtualQuote / (baseForCurve + curveVirtualBase)
 *
 * Adjusted for decimals and numeraire price:
 *
 *   spotPriceUSD = spotPrice * 10^(baseDecimals - quoteDecimals) * numerairePriceUSD
 *
 * Market cap (FDV) is then:
 *
 *   marketCap = spotPriceUSD * (baseTotalSupply / 10^baseDecimals)
 */

import type {
  MarketCapValidationResult,
  CurveParams,
  MarketCapToCurveParamsInput,
  CurveParamsToMarketCapInput,
} from './types.js';

export type {
  MarketCapValidationResult,
  CurveParams,
  MarketCapToCurveParamsInput,
  CurveParamsToMarketCapInput,
};

// ============================================================================
// Primitive helpers
// ============================================================================

/**
 * Convert a market cap (USD) and total supply to a per-token price (USD).
 *
 * @example
 * // $1M market cap, 1B tokens with 6 decimals
 * marketCapToTokenPrice(1_000_000, 1_000_000_000n * 10n**6n, 6)
 * // => 0.001
 */
export function marketCapToTokenPrice(
  marketCapUSD: number,
  baseTotalSupply: bigint,
  baseDecimals: number,
): number {
  if (marketCapUSD <= 0) {
    throw new Error('Market cap must be positive');
  }
  if (baseTotalSupply <= 0n) {
    throw new Error('Token supply must be positive');
  }

  const supplyNum = Number(baseTotalSupply) / 10 ** baseDecimals;
  return marketCapUSD / supplyNum;
}

/**
 * Validate market cap parameters and return warnings for unusual values.
 * Does not throw — callers can decide whether to surface warnings to users.
 *
 * @example
 * const { valid, warnings } = validateMarketCapParameters(500, supply, 6);
 * if (!valid) console.warn(warnings);
 */
export function validateMarketCapParameters(
  marketCapUSD: number,
  baseTotalSupply: bigint,
  baseDecimals: number,
): MarketCapValidationResult {
  const warnings: string[] = [];

  if (marketCapUSD < 1_000) {
    warnings.push(
      `Market cap $${marketCapUSD.toLocaleString()} is very small. Verify this is intentional.`,
    );
  }

  if (marketCapUSD > 1_000_000_000_000) {
    warnings.push(
      `Market cap $${marketCapUSD.toLocaleString()} exceeds $1T. Verify this is correct.`,
    );
  }

  const tokenPriceUSD = marketCapToTokenPrice(
    marketCapUSD,
    baseTotalSupply,
    baseDecimals,
  );

  if (tokenPriceUSD < 0.000_001) {
    warnings.push(
      `Implied token price $${tokenPriceUSD.toExponential(2)} is very small. This may cause precision issues.`,
    );
  }

  if (tokenPriceUSD > 1_000_000) {
    warnings.push(
      `Implied token price $${tokenPriceUSD.toLocaleString()} is very large. Verify token supply and market cap.`,
    );
  }

  return { valid: warnings.length === 0, warnings };
}

// ============================================================================
// Market cap ↔ curve virtual reserves
// ============================================================================

/**
 * Convert a market cap range (USD) to XYK curve virtual reserve parameters.
 *
 * Returns `{ curveVirtualBase, curveVirtualQuote }` for both the start (open)
 * and end (graduation) prices, ready to pass into `InitializeLaunchArgs`.
 *
 * `baseForCurve` is the number of base tokens allocated to the curve vault
 * (baseTotalSupply - baseForDistribution - baseForLiquidity). It determines
 * the correct initial spot price alongside the virtual reserves.
 *
 * `virtualBase` defaults to `baseForCurve`. A larger value gives finer price
 * granularity at the cost of a proportionally larger `curveVirtualQuote`.
 *
 * @example
 * const totalSupply = 1_000_000_000n * 10n ** 6n;
 * const { start, end } = marketCapToCurveParams({
 *   startMarketCapUSD: 100_000,
 *   endMarketCapUSD:   5_000_000,
 *   baseTotalSupply:   totalSupply,
 *   baseForCurve:      totalSupply,   // no distribution or liquidity allocation
 *   baseDecimals:      6,
 *   quoteDecimals:     9,             // SOL
 *   numerairePriceUSD: 150,
 * });
 * // Use start.curveVirtualBase / start.curveVirtualQuote in InitializeLaunchArgs
 */
export function marketCapToCurveParams(input: MarketCapToCurveParamsInput): {
  start: CurveParams;
  end: CurveParams;
} {
  const {
    startMarketCapUSD,
    endMarketCapUSD,
    baseTotalSupply,
    baseForCurve,
    baseDecimals,
    quoteDecimals,
    numerairePriceUSD,
    virtualBase,
  } = input;

  if (startMarketCapUSD <= 0)
    throw new Error('startMarketCapUSD must be positive');
  if (endMarketCapUSD <= 0) throw new Error('endMarketCapUSD must be positive');
  if (startMarketCapUSD >= endMarketCapUSD) {
    throw new Error('startMarketCapUSD must be less than endMarketCapUSD');
  }
  if (baseForCurve <= 0n) throw new Error('baseForCurve must be positive');
  if (baseForCurve > baseTotalSupply)
    throw new Error('baseForCurve cannot exceed baseTotalSupply');
  if (numerairePriceUSD <= 0)
    throw new Error('numerairePriceUSD must be positive');

  const canonicalVirtualBase =
    virtualBase !== undefined && virtualBase > 0n ? virtualBase : baseForCurve;

  return {
    start: _marketCapToCurveParams(
      startMarketCapUSD,
      baseTotalSupply,
      baseForCurve,
      baseDecimals,
      quoteDecimals,
      numerairePriceUSD,
      canonicalVirtualBase,
    ),
    end: _marketCapToCurveParams(
      endMarketCapUSD,
      baseTotalSupply,
      baseForCurve,
      baseDecimals,
      quoteDecimals,
      numerairePriceUSD,
      canonicalVirtualBase,
    ),
  };
}

/**
 * Convert a single market cap (USD) to XYK curve virtual reserve parameters.
 * Use `marketCapToCurveParams` for a full start/end range.
 */
export function marketCapToSingleCurveParams(
  marketCapUSD: number,
  baseTotalSupply: bigint,
  baseForCurve: bigint,
  baseDecimals: number,
  quoteDecimals: number,
  numerairePriceUSD: number,
  virtualBase?: bigint,
): CurveParams {
  if (marketCapUSD <= 0) throw new Error('marketCapUSD must be positive');
  if (baseForCurve <= 0n) throw new Error('baseForCurve must be positive');
  if (baseForCurve > baseTotalSupply)
    throw new Error('baseForCurve cannot exceed baseTotalSupply');
  if (numerairePriceUSD <= 0)
    throw new Error('numerairePriceUSD must be positive');

  const canonicalVirtualBase =
    virtualBase !== undefined && virtualBase > 0n ? virtualBase : baseForCurve;

  return _marketCapToCurveParams(
    marketCapUSD,
    baseTotalSupply,
    baseForCurve,
    baseDecimals,
    quoteDecimals,
    numerairePriceUSD,
    canonicalVirtualBase,
  );
}

/**
 * Derive the current market cap (USD) from live XYK curve state.
 *
 * Pass the virtual reserves from the `Launch` account and the current token
 * vault balances (`baseReserve`, `quoteReserve`) to get the live spot price.
 *
 * @example
 * const launch = await fetchLaunch(connection, launchAddress);
 * const [baseVaultBalance, quoteVaultBalance] = await Promise.all([
 *   getTokenAccountBalance(connection, launch.baseVault),
 *   getTokenAccountBalance(connection, launch.quoteVault),
 * ]);
 * // baseReserve is the curve-available portion, excluding reserved allocations
 * const baseReserve = baseVaultBalance - launch.baseForDistribution - launch.baseForLiquidity;
 * const mcap = curveParamsToMarketCap({
 *   curveVirtualBase:  launch.curveVirtualBase,
 *   curveVirtualQuote: launch.curveVirtualQuote,
 *   baseReserve,
 *   quoteReserve:      quoteVaultBalance,
 *   baseTotalSupply:   launch.baseTotalSupply,
 *   baseDecimals:      6,
 *   quoteDecimals:     9,
 *   numerairePriceUSD: 150,
 * });
 */
export function curveParamsToMarketCap(
  input: CurveParamsToMarketCapInput,
): number {
  const {
    curveVirtualBase,
    curveVirtualQuote,
    baseReserve,
    quoteReserve,
    baseTotalSupply,
    baseDecimals,
    quoteDecimals,
    numerairePriceUSD,
  } = input;

  if (curveVirtualBase <= 0n)
    throw new Error('curveVirtualBase must be positive');
  if (curveVirtualQuote <= 0n)
    throw new Error('curveVirtualQuote must be positive');
  if (baseReserve < 0n) throw new Error('baseReserve must be non-negative');
  if (quoteReserve < 0n) throw new Error('quoteReserve must be non-negative');

  const spotPriceUSD = _spotPriceUSD(
    curveVirtualBase,
    curveVirtualQuote,
    baseReserve,
    quoteReserve,
    baseDecimals,
    quoteDecimals,
    numerairePriceUSD,
  );

  const supplyHuman = Number(baseTotalSupply) / 10 ** baseDecimals;
  return spotPriceUSD * supplyHuman;
}

// ============================================================================
// Internal
// ============================================================================

function _marketCapToCurveParams(
  marketCapUSD: number,
  baseTotalSupply: bigint,
  baseForCurve: bigint,
  baseDecimals: number,
  quoteDecimals: number,
  numerairePriceUSD: number,
  curveVirtualBase: bigint,
): CurveParams {
  const tokenPriceUSD = marketCapToTokenPrice(
    marketCapUSD,
    baseTotalSupply,
    baseDecimals,
  );
  const priceInNumeraire = tokenPriceUSD / numerairePriceUSD;

  // Convert to raw units: quote_units / base_units
  const decimalScale = 10 ** (quoteDecimals - baseDecimals);
  const rawPriceQuotePerBase = priceInNumeraire * decimalScale;

  // spot price = virtual_quote / (baseForCurve + virtual_base)
  // => virtual_quote = rawPrice * (baseForCurve + virtual_base)
  const effectiveDenominator = baseForCurve + curveVirtualBase;

  const PRECISION = 1_000_000_000n;
  const rawPriceScaled = BigInt(
    Math.round(rawPriceQuotePerBase * Number(PRECISION)),
  );
  const curveVirtualQuote = (effectiveDenominator * rawPriceScaled) / PRECISION;

  if (curveVirtualQuote <= 0n) {
    throw new Error(
      `Computed curveVirtualQuote is zero or negative for marketCap=$${marketCapUSD.toLocaleString()}. ` +
        `Try a higher market cap or larger virtualBase.`,
    );
  }

  return { curveVirtualBase, curveVirtualQuote };
}

function _spotPriceUSD(
  curveVirtualBase: bigint,
  curveVirtualQuote: bigint,
  baseReserve: bigint,
  quoteReserve: bigint,
  baseDecimals: number,
  quoteDecimals: number,
  numerairePriceUSD: number,
): number {
  // spot price (quote/base) = (quoteReserve + virtualQuote) / (baseReserve + virtualBase)
  const effBase = Number(baseReserve + curveVirtualBase);
  const effQuote = Number(quoteReserve + curveVirtualQuote);
  const rawRatio = effQuote / effBase;

  // adjust for decimals → numeraire per token (human units)
  const decimalScale = 10 ** (baseDecimals - quoteDecimals);
  return rawRatio * decimalScale * numerairePriceUSD;
}
