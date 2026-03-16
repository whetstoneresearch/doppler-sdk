/**
 * usePool Hook
 *
 * Fetches and auto-refreshes pool data from the CPMM program.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Address } from '@solana/kit';
import type { Pool } from '../../core/types.js';
import { fetchPool } from '../../client/pool.js';
import { useAmm } from '../providers/AmmContext.js';

/**
 * Pool data with loading state
 */
export interface UsePoolResult {
  /** Pool account data (null if not loaded or not found) */
  pool: Pool | null;
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Error that occurred during fetching */
  error: Error | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Whether a refetch is in progress */
  refetching: boolean;
}

/**
 * Options for usePool hook
 */
export interface UsePoolOptions {
  /** Override auto-refresh interval (ms). Set to 0 to disable. */
  refreshInterval?: number;
  /** Whether to fetch immediately on mount. Default: true */
  fetchOnMount?: boolean;
  /** Commitment level override */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Hook to fetch and auto-refresh pool data
 *
 * @param poolAddress - Address of the pool to fetch
 * @param options - Optional configuration
 * @returns Pool data with loading/error states
 *
 * @example
 * ```tsx
 * function PoolInfo({ poolAddress }: { poolAddress: Address }) {
 *   const { pool, loading, error, refetch } = usePool(poolAddress);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!pool) return <div>Pool not found</div>;
 *
 *   return (
 *     <div>
 *       <p>Reserve 0: {pool.reserve0.toString()}</p>
 *       <p>Reserve 1: {pool.reserve1.toString()}</p>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePool(
  poolAddress: Address | undefined,
  options: UsePoolOptions = {},
): UsePoolResult {
  const {
    rpc,
    programId,
    commitment: defaultCommitment,
    refreshInterval: defaultRefreshInterval,
  } = useAmm();

  const {
    refreshInterval = defaultRefreshInterval,
    fetchOnMount = true,
    commitment = defaultCommitment,
  } = options;

  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetching, setRefetching] = useState(false);

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  const fetchPoolData = useCallback(
    async (isRefetch = false) => {
      if (!poolAddress) {
        setPool(null);
        setLoading(false);
        return;
      }

      if (isRefetch) {
        setRefetching(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const poolData = await fetchPool(rpc, poolAddress, {
          programId,
          commitment,
        });

        if (mountedRef.current) {
          setPool(poolData);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefetching(false);
        }
      }
    },
    [poolAddress, rpc, programId, commitment],
  );

  const refetch = useCallback(async () => {
    await fetchPoolData(true);
  }, [fetchPoolData]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchPoolData(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPoolData, fetchOnMount]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0 || !poolAddress) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchPoolData(true);
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchPoolData, refreshInterval, poolAddress]);

  return {
    pool,
    loading,
    error,
    refetch,
    refetching,
  };
}

/**
 * Hook to fetch multiple pools
 *
 * @param poolAddresses - Array of pool addresses to fetch
 * @param options - Optional configuration
 * @returns Map of pool address to pool data
 */
export function usePools(
  poolAddresses: Address[],
  options: UsePoolOptions = {},
): {
  pools: Map<Address, Pool>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const {
    rpc,
    programId,
    commitment: defaultCommitment,
    refreshInterval: defaultRefreshInterval,
  } = useAmm();

  const {
    refreshInterval = defaultRefreshInterval,
    fetchOnMount = true,
    commitment = defaultCommitment,
  } = options;

  const [pools, setPools] = useState<Map<Address, Pool>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  const fetchPools = useCallback(async () => {
    if (poolAddresses.length === 0) {
      setPools(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        poolAddresses.map((addr) =>
          fetchPool(rpc, addr, { programId, commitment })
            .then((pool) => [addr, pool] as const)
            .catch(() => [addr, null] as const),
        ),
      );

      if (mountedRef.current) {
        const poolMap = new Map<Address, Pool>();
        for (const [addr, pool] of results) {
          if (pool) {
            poolMap.set(addr, pool);
          }
        }
        setPools(poolMap);
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
  }, [poolAddresses, rpc, programId, commitment]);

  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchPools();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPools, fetchOnMount]);

  useEffect(() => {
    if (refreshInterval <= 0 || poolAddresses.length === 0) {
      return;
    }

    const intervalId = setInterval(fetchPools, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchPools, refreshInterval, poolAddresses.length]);

  return {
    pools,
    loading,
    error,
    refetch: fetchPools,
  };
}
