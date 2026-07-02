import { describe, expect, it } from 'vitest';
import { parseEther } from 'viem';
import { getMaxLiquiditySafeMulticurveTickUpper } from '../../../../src/evm/utils';

describe('multicurve liquidity utilities', () => {
  it('uses the protocol tick-count formula when checking per-tick liquidity', () => {
    const tickUpper = getMaxLiquiditySafeMulticurveTickUpper({
      tickLower: -100000,
      tickUpper: 887220,
      tickSpacing: 60,
      numPositions: 10,
      curveSupply: parseEther('7000000'),
    });

    expect(tickUpper).toBe(532020);
  });

  it('rejects zero-width max tick searches', () => {
    expect(() =>
      getMaxLiquiditySafeMulticurveTickUpper({
        tickLower: 887220,
        tickUpper: 887220,
        tickSpacing: 60,
        numPositions: 10,
        curveSupply: parseEther('1'),
      }),
    ).toThrow('Unable to find a uint128-safe multicurve max tick');
  });
});
