import {
  getLiquidityForAmount0,
  getLiquidityForAmount1,
} from './liquidityMath';
import { getSqrtRatioAtTick, MAX_TICK, MIN_TICK } from './tickMath';

const MAX_UINT128 = (1n << 128n) - 1n;

export type MulticurveMaxTickLiquidityParams = {
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly tickSpacing: number;
  readonly numPositions: number;
  readonly curveSupply: bigint;
};

/**
 * Return the highest upper tick at or below params.tickUpper that can be used
 * by the multicurve initializer without overflowing maxLiquidityPerTick.
 *
 * The public builders use this for "max" market-cap ranges and for factory
 * fallback curves. The candidate tick is stepped down on the tick grid because
 * the safety check depends on the exact generated position boundaries and on
 * cumulative liquidity at each boundary tick.
 */
export function getMaxLiquiditySafeMulticurveTickUpper(
  params: MulticurveMaxTickLiquidityParams,
): number {
  if (params.tickUpper <= params.tickLower) {
    throw new Error(
      `Unable to find a uint128-safe multicurve max tick below ${params.tickUpper}`,
    );
  }

  if (isCanonicalCurveLiquiditySafe(params)) return params.tickUpper;

  for (
    let candidate = params.tickUpper - params.tickSpacing;
    candidate > params.tickLower;
    candidate -= params.tickSpacing
  ) {
    if (isCanonicalCurveLiquiditySafe({ ...params, tickUpper: candidate })) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to find a uint128-safe multicurve max tick below ${params.tickUpper}`,
  );
}

function isCanonicalCurveLiquiditySafe(
  params: MulticurveMaxTickLiquidityParams,
): boolean {
  // Token ordering is known only after pool construction. Check the canonical
  // shape and its mirrored token1 shape so the same market-cap config is safe
  // regardless of whether the asset becomes token0 or token1.
  return (
    isAdjustedCurveLiquiditySafe({
      ...params,
      isToken0: true,
    }) &&
    isAdjustedCurveLiquiditySafe({
      ...params,
      tickLower: -params.tickUpper,
      tickUpper: -params.tickLower,
      isToken0: false,
    })
  );
}

function isAdjustedCurveLiquiditySafe(
  params: MulticurveMaxTickLiquidityParams & { readonly isToken0: boolean },
): boolean {
  if (params.numPositions <= 0 || params.tickSpacing <= 0) {
    throw new Error('Multicurve positions and tick spacing must be positive');
  }

  const amountPerPosition = params.curveSupply / BigInt(params.numPositions);
  if (amountPerPosition <= 1n) return true;

  const amount = amountPerPosition - 1n;
  const maxLiquidityPerTick = getMaxLiquidityPerTick(params.tickSpacing);
  const liquidityByTick = new Map<number, bigint>();
  const farTick = params.isToken0 ? params.tickUpper : params.tickLower;
  const closeTick = params.isToken0 ? params.tickLower : params.tickUpper;
  const spread = params.tickUpper - params.tickLower;
  const farSqrtPriceX96 = getSqrtRatioAtTick(farTick);

  // The initializer splits curveSupply evenly across numPositions. Each
  // position starts along the curve and terminates at the far tick, so overflow
  // can happen either in a single position or in cumulative liquidity when
  // multiple positions touch the same boundary tick.
  for (let i = 0; i < params.numPositions; i++) {
    const tickDelta = Number(
      (BigInt(i) * BigInt(spread)) / BigInt(params.numPositions),
    );
    const unalignedTick = params.isToken0
      ? closeTick + tickDelta
      : closeTick - tickDelta;
    const startingTick = alignMulticurveTick(
      params.isToken0,
      unalignedTick,
      params.tickSpacing,
    );

    if (startingTick === farTick) continue;

    const startingSqrtPriceX96 = getSqrtRatioAtTick(startingTick);
    const liquidity = params.isToken0
      ? getLiquidityForAmount0(startingSqrtPriceX96, farSqrtPriceX96, amount)
      : getLiquidityForAmount1(farSqrtPriceX96, startingSqrtPriceX96, amount);

    if (liquidity > maxLiquidityPerTick) return false;
    const tickA = Math.min(farTick, startingTick);
    const tickB = Math.max(farTick, startingTick);
    if (
      !addTickLiquidity(liquidityByTick, tickA, liquidity, maxLiquidityPerTick)
    ) {
      return false;
    }
    if (
      !addTickLiquidity(liquidityByTick, tickB, liquidity, maxLiquidityPerTick)
    ) {
      return false;
    }
  }

  return true;
}

function getMaxLiquidityPerTick(tickSpacing: number): bigint {
  // Mirrors Uniswap V3/V4 Tick.tickSpacingToMaxLiquidityPerTick: both bounds
  // are truncated to the initialized tick grid before counting usable ticks.
  const minTick = Math.trunc(MIN_TICK / tickSpacing) * tickSpacing;
  const maxTick = Math.trunc(MAX_TICK / tickSpacing) * tickSpacing;
  const numTicks = BigInt((maxTick - minTick) / tickSpacing + 1);
  return MAX_UINT128 / numTicks;
}

function addTickLiquidity(
  liquidityByTick: Map<number, bigint>,
  tick: number,
  liquidity: bigint,
  maxLiquidityPerTick: bigint,
): boolean {
  const updatedLiquidity = (liquidityByTick.get(tick) ?? 0n) + liquidity;
  if (updatedLiquidity > maxLiquidityPerTick) return false;
  liquidityByTick.set(tick, updatedLiquidity);
  return true;
}

function alignMulticurveTick(
  isToken0: boolean,
  tick: number,
  tickSpacing: number,
): number {
  // Position starts are rounded outward from the close tick toward the far
  // tick, matching how the initializer places token0 and token1 ranges.
  if (isToken0) {
    return tick < 0
      ? Math.trunc((tick - tickSpacing + 1) / tickSpacing) * tickSpacing
      : Math.trunc(tick / tickSpacing) * tickSpacing;
  }

  return tick < 0
    ? Math.trunc(tick / tickSpacing) * tickSpacing
    : Math.trunc((tick + tickSpacing - 1) / tickSpacing) * tickSpacing;
}
