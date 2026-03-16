/**
 * PositionCard Component
 *
 * Display user's liquidity position with share value and pending fees.
 */

import { useMemo, useCallback } from 'react';
import type { Address } from '@solana/kit';
import type { Pool, Position } from '../../core/types.js';
import { usePosition } from '../hooks/usePosition.js';
import { usePool } from '../hooks/usePool.js';
import type { TokenInfo } from './SwapCard.js';

/**
 * Props for PositionCard component
 */
export interface PositionCardProps {
  /** Pool address */
  poolAddress: Address;
  /** Pre-fetched pool data (optional) */
  pool?: Pool | null;
  /** Position address (if known) */
  positionAddress?: Address;
  /** Pre-fetched position data (optional) */
  position?: Position | null;
  /** Token0 metadata */
  token0: TokenInfo;
  /** Token1 metadata */
  token1: TokenInfo;
  /** Additional CSS classes */
  className?: string;
  /** Position ID (default: 0) */
  positionId?: bigint;
  /** Callback when collect fees is clicked */
  onCollectFees?: (params: {
    positionAddress: Address;
    pending0: bigint;
    pending1: bigint;
  }) => Promise<void>;
  /** Whether collect operation is in progress */
  collecting?: boolean;
  /** Whether to show collect button */
  showCollectButton?: boolean;
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

  const fracStr = fracPart.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
  if (fracStr === '') {
    return intPart.toLocaleString();
  }
  return `${intPart.toLocaleString()}.${fracStr}`;
}

/**
 * Format percentage for display
 */
function formatPercent(value: number): string {
  if (value === 0) return '0%';
  if (value < 0.0001) return '<0.01%';
  if (value >= 1) return `${(value * 100).toFixed(0)}%`;
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format large share numbers
 */
function formatShares(shares: bigint): string {
  const num = Number(shares);
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return shares.toString();
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
 * Position card for displaying user's LP position
 *
 * Shows:
 * - LP shares owned
 * - Value in underlying tokens
 * - Pool share percentage
 * - Pending uncollected fees
 * - Collect fees button
 *
 * @example
 * ```tsx
 * function MyPositions({ poolAddress }) {
 *   const handleCollect = async (params) => {
 *     // Build and send collect fees transaction
 *   };
 *
 *   return (
 *     <PositionCard
 *       poolAddress={poolAddress}
 *       token0={{ mint: sol, symbol: 'SOL', decimals: 9 }}
 *       token1={{ mint: usdc, symbol: 'USDC', decimals: 6 }}
 *       onCollectFees={handleCollect}
 *       showCollectButton
 *     />
 *   );
 * }
 * ```
 */
export function PositionCard({
  poolAddress,
  pool: providedPool,
  positionAddress: providedPositionAddress,
  position: providedPosition,
  token0,
  token1,
  className = '',
  positionId = 0n,
  onCollectFees,
  collecting = false,
  showCollectButton = true,
}: PositionCardProps): JSX.Element {
  // Fetch pool if not provided
  const { pool: fetchedPool, loading: poolLoading } = usePool(
    providedPool ? undefined : poolAddress
  );
  const pool = providedPool ?? fetchedPool;

  // Fetch position if not provided
  const {
    position: fetchedPosition,
    positionAddress: fetchedPositionAddress,
    loading: positionLoading,
    error: positionError,
    pendingFees: fetchedPendingFees,
    value,
    refetch,
  } = usePosition(
    providedPosition ? undefined : poolAddress,
    positionId,
    { pool: pool ?? undefined }
  );

  const position = providedPosition ?? fetchedPosition;
  const positionAddress = providedPositionAddress ?? fetchedPositionAddress;

  // Use provided pending fees or calculate from fetched position
  const pendingFees = useMemo(() => {
    if (!position || !pool) return null;
    return fetchedPendingFees;
  }, [position, pool, fetchedPendingFees]);

  // Loading state
  const loading = poolLoading || positionLoading;

  // Handle collect fees
  const handleCollect = useCallback(async () => {
    if (!positionAddress || !pendingFees || !onCollectFees) return;
    if (!pendingFees.pending0 && !pendingFees.pending1) return;

    await onCollectFees({
      positionAddress,
      pending0: pendingFees.pending0,
      pending1: pendingFees.pending1,
    });
  }, [positionAddress, pendingFees, onCollectFees]);

  // Can collect fees?
  const canCollect = useMemo(() => {
    if (!pendingFees || collecting || !onCollectFees) return false;
    return pendingFees.pending0 > 0n || pendingFees.pending1 > 0n;
  }, [pendingFees, collecting, onCollectFees]);

  // Render loading skeleton
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  // Render error state
  if (positionError) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <div className="text-red-500 text-center">
          <p>Failed to load position</p>
          <p className="text-sm text-gray-500 mt-1">{positionError.message}</p>
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

  // Render no position state
  if (!position || position.shares === 0n) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-2">Your Position</h3>
        <p className="text-gray-500 text-center py-4">
          You don't have a position in this pool yet.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Your Position</h3>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm text-blue-500 hover:text-blue-600"
          aria-label="Refresh position"
        >
          Refresh
        </button>
      </div>

      {/* Shares owned */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">LP Shares</span>
          <span className="font-bold text-lg">{formatShares(position.shares)}</span>
        </div>
        {value && (
          <div className="text-right text-sm text-gray-500 mt-1">
            {formatPercent(value.poolShare)} of pool
          </div>
        )}
      </div>

      {/* Value in tokens */}
      {value && (
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <span className="text-sm text-gray-500 block mb-2">Position Value</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-gray-400">{token0.symbol}</span>
              <p className="font-medium">
                {formatAmount(value.amount0, token0.decimals)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-400">{token1.symbol}</span>
              <p className="font-medium">
                {formatAmount(value.amount1, token1.decimals)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending fees */}
      {pendingFees && (
        <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-green-700">Pending Fees</span>
            {canCollect && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                Available
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-gray-400">{token0.symbol}</span>
              <p className={`font-medium ${pendingFees.pending0 > 0n ? 'text-green-700' : 'text-gray-500'}`}>
                {formatAmount(pendingFees.pending0, token0.decimals)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-400">{token1.symbol}</span>
              <p className={`font-medium ${pendingFees.pending1 > 0n ? 'text-green-700' : 'text-gray-500'}`}>
                {formatAmount(pendingFees.pending1, token1.decimals)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Collect fees button */}
      {showCollectButton && pendingFees && (
        <button
          type="button"
          onClick={handleCollect}
          disabled={!canCollect || collecting}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            canCollect && !collecting
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          aria-label={collecting ? 'Collecting fees...' : 'Collect fees'}
        >
          {collecting
            ? 'Collecting...'
            : canCollect
            ? 'Collect Fees'
            : 'No fees to collect'}
        </button>
      )}

      {/* Total value section */}
      {value && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Total Value (incl. fees)</span>
            <div className="text-right">
              <p className="font-medium">
                {formatAmount(value.totalValue0, token0.decimals)} {token0.symbol}
              </p>
              <p className="text-gray-400 text-xs">
                {formatAmount(value.totalValue1, token1.decimals)} {token1.symbol}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
