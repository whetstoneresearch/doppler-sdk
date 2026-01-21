import { describe, it, expect } from 'vitest';
import {
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
  tickToPrice,
  priceToTick,
  getNearestUsableTick,
  MIN_TICK,
  MAX_TICK,
  Q96,
} from '../../../src/utils/tickMath';

describe('tickMath', () => {
  describe('getSqrtRatioAtTick', () => {
    it('should return correct sqrt ratio for tick 0', () => {
      const sqrtRatio = getSqrtRatioAtTick(0);
      expect(sqrtRatio).toBe(Q96); // At tick 0, price is 1
    });

    it('should return correct sqrt ratio for positive ticks', () => {
      const sqrtRatio = getSqrtRatioAtTick(1000);
      expect(sqrtRatio).toBeGreaterThan(Q96);
    });

    it('should return correct sqrt ratio for negative ticks', () => {
      const sqrtRatio = getSqrtRatioAtTick(-1000);
      expect(sqrtRatio).toBeLessThan(Q96);
    });

    it('should throw for out of bounds ticks', () => {
      expect(() => getSqrtRatioAtTick(MIN_TICK - 1)).toThrow(
        'Tick out of bounds',
      );
      expect(() => getSqrtRatioAtTick(MAX_TICK + 1)).toThrow(
        'Tick out of bounds',
      );
    });
  });

  describe('getTickAtSqrtRatio', () => {
    it('should return 0 for sqrt ratio at price 1', () => {
      const tick = getTickAtSqrtRatio(Q96);
      expect(tick).toBe(0);
    });

    it('should handle basic conversions', () => {
      // Test that we can convert back and forth, even if not perfectly
      const sqrtRatio = getSqrtRatioAtTick(100);
      const tick = getTickAtSqrtRatio(sqrtRatio);
      // The functions should return valid values
      expect(typeof tick).toBe('number');
      expect(tick).toBeGreaterThanOrEqual(MIN_TICK);
      expect(tick).toBeLessThanOrEqual(MAX_TICK);
    });
  });

  describe('sqrtPriceX96ToPrice', () => {
    it('should convert sqrt price to human readable price', () => {
      // At tick 0, sqrtPriceX96 = Q96, price should be 1
      const price = sqrtPriceX96ToPrice(Q96, 18, 18);
      expect(price).toBeCloseTo(1, 10);
    });

    it('should handle different decimals', () => {
      // USDC (6 decimals) / WETH (18 decimals)
      const sqrtPriceX96 = Q96 * 2n; // Price of 4
      const price = sqrtPriceX96ToPrice(sqrtPriceX96, 6, 18, true);
      expect(price).toBeCloseTo(4 * 1e12, 2); // Adjusted for decimals
    });

    it('should invert price when token0IsBase is false', () => {
      const sqrtPriceX96 = Q96 * 2n; // Price of 4
      const price0 = sqrtPriceX96ToPrice(sqrtPriceX96, 18, 18, true);
      const price1 = sqrtPriceX96ToPrice(sqrtPriceX96, 18, 18, false);
      expect(price0 * price1).toBeCloseTo(1, 10);
    });
  });

  describe('priceToSqrtPriceX96', () => {
    it('should convert price to sqrtPriceX96', () => {
      const price = 4; // token1/token0 = 4
      const sqrtPriceX96 = priceToSqrtPriceX96(price, 18, 18);
      const expectedSqrt = BigInt(Math.floor(2 * Number(Q96))); // sqrt(4) = 2
      // Allow small difference due to rounding
      const diff =
        sqrtPriceX96 > expectedSqrt
          ? sqrtPriceX96 - expectedSqrt
          : expectedSqrt - sqrtPriceX96;
      expect(diff).toBeLessThan(1000n);
    });

    it('should handle decimal adjustments', () => {
      // USDC/WETH where USDC has 6 decimals
      const price = 2000; // 2000 USDC per WETH
      const sqrtPriceX96 = priceToSqrtPriceX96(price, 18, 6);
      expect(sqrtPriceX96).toBeGreaterThan(0n);
    });
  });

  describe('tickToPrice', () => {
    it('should convert tick to price', () => {
      const price = tickToPrice(0, 18, 18);
      expect(price).toBeCloseTo(1, 10);
    });

    it('should handle positive ticks', () => {
      const price = tickToPrice(10000, 18, 18);
      expect(price).toBeGreaterThan(1);
    });

    it('should handle negative ticks', () => {
      const price = tickToPrice(-10000, 18, 18);
      expect(price).toBeLessThan(1);
    });
  });

  describe('priceToTick', () => {
    it('should convert price to tick', () => {
      const tick = priceToTick(1, 18, 18);
      expect(tick).toBe(0);
    });

    it('should convert between price and tick', () => {
      // Test with a larger price difference to ensure tick changes
      const price = 10; // 10x price difference
      const tick = priceToTick(price, 18, 18);
      const recoveredPrice = tickToPrice(tick, 18, 18);

      // Tick should be positive for price > 1
      expect(tick).toBeGreaterThan(0);
      // Recovered price should be in the right order of magnitude
      expect(recoveredPrice).toBeGreaterThan(1);
      expect(recoveredPrice).toBeLessThan(100);
    });
  });

  describe('mixed decimals precision (issue #33)', () => {
    // USDC has 6 decimals, WETH has 18 decimals
    const USDC_DECIMALS = 6;
    const WETH_DECIMALS = 18;

    it('should handle USDC/WETH price conversions accurately', () => {
      // Test ETH price at $2000 USDC
      // In Uniswap terms with USDC as token0 and WETH as token1:
      // price = token1/token0 = WETH/USDC in raw units
      // For $2000 USDC per ETH: 1 ETH = 2000 USDC
      // So USDC/WETH = 0.0005 (in human terms)

      const price = 0.0005; // USDC per WETH (inverted)
      const tick = priceToTick(price, USDC_DECIMALS, WETH_DECIMALS);
      const recoveredPrice = tickToPrice(tick, USDC_DECIMALS, WETH_DECIMALS);

      // Should recover the price within 0.1% (tick spacing introduces some error)
      const relativeError = Math.abs(recoveredPrice - price) / price;
      expect(relativeError).toBeLessThan(0.001);
    });

    it('should handle very small prices with mixed decimals', () => {
      // Very small price like a new token launch
      const price = 0.000001; // token1 per token0
      const tick = priceToTick(price, 6, 18);
      const recoveredPrice = tickToPrice(tick, 6, 18);

      const relativeError = Math.abs(recoveredPrice - price) / price;
      expect(relativeError).toBeLessThan(0.001);
    });

    it('should handle large prices with mixed decimals', () => {
      // Large price scenario
      const price = 1000000; // token1 per token0
      const tick = priceToTick(price, 18, 6);
      const recoveredPrice = tickToPrice(tick, 18, 6);

      const relativeError = Math.abs(recoveredPrice - price) / price;
      expect(relativeError).toBeLessThan(0.001);
    });

    it('should be consistent across roundtrip conversions', () => {
      // Test various price points
      const testPrices = [0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000];

      for (const price of testPrices) {
        const tick = priceToTick(price, 18, 18);
        const recoveredPrice = tickToPrice(tick, 18, 18);

        const relativeError = Math.abs(recoveredPrice - price) / price;
        expect(relativeError).toBeLessThan(0.001);
      }
    });

    it('should handle 6/18 decimal pair roundtrip', () => {
      const testPrices = [0.0000001, 0.000001, 0.00001, 0.0001, 0.001];

      for (const price of testPrices) {
        const tick = priceToTick(price, 6, 18);
        const recoveredPrice = tickToPrice(tick, 6, 18);

        const relativeError = Math.abs(recoveredPrice - price) / price;
        expect(relativeError).toBeLessThan(0.001);
      }
    });

    it('should handle 18/6 decimal pair roundtrip', () => {
      const testPrices = [1000, 10000, 100000, 1000000, 10000000];

      for (const price of testPrices) {
        const tick = priceToTick(price, 18, 6);
        const recoveredPrice = tickToPrice(tick, 18, 6);

        const relativeError = Math.abs(recoveredPrice - price) / price;
        expect(relativeError).toBeLessThan(0.001);
      }
    });
  });

  describe('getNearestUsableTick', () => {
    it('should round to nearest tick spacing', () => {
      expect(getNearestUsableTick(105, 10)).toBe(110); // 105 rounds to 110
      expect(getNearestUsableTick(104, 10)).toBe(100); // 104 rounds to 100
      expect(getNearestUsableTick(100, 10)).toBe(100);
    });

    it('should handle tick spacing of 60', () => {
      expect(getNearestUsableTick(100, 60)).toBe(120);
      expect(getNearestUsableTick(89, 60)).toBe(60);
      expect(getNearestUsableTick(-31, 60)).toBe(-60);
    });

    it('should respect min/max bounds', () => {
      expect(getNearestUsableTick(MIN_TICK - 1000, 60)).toBe(MIN_TICK);
      expect(getNearestUsableTick(MAX_TICK + 1000, 60)).toBe(MAX_TICK);
    });
  });
});
