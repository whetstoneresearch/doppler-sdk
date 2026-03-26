import { describe, expect, it } from 'vitest';
import {
  marketCapToTokenPrice,
  validateMarketCapParameters,
  marketCapToCurveParams,
  marketCapToSingleCurveParams,
  curveParamsToMarketCap,
} from '@/solana/core/marketCapHelpers.js';

// 1B tokens, 6 decimals
const SUPPLY = 1_000_000_000n * 10n ** 6n;
// All tokens go to curve (no distribution or liquidity split)
const BASE_FOR_CURVE = SUPPLY;
const BASE_DECIMALS = 6;
const QUOTE_DECIMALS = 9; // SOL
const SOL_PRICE = 150; // $150 per SOL

describe('marketCapToTokenPrice', () => {
  it('computes correct price from market cap and supply', () => {
    // $1M mcap, 1B tokens → $0.001 per token
    const price = marketCapToTokenPrice(1_000_000, SUPPLY, BASE_DECIMALS);
    expect(price).toBeCloseTo(0.001, 10);
  });

  it('throws on non-positive market cap', () => {
    expect(() => marketCapToTokenPrice(0, SUPPLY, BASE_DECIMALS)).toThrow();
    expect(() => marketCapToTokenPrice(-1, SUPPLY, BASE_DECIMALS)).toThrow();
  });

  it('throws on zero supply', () => {
    expect(() => marketCapToTokenPrice(1_000_000, 0n, BASE_DECIMALS)).toThrow();
  });
});

describe('validateMarketCapParameters', () => {
  it('returns valid for reasonable parameters', () => {
    const result = validateMarketCapParameters(1_000_000, SUPPLY, BASE_DECIMALS);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on very small market cap', () => {
    const result = validateMarketCapParameters(500, SUPPLY, BASE_DECIMALS);
    expect(result.valid).toBe(false);
    expect(result.warnings.some(w => w.includes('very small'))).toBe(true);
  });

  it('warns on market cap above $1T', () => {
    const result = validateMarketCapParameters(2_000_000_000_000, SUPPLY, BASE_DECIMALS);
    expect(result.valid).toBe(false);
    expect(result.warnings.some(w => w.includes('$1T'))).toBe(true);
  });

  it('warns when implied token price is dust', () => {
    // Tiny mcap against huge supply → price below $0.000001
    const hugeSupply = 1_000_000_000_000_000n * 10n ** 6n;
    const result = validateMarketCapParameters(1_000, hugeSupply, BASE_DECIMALS);
    expect(result.warnings.some(w => w.includes('very small'))).toBe(true);
  });
});

describe('marketCapToCurveParams', () => {
  it('returns higher curveVirtualQuote for higher market cap', () => {
    const { start, end } = marketCapToCurveParams({
      startMarketCapUSD: 100_000,
      endMarketCapUSD: 5_000_000,
      baseTotalSupply: SUPPLY,
      baseForCurve: BASE_FOR_CURVE,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    });
    expect(end.curveVirtualQuote).toBeGreaterThan(start.curveVirtualQuote);
  });

  it('uses the same curveVirtualBase for start and end', () => {
    const { start, end } = marketCapToCurveParams({
      startMarketCapUSD: 100_000,
      endMarketCapUSD: 5_000_000,
      baseTotalSupply: SUPPLY,
      baseForCurve: BASE_FOR_CURVE,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    });
    expect(start.curveVirtualBase).toBe(end.curveVirtualBase);
  });

  it('round-trips: curveParamsToMarketCap recovers the input market cap at launch open', () => {
    const targetMcap = 500_000;
    const { start } = marketCapToCurveParams({
      startMarketCapUSD: targetMcap,
      endMarketCapUSD: 10_000_000,
      baseTotalSupply: SUPPLY,
      baseForCurve: BASE_FOR_CURVE,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    });

    // At launch open: baseReserve = baseForCurve, quoteReserve = 0
    const recovered = curveParamsToMarketCap({
      curveVirtualBase: start.curveVirtualBase,
      curveVirtualQuote: start.curveVirtualQuote,
      baseReserve: BASE_FOR_CURVE,
      quoteReserve: 0n,
      baseTotalSupply: SUPPLY,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    });

    expect(recovered).toBeCloseTo(targetMcap, -1); // within ~1%
  });

  it('respects a custom virtualBase', () => {
    const largerVirtualBase = SUPPLY * 2n;
    const { start } = marketCapToCurveParams({
      startMarketCapUSD: 500_000,
      endMarketCapUSD: 5_000_000,
      baseTotalSupply: SUPPLY,
      baseForCurve: BASE_FOR_CURVE,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
      virtualBase: largerVirtualBase,
    });
    expect(start.curveVirtualBase).toBe(largerVirtualBase);
  });

  it('throws when startMarketCapUSD >= endMarketCapUSD', () => {
    expect(() =>
      marketCapToCurveParams({
        startMarketCapUSD: 5_000_000,
        endMarketCapUSD: 5_000_000,
        baseTotalSupply: SUPPLY,
        baseForCurve: BASE_FOR_CURVE,
        baseDecimals: BASE_DECIMALS,
        quoteDecimals: QUOTE_DECIMALS,
        numerairePriceUSD: SOL_PRICE,
      }),
    ).toThrow();
  });

  it('throws when baseForCurve exceeds baseTotalSupply', () => {
    expect(() =>
      marketCapToCurveParams({
        startMarketCapUSD: 100_000,
        endMarketCapUSD: 5_000_000,
        baseTotalSupply: SUPPLY,
        baseForCurve: SUPPLY + 1n,
        baseDecimals: BASE_DECIMALS,
        quoteDecimals: QUOTE_DECIMALS,
        numerairePriceUSD: SOL_PRICE,
      }),
    ).toThrow('baseForCurve cannot exceed baseTotalSupply');
  });

  it('round-trips with a distribution/liquidity split', () => {
    // 10% for distribution, 5% for liquidity → 85% for curve
    const baseForDistribution = SUPPLY / 10n;
    const baseForLiquidity = SUPPLY / 20n;
    const baseForCurve = SUPPLY - baseForDistribution - baseForLiquidity;
    const targetMcap = 500_000;

    const { start } = marketCapToCurveParams({
      startMarketCapUSD: targetMcap,
      endMarketCapUSD: 10_000_000,
      baseTotalSupply: SUPPLY,
      baseForCurve,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    });

    const recovered = curveParamsToMarketCap({
      curveVirtualBase: start.curveVirtualBase,
      curveVirtualQuote: start.curveVirtualQuote,
      baseReserve: baseForCurve,
      quoteReserve: 0n,
      baseTotalSupply: SUPPLY,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    });

    expect(recovered).toBeCloseTo(targetMcap, -1);
  });
});

describe('marketCapToSingleCurveParams', () => {
  it('produces same result as marketCapToCurveParams start params', () => {
    const targetMcap = 250_000;
    const { start } = marketCapToCurveParams({
      startMarketCapUSD: targetMcap,
      endMarketCapUSD: 1_000_000,
      baseTotalSupply: SUPPLY,
      baseForCurve: BASE_FOR_CURVE,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    });

    const single = marketCapToSingleCurveParams(
      targetMcap,
      SUPPLY,
      BASE_FOR_CURVE,
      BASE_DECIMALS,
      QUOTE_DECIMALS,
      SOL_PRICE,
    );

    expect(single.curveVirtualBase).toBe(start.curveVirtualBase);
    expect(single.curveVirtualQuote).toBe(start.curveVirtualQuote);
  });
});

describe('curveParamsToMarketCap', () => {
  it('increases as quoteReserve grows (buys accumulate)', () => {
    const base = {
      curveVirtualBase: BASE_FOR_CURVE,
      curveVirtualQuote: 1_000_000_000n, // 1 SOL
      baseTotalSupply: SUPPLY,
      baseDecimals: BASE_DECIMALS,
      quoteDecimals: QUOTE_DECIMALS,
      numerairePriceUSD: SOL_PRICE,
    };

    const atOpen = curveParamsToMarketCap({ ...base, baseReserve: BASE_FOR_CURVE, quoteReserve: 0n });
    const afterBuys = curveParamsToMarketCap({ ...base, baseReserve: BASE_FOR_CURVE / 2n, quoteReserve: 500_000_000n });

    expect(afterBuys).toBeGreaterThan(atOpen);
  });

  it('throws on non-positive virtual reserves', () => {
    expect(() =>
      curveParamsToMarketCap({
        curveVirtualBase: 0n,
        curveVirtualQuote: 1_000n,
        baseReserve: BASE_FOR_CURVE,
        quoteReserve: 0n,
        baseTotalSupply: SUPPLY,
        baseDecimals: BASE_DECIMALS,
        quoteDecimals: QUOTE_DECIMALS,
        numerairePriceUSD: SOL_PRICE,
      }),
    ).toThrow();
  });
});
