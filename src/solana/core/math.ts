import { BPS_DENOM, Q64_ONE } from './constants.js';
import type { Pool, SwapQuote, AddLiquidityQuote, RemoveLiquidityQuote, SwapDirection } from './types.js';

// ============================================================================
// Q64.64 Fixed-Point Arithmetic
// ============================================================================

/**
 * Convert a Q64.64 fixed-point number to a decimal number
 */
export function q64ToNumber(q64: bigint): number {
  // Split into integer and fractional parts for precision
  const intPart = q64 >> 64n;
  const fracPart = q64 & ((1n << 64n) - 1n);
  return Number(intPart) + Number(fracPart) / Number(Q64_ONE);
}

/**
 * Convert a decimal number to Q64.64 fixed-point
 */
export function numberToQ64(n: number): bigint {
  const intPart = Math.floor(n);
  const fracPart = n - intPart;
  return (BigInt(intPart) << 64n) + BigInt(Math.round(fracPart * Number(Q64_ONE)));
}

/**
 * Multiply two Q64.64 numbers, returning Q64.64 result
 */
export function q64Mul(a: bigint, b: bigint): bigint {
  return (a * b) >> 64n;
}

/**
 * Divide two Q64.64 numbers, returning Q64.64 result
 */
export function q64Div(a: bigint, b: bigint): bigint {
  return (a << 64n) / b;
}

/**
 * Compute spot price (reserve1/reserve0) as Q64.64
 * Price of token0 denominated in token1
 */
export function computePrice0Q64(reserve0: bigint, reserve1: bigint): bigint {
  if (reserve0 === 0n) return 0n;
  return (reserve1 << 64n) / reserve0;
}

/**
 * Compute spot price (reserve0/reserve1) as Q64.64
 * Price of token1 denominated in token0
 */
export function computePrice1Q64(reserve0: bigint, reserve1: bigint): bigint {
  if (reserve1 === 0n) return 0n;
  return (reserve0 << 64n) / reserve1;
}

// ============================================================================
// Integer Math Helpers
// ============================================================================

/**
 * Integer square root (floor)
 */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('isqrt: negative input');
  if (n === 0n) return 0n;

  let x = n;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }

  return x;
}

/**
 * Ceiling division: ceil(a / b)
 */
export function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

/**
 * Minimum of two bigints
 */
export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/**
 * Maximum of two bigints
 */
export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/**
 * Convert a ratio of two bigints to a decimal number using Q64.64 precision
 */
export function ratioToNumber(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) return 0;
  const q64 = (numerator << 64n) / denominator;
  return q64ToNumber(q64);
}

// ============================================================================
// Swap Quote Calculations
// ============================================================================

/**
 * Calculate swap output and fees for exact input amount
 *
 * Fee calculation (from spec):
 * - fee_total = floor(amount_in * fee_bps / 10_000)
 * - fee_dist = floor(fee_total * split_bps / 10_000)
 * - fee_comp = fee_total - fee_dist
 * - amount_in_eff = amount_in - fee_total
 *
 * CPMM output:
 * - amount_out = floor(amount_in_eff * reserve_out / (reserve_in + amount_in_eff))
 */
export function getSwapQuote(
  pool: Pool,
  amountIn: bigint,
  direction: SwapDirection,
): SwapQuote {
  if (amountIn === 0n) {
    return {
      amountOut: 0n,
      feeTotal: 0n,
      feeDist: 0n,
      feeComp: 0n,
      priceImpact: 0,
      executionPrice: 0,
    };
  }

  // Get reserves based on direction
  const [reserveIn, reserveOut] = direction === 0
    ? [pool.reserve0, pool.reserve1]
    : [pool.reserve1, pool.reserve0];

  if (reserveIn === 0n || reserveOut === 0n) {
    throw new Error('Pool has zero liquidity');
  }

  // Calculate fees
  const feeTotal = (amountIn * BigInt(pool.swapFeeBps)) / BPS_DENOM;
  const feeDist = (feeTotal * BigInt(pool.feeSplitBps)) / BPS_DENOM;
  const feeComp = feeTotal - feeDist;
  const amountInEff = amountIn - feeTotal;

  // CPMM output calculation
  const amountOut = (amountInEff * reserveOut) / (reserveIn + amountInEff);

  // Calculate price impact
  const spotPrice = ratioToNumber(reserveOut, reserveIn);
  const executionPrice = ratioToNumber(amountOut, amountIn);
  const priceImpact = spotPrice === 0 ? 0 : Math.abs(spotPrice - executionPrice) / spotPrice;

  return {
    amountOut,
    feeTotal,
    feeDist,
    feeComp,
    priceImpact,
    executionPrice,
  };
}

/**
 * Calculate input amount needed for exact output (reverse quote)
 */
export function getSwapQuoteExactOut(
  pool: Pool,
  amountOut: bigint,
  direction: SwapDirection,
): { amountIn: bigint; feeTotal: bigint } {
  // Get reserves based on direction
  const [reserveIn, reserveOut] = direction === 0
    ? [pool.reserve0, pool.reserve1]
    : [pool.reserve1, pool.reserve0];

  if (reserveIn === 0n || reserveOut === 0n) {
    throw new Error('Pool has zero liquidity');
  }

  if (amountOut >= reserveOut) {
    throw new Error('Insufficient liquidity for output amount');
  }

  // Reverse CPMM formula:
  // amountOut = amountInEff * reserveOut / (reserveIn + amountInEff)
  // => amountInEff = amountOut * reserveIn / (reserveOut - amountOut)
  const amountInEff = ceilDiv(amountOut * reserveIn, reserveOut - amountOut);

  // Reverse fee calculation:
  // amountInEff = amountIn - feeTotal = amountIn * (1 - feeBps/10000)
  // => amountIn = amountInEff * 10000 / (10000 - feeBps)
  const amountIn = ceilDiv(amountInEff * BPS_DENOM, BPS_DENOM - BigInt(pool.swapFeeBps));
  const feeTotal = amountIn - amountInEff;

  return { amountIn, feeTotal };
}

// ============================================================================
// Liquidity Quote Calculations
// ============================================================================

/**
 * Calculate shares and actual amounts for adding liquidity
 *
 * From spec:
 * - If initial: shares = floor_sqrt(amount0 * amount1)
 * - Else: shares = min(amount0 * totalShares / reserve0, amount1 * totalShares / reserve1)
 */
export function getAddLiquidityQuote(
  pool: Pool,
  amount0Max: bigint,
  amount1Max: bigint,
): AddLiquidityQuote {
  if (pool.totalShares === 0n) {
    // Initial liquidity deposit
    const rawShares = isqrt(amount0Max * amount1Max);
    if (rawShares === 0n) {
      throw new Error('Initial liquidity too small');
    }
    const sharesOut = rawShares;

    return {
      sharesOut,
      amount0: amount0Max,
      amount1: amount1Max,
      poolShare: ratioToNumber(sharesOut, rawShares),
    };
  }

  // Existing pool - calculate proportional deposit
  if (pool.reserve0 === 0n || pool.reserve1 === 0n) {
    throw new Error('Invalid pool state: zero reserves with non-zero shares');
  }

  // Calculate shares for each token amount
  const shares0 = (amount0Max * pool.totalShares) / pool.reserve0;
  const shares1 = (amount1Max * pool.totalShares) / pool.reserve1;
  const sharesOut = minBigInt(shares0, shares1);

  // Calculate actual amounts needed for exact ratio
  const amount0 = ceilDiv(sharesOut * pool.reserve0, pool.totalShares);
  const amount1 = ceilDiv(sharesOut * pool.reserve1, pool.totalShares);

  // Calculate pool share after deposit
  const newTotalShares = pool.totalShares + sharesOut;
  const poolShare = ratioToNumber(sharesOut, newTotalShares);

  return {
    sharesOut,
    amount0,
    amount1,
    poolShare,
  };
}

/**
 * Calculate token amounts for removing liquidity
 *
 * From spec:
 * - amount0 = shares * reserve0 / totalShares
 * - amount1 = shares * reserve1 / totalShares
 */
export function getRemoveLiquidityQuote(
  pool: Pool,
  sharesIn: bigint,
): RemoveLiquidityQuote {
  if (pool.totalShares === 0n) {
    throw new Error('Pool has no shares');
  }
  if (sharesIn > pool.totalShares) {
    throw new Error('Shares exceed total supply');
  }

  const amount0 = (sharesIn * pool.reserve0) / pool.totalShares;
  const amount1 = (sharesIn * pool.reserve1) / pool.totalShares;

  return { amount0, amount1 };
}

// ============================================================================
// Fee Growth Calculations
// ============================================================================

/**
 * Calculate accrued fees for a position
 *
 * From spec:
 * - delta = pool.fee_growth_global - position.fee_growth_last
 * - owed_inc = floor(position.shares * delta / 2^64)
 */
export function calculateAccruedFees(
  shares: bigint,
  feeGrowthLastQ64: bigint,
  feeGrowthGlobalQ64: bigint,
): bigint {
  const delta = feeGrowthGlobalQ64 - feeGrowthLastQ64;
  return (shares * delta) >> 64n;
}

/**
 * Calculate pending fees for a position (both tokens)
 */
export function getPendingFees(
  pool: Pool,
  position: { shares: bigint; feeGrowthLast0Q64: bigint; feeGrowthLast1Q64: bigint; feeOwed0: bigint; feeOwed1: bigint },
): { pending0: bigint; pending1: bigint } {
  const accrued0 = calculateAccruedFees(
    position.shares,
    position.feeGrowthLast0Q64,
    pool.feeGrowthGlobal0Q64,
  );
  const accrued1 = calculateAccruedFees(
    position.shares,
    position.feeGrowthLast1Q64,
    pool.feeGrowthGlobal1Q64,
  );

  return {
    pending0: position.feeOwed0 + accrued0,
    pending1: position.feeOwed1 + accrued1,
  };
}

// ============================================================================
// Price Helpers
// ============================================================================

/**
 * Calculate spot price of token0 in terms of token1
 */
export function getSpotPrice0(pool: Pool): number {
  if (pool.reserve0 === 0n) return 0;
  return q64ToNumber(computePrice0Q64(pool.reserve0, pool.reserve1));
}

/**
 * Calculate spot price of token1 in terms of token0
 */
export function getSpotPrice1(pool: Pool): number {
  if (pool.reserve1 === 0n) return 0;
  return q64ToNumber(computePrice1Q64(pool.reserve0, pool.reserve1));
}

/**
 * Calculate k (constant product invariant)
 */
export function getK(pool: Pool): bigint {
  return pool.reserve0 * pool.reserve1;
}

/**
 * Calculate pool TVL in terms of one token
 * @param pool Pool data
 * @param side 0 = denominate in token0, 1 = denominate in token1
 */
export function getTvl(pool: Pool, side: 0 | 1 = 0): bigint {
  if (side === 0) {
    // TVL in token0: reserve0 + (reserve1 * price1)
    // where price1 = reserve0/reserve1 (price of 1 in terms of 0)
    // = reserve0 + reserve1 * reserve0 / reserve1 = 2 * reserve0
    return 2n * pool.reserve0;
  } else {
    // TVL in token1: reserve1 + (reserve0 * price0)
    return 2n * pool.reserve1;
  }
}

// ============================================================================
// TWAP Helpers
// ============================================================================

/**
 * Calculate TWAP price from oracle observations
 *
 * TWAP = (cumulative_end - cumulative_start) / (timestamp_end - timestamp_start)
 */
export function calculateTwap(
  cumulativeStart: bigint,
  cumulativeEnd: bigint,
  timestampStart: number,
  timestampEnd: number,
): bigint {
  const dt = BigInt(timestampEnd - timestampStart);
  if (dt === 0n) return 0n;

  // Handle wrapping (cumulative values can wrap around)
  const cumulativeDiff = cumulativeEnd >= cumulativeStart
    ? cumulativeEnd - cumulativeStart
    : (1n << 256n) - cumulativeStart + cumulativeEnd;

  return cumulativeDiff / dt;
}

/**
 * Calculate TWAP as a decimal number
 */
export function calculateTwapNumber(
  cumulativeStart: bigint,
  cumulativeEnd: bigint,
  timestampStart: number,
  timestampEnd: number,
): number {
  const twapQ64 = calculateTwap(cumulativeStart, cumulativeEnd, timestampStart, timestampEnd);
  return q64ToNumber(twapQ64);
}
