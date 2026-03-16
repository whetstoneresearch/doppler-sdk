/**
 * PoolStats Component
 *
 * Display pool statistics including TVL, reserves, price, and fees.
 */

import { useMemo } from 'react';
import type { Address } from '@solana/kit';
import type { Pool } from '../../core/types.js';
import { getSpotPrice0, getSpotPrice1, getTvl } from '../../core/math.js';
import { usePool } from '../hooks/usePool.js';
import type { TokenInfo } from './SwapCard.js';

/**
 * Props for PoolStats component
 */
export interface PoolStatsProps {
  /** Pool address */
  poolAddress: Address;
  /** Pre-fetched pool data (optional) */
  pool?: Pool | null;
  /** Token0 metadata */
  token0: TokenInfo;
  /** Token1 metadata */
  token1: TokenInfo;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show loading skeleton */
  showSkeleton?: boolean;
  /** Custom TVL formatter (receives TVL in token units) */
  formatTvl?: (tvl: number, token: TokenInfo) => string;
  /** Display mode: 'compact' or 'full' */
  variant?: 'compact' | 'full';
}

/**
 * Format a bigint amount for display with decimals
 */
function formatAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) return '0';

  const divisor = 10n ** BigInt(decimals);
  const intPart = amount / divisor;
  const fracPart = amount % divisor;

  if (fracPart === 0n) {
    return intPart.toLocaleString();
  }

  const fracStr = fracPart.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  if (fracStr === '') {
    return intPart.toLocaleString();
  }
  return `${intPart.toLocaleString()}.${fracStr}`;
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
  if (price === 0) return '0';
  if (price >= 1000000) return price.toExponential(4);
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 6 });
  if (price >= 0.0001) return price.toFixed(6);
  return price.toExponential(4);
}

/**
 * Format basis points as percentage
 */
function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Default TVL formatter
 */
function defaultFormatTvl(tvl: number, token: TokenInfo): string {
  const formatted = tvl.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  return `${formatted} ${token.symbol}`;
}

/**
 * Loading skeleton component
 */
function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Pool statistics display
 *
 * Shows key pool metrics including:
 * - Total Value Locked (TVL)
 * - Token reserves
 * - Current price
 * - Fee rates
 *
 * @example
 * ```tsx
 * function PoolPage({ poolAddress }) {
 *   return (
 *     <div>
 *       <PoolStats
 *         poolAddress={poolAddress}
 *         token0={{ mint: sol, symbol: 'SOL', decimals: 9 }}
 *         token1={{ mint: usdc, symbol: 'USDC', decimals: 6 }}
 *         variant="full"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function PoolStats({
  poolAddress,
  pool: providedPool,
  token0,
  token1,
  className = '',
  showSkeleton = true,
  formatTvl = defaultFormatTvl,
  variant = 'full',
}: PoolStatsProps): JSX.Element {
  // Fetch pool if not provided
  const { pool: fetchedPool, loading, error, refetch, refetching } = usePool(
    providedPool ? undefined : poolAddress
  );
  const pool = providedPool ?? fetchedPool;

  // Calculate derived values
  const stats = useMemo(() => {
    if (!pool) return null;

    const price0 = getSpotPrice0(pool);
    const price1 = getSpotPrice1(pool);

    // TVL in terms of token0 (simpler display)
    const tvlRaw = getTvl(pool, 0);
    const tvl0Decimal = Number(tvlRaw) / 10 ** token0.decimals;

    // Also calculate TVL in token1 for display option
    const tvl1Raw = getTvl(pool, 1);
    const tvl1Decimal = Number(tvl1Raw) / 10 ** token1.decimals;

    return {
      price0,
      price1,
      tvl0: tvl0Decimal,
      tvl1: tvl1Decimal,
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      totalShares: pool.totalShares,
      swapFeeBps: pool.swapFeeBps,
      feeSplitBps: pool.feeSplitBps,
    };
  }, [pool, token0.decimals, token1.decimals]);

  // Render loading state
  if (loading && showSkeleton) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <div className="text-red-500 text-center">
          <p>Failed to load pool stats</p>
          <p className="text-sm text-gray-500 mt-1">{error.message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!pool || !stats) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <p className="text-gray-500 text-center">Pool not found</p>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`bg-white rounded-lg shadow-md p-3 ${className}`}>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-500">TVL</span>
            <p className="font-medium">{formatTvl(stats.tvl0, token0)}</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500">Price</span>
            <p className="font-medium">
              1 {token0.symbol} = {formatPrice(stats.price0)} {token1.symbol}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Pool Statistics</h3>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={refetching}
          className="text-sm text-blue-500 hover:text-blue-600 disabled:text-gray-400"
          aria-label="Refresh pool statistics"
        >
          {refetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* TVL */}
        <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">Total Value Locked (TVL)</span>
          <p className="text-xl font-bold">{formatTvl(stats.tvl0, token0)}</p>
          <p className="text-sm text-gray-500">
            ({formatTvl(stats.tvl1, token1)})
          </p>
        </div>

        {/* Reserves */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">{token0.symbol} Reserve</span>
          <p className="font-medium">
            {formatAmount(stats.reserve0, token0.decimals)}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">{token1.symbol} Reserve</span>
          <p className="font-medium">
            {formatAmount(stats.reserve1, token1.decimals)}
          </p>
        </div>

        {/* Price */}
        <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">Current Price</span>
          <div className="flex justify-between items-center mt-1">
            <p className="font-medium">
              1 {token0.symbol} = {formatPrice(stats.price0)} {token1.symbol}
            </p>
            <p className="text-sm text-gray-500">
              1 {token1.symbol} = {formatPrice(stats.price1)} {token0.symbol}
            </p>
          </div>
        </div>

        {/* Fee Rates */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">Swap Fee</span>
          <p className="font-medium">{formatBps(stats.swapFeeBps)}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">LP Fee Share</span>
          <p className="font-medium">{formatBps(stats.feeSplitBps)}</p>
        </div>

        {/* Total Shares */}
        <div className="col-span-2 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">Total LP Shares</span>
          <p className="font-medium text-sm break-all">
            {stats.totalShares.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
