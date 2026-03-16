/**
 * usePosition Hook
 *
 * Fetches and manages user position data from the CPMM program.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Address } from '@solana/kit';
import type { Position, Pool } from '../../core/types.js';
import {
  fetchPosition,
  fetchUserPositions,
  getPositionValue,
  type PositionWithAddress,
  type PositionValue,
} from '../../client/position.js';
import { fetchPool } from '../../client/pool.js';
import { getPendingFees } from '../../core/math.js';
import { useAmm } from '../providers/AmmContext.js';
import { useWalletOptional } from '../providers/WalletContext.js';

/**
 * Position data with calculated values
 */
export interface UsePositionResult {
  /** Position account data (null if not loaded or not found) */
  position: Position | null;
  /** Position address */
  positionAddress?: Address;
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Error that occurred during fetching */
  error: Error | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Pending uncollected fees */
  pendingFees: { pending0: bigint; pending1: bigint } | null;
  /** Position value breakdown (requires pool data) */
  value: PositionValue | null;
}

/**
 * Options for usePosition hook
 */
export interface UsePositionOptions {
  /** Override auto-refresh interval (ms). Set to 0 to disable. */
  refreshInterval?: number;
  /** Whether to fetch immediately on mount. Default: true */
  fetchOnMount?: boolean;
  /** Commitment level override */
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Pool data (if already fetched) to calculate position value */
  pool?: Pool;
}

/**
 * Hook to fetch user's position in a pool
 *
 * @param poolAddress - Address of the pool
 * @param positionId - Position ID (default: 0 for first position)
 * @param options - Optional configuration
 * @returns Position data with loading/error states
 *
 * @example
 * ```tsx
 * function MyPosition({ poolAddress }: { poolAddress: Address }) {
 *   const { position, loading, error, pendingFees, value } = usePosition(poolAddress);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!position) return <div>No position found</div>;
 *
 *   return (
 *     <div>
 *       <p>Shares: {position.shares.toString()}</p>
 *       {pendingFees && (
 *         <p>Pending fees: {pendingFees.pending0.toString()} / {pendingFees.pending1.toString()}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePosition(
  poolAddress: Address | undefined,
  positionId: bigint = 0n,
  options: UsePositionOptions = {},
): UsePositionResult {
  const {
    rpc,
    programId,
    commitment: defaultCommitment,
    refreshInterval: defaultRefreshInterval,
  } = useAmm();
  const wallet = useWalletOptional();

  const {
    refreshInterval = defaultRefreshInterval,
    fetchOnMount = true,
    commitment = defaultCommitment,
    pool: providedPool,
  } = options;

  const [position, setPosition] = useState<Position | null>(null);
  const [positionAddress, setPositionAddress] = useState<Address | undefined>();
  const [pool, setPool] = useState<Pool | null>(providedPool ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  const ownerAddress = wallet?.address;

  const fetchPositionData = useCallback(async () => {
    if (!poolAddress || !ownerAddress) {
      setPosition(null);
      setPositionAddress(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Import PDA derivation
      const { getPositionAddress } = await import('../../core/pda.js');
      const [posAddr] = await getPositionAddress(
        poolAddress,
        ownerAddress,
        positionId,
        programId,
      );
      setPositionAddress(posAddr);

      // Fetch position and pool in parallel
      const [positionData, poolData] = await Promise.all([
        fetchPosition(rpc, posAddr, { programId, commitment }),
        providedPool
          ? Promise.resolve(providedPool)
          : fetchPool(rpc, poolAddress, { programId, commitment }),
      ]);

      if (mountedRef.current) {
        setPosition(positionData);
        setPool(poolData);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [
    poolAddress,
    ownerAddress,
    positionId,
    rpc,
    programId,
    commitment,
    providedPool,
  ]);

  const refetch = useCallback(async () => {
    await fetchPositionData();
  }, [fetchPositionData]);

  // Calculate pending fees
  const pendingFees = useMemo(() => {
    if (!pool || !position) return null;
    return getPendingFees(pool, position);
  }, [pool, position]);

  // Calculate position value
  const value = useMemo(() => {
    if (!pool || !position) return null;
    return getPositionValue(pool, position);
  }, [pool, position]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchPositionData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPositionData, fetchOnMount]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0 || !poolAddress || !ownerAddress) {
      return;
    }

    const intervalId = setInterval(fetchPositionData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchPositionData, refreshInterval, poolAddress, ownerAddress]);

  return {
    position,
    positionAddress,
    loading,
    error,
    refetch,
    pendingFees,
    value,
  };
}

/**
 * Result for useUserPositions hook
 */
export interface UseUserPositionsResult {
  /** Array of user positions with addresses */
  positions: PositionWithAddress[];
  /** Whether loading */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually trigger refetch */
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch all positions for the connected user
 *
 * @param poolFilter - Optional pool address to filter positions
 * @param options - Optional configuration
 * @returns Array of user positions
 *
 * @example
 * ```tsx
 * function AllPositions() {
 *   const { positions, loading } = useUserPositions();
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {positions.map(({ address, account }) => (
 *         <li key={address}>
 *           Pool: {account.pool} - Shares: {account.shares.toString()}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useUserPositions(
  poolFilter?: Address,
  options: Omit<UsePositionOptions, 'pool'> = {},
): UseUserPositionsResult {
  const {
    rpc,
    programId,
    commitment: defaultCommitment,
    refreshInterval: defaultRefreshInterval,
  } = useAmm();
  const wallet = useWalletOptional();

  const {
    refreshInterval = defaultRefreshInterval,
    fetchOnMount = true,
    commitment = defaultCommitment,
  } = options;

  const [positions, setPositions] = useState<PositionWithAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const ownerAddress = wallet?.address;

  const fetchPositions = useCallback(async () => {
    if (!ownerAddress) {
      setPositions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const positionsData = await fetchUserPositions(
        rpc,
        ownerAddress,
        poolFilter,
        {
          programId,
          commitment,
        },
      );

      if (mountedRef.current) {
        // Filter out positions with zero shares by default
        setPositions(positionsData.filter((p) => p.account.shares > 0n));
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [ownerAddress, poolFilter, rpc, programId, commitment]);

  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchPositions();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPositions, fetchOnMount]);

  useEffect(() => {
    if (refreshInterval <= 0 || !ownerAddress) {
      return;
    }

    const intervalId = setInterval(fetchPositions, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchPositions, refreshInterval, ownerAddress]);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
  };
}
