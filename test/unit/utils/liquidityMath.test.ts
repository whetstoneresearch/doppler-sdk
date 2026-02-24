import { describe, expect, it } from 'vitest';
import {
  getAmount0ForLiquidity,
  getAmount1ForLiquidity,
  getLiquidityForAmount0,
  getLiquidityForAmount1,
} from '../../../src/utils/liquidityMath';
import { getSqrtRatioAtTick } from '../../../src/utils/tickMath';

describe('liquidityMath', () => {
  // Use concrete ticks for a realistic single-tick range
  const tickLower = -120;
  const tickUpper = -60;
  const sqrtRatioA = getSqrtRatioAtTick(tickLower);
  const sqrtRatioB = getSqrtRatioAtTick(tickUpper);

  describe('round-trip: amount0 -> liquidity -> amount0', () => {
    it('recovers the original amount0 (within rounding)', () => {
      const amount0 = 1_000_000n;
      const liquidity = getLiquidityForAmount0(sqrtRatioA, sqrtRatioB, amount0);
      expect(liquidity).toBeGreaterThan(0n);

      const recovered = getAmount0ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity);
      // Integer division may lose up to 1 unit per step
      expect(recovered).toBeLessThanOrEqual(amount0);
      expect(recovered).toBeGreaterThanOrEqual(amount0 - 2n);
    });

    it('works with large amounts', () => {
      const amount0 = 10n ** 18n;
      const liquidity = getLiquidityForAmount0(sqrtRatioA, sqrtRatioB, amount0);
      const recovered = getAmount0ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity);
      expect(recovered).toBeLessThanOrEqual(amount0);
      expect(recovered).toBeGreaterThanOrEqual(amount0 - 2n);
    });
  });

  describe('round-trip: amount1 -> liquidity -> amount1', () => {
    it('recovers the original amount1 (within rounding)', () => {
      const amount1 = 1_000_000n;
      const liquidity = getLiquidityForAmount1(sqrtRatioA, sqrtRatioB, amount1);
      expect(liquidity).toBeGreaterThan(0n);

      const recovered = getAmount1ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity);
      expect(recovered).toBeLessThanOrEqual(amount1);
      expect(recovered).toBeGreaterThanOrEqual(amount1 - 2n);
    });

    it('works with large amounts', () => {
      const amount1 = 10n ** 18n;
      const liquidity = getLiquidityForAmount1(sqrtRatioA, sqrtRatioB, amount1);
      const recovered = getAmount1ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity);
      expect(recovered).toBeLessThanOrEqual(amount1);
      expect(recovered).toBeGreaterThanOrEqual(amount1 - 2n);
    });
  });

  describe('boundary cases', () => {
    it('returns 0 liquidity when sqrtRatioA === sqrtRatioB (zero-width range)', () => {
      expect(getLiquidityForAmount0(sqrtRatioA, sqrtRatioA, 1_000n)).toBe(0n);
      expect(getLiquidityForAmount1(sqrtRatioA, sqrtRatioA, 1_000n)).toBe(0n);
    });

    it('returns 0 amount for 0 liquidity', () => {
      expect(getAmount0ForLiquidity(sqrtRatioA, sqrtRatioB, 0n)).toBe(0n);
      expect(getAmount1ForLiquidity(sqrtRatioA, sqrtRatioB, 0n)).toBe(0n);
    });

    it('handles reversed sqrt ratio order (auto-sorts)', () => {
      const a0_normal = getAmount0ForLiquidity(sqrtRatioA, sqrtRatioB, 1000n);
      const a0_reversed = getAmount0ForLiquidity(sqrtRatioB, sqrtRatioA, 1000n);
      expect(a0_normal).toBe(a0_reversed);

      const a1_normal = getAmount1ForLiquidity(sqrtRatioA, sqrtRatioB, 1000n);
      const a1_reversed = getAmount1ForLiquidity(sqrtRatioB, sqrtRatioA, 1000n);
      expect(a1_normal).toBe(a1_reversed);
    });

    it('throws for non-positive sqrtRatio in amount0 calculation', () => {
      expect(() => getAmount0ForLiquidity(0n, sqrtRatioB, 1000n)).toThrow(
        'sqrtRatio must be positive',
      );
    });

    it('throws for non-positive sqrtRatio in getLiquidityForAmount0', () => {
      expect(() => getLiquidityForAmount0(0n, sqrtRatioB, 1000n)).toThrow(
        'sqrtRatio must be positive',
      );
    });

    it('liquidity of 1 produces minimal amounts', () => {
      const a0 = getAmount0ForLiquidity(sqrtRatioA, sqrtRatioB, 1n);
      const a1 = getAmount1ForLiquidity(sqrtRatioA, sqrtRatioB, 1n);
      expect(a0).toBeGreaterThanOrEqual(0n);
      expect(a1).toBeGreaterThanOrEqual(0n);
    });
  });
});
