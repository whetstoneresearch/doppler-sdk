import { Q96 } from './tickMath';

/**
 * Compute the amount of token0 for a given liquidity and sqrt price range.
 * Mirrors Uniswap V3 SqrtPriceMath.getAmount0Delta (unsigned).
 *
 * amount0 = liquidity * (1/sqrtRatioA - 1/sqrtRatioB)
 *         = liquidity * (sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB) * Q96
 */
export function getAmount0ForLiquidity(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
): bigint {
  let [lower, upper] = [sqrtRatioAX96, sqrtRatioBX96];
  if (lower > upper) [lower, upper] = [upper, lower];

  if (lower <= 0n) {
    throw new Error('sqrtRatio must be positive');
  }

  return (liquidity * Q96 * (upper - lower)) / (lower * upper);
}

/**
 * Compute the amount of token1 for a given liquidity and sqrt price range.
 * Mirrors Uniswap V3 SqrtPriceMath.getAmount1Delta (unsigned).
 *
 * amount1 = liquidity * (sqrtRatioB - sqrtRatioA) / Q96
 */
export function getAmount1ForLiquidity(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
): bigint {
  let [lower, upper] = [sqrtRatioAX96, sqrtRatioBX96];
  if (lower > upper) [lower, upper] = [upper, lower];

  return (liquidity * (upper - lower)) / Q96;
}

/**
 * Compute the maximum liquidity for a given amount of token0 and sqrt price range.
 * Inverse of getAmount0ForLiquidity.
 *
 * liquidity = amount0 * sqrtRatioA * sqrtRatioB / (Q96 * (sqrtRatioB - sqrtRatioA))
 */
export function getLiquidityForAmount0(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount0: bigint,
): bigint {
  let [lower, upper] = [sqrtRatioAX96, sqrtRatioBX96];
  if (lower > upper) [lower, upper] = [upper, lower];

  const diff = upper - lower;
  if (diff === 0n) return 0n;
  if (lower <= 0n) {
    throw new Error('sqrtRatio must be positive');
  }

  return (amount0 * lower * upper) / (Q96 * diff);
}

/**
 * Compute the maximum liquidity for a given amount of token1 and sqrt price range.
 * Inverse of getAmount1ForLiquidity.
 *
 * liquidity = amount1 * Q96 / (sqrtRatioB - sqrtRatioA)
 */
export function getLiquidityForAmount1(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount1: bigint,
): bigint {
  let [lower, upper] = [sqrtRatioAX96, sqrtRatioBX96];
  if (lower > upper) [lower, upper] = [upper, lower];

  const diff = upper - lower;
  if (diff === 0n) return 0n;

  return (amount1 * Q96) / diff;
}
