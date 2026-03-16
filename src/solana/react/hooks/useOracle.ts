/**
 * useOracle Hook
 *
 * Fetches oracle data and provides TWAP calculations for CPMM pools.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Address } from '@solana/kit';
import type { OracleState, TwapResult, Pool } from '../../core/types.js';
import {
  fetchOracle,
  getOracleForPool,
  consultTwap,
  getOracleSpotPrices,
  getOracleDeviation,
  getOracleAge,
  isOracleStale,
  getOracleBufferStats,
  comparePoolAndOraclePrices,
  type OracleWithAddress,
} from '../../client/oracle.js';
import { getOracleAddress } from '../../core/pda.js';
import { useAmm } from '../providers/AmmContext.js';

/**
 * Oracle data with computed metrics
 */
export interface UseOracleResult {
  /** Oracle state data (null if not loaded or not initialized) */
  oracle: OracleState | null;
  /** Oracle account address */
  oracleAddress: Address | null;
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Error that occurred during fetching */
  error: Error | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;

  // TWAP calculations
  /** Calculate TWAP for a given window (seconds) */
  twap: (windowSeconds: number) => TwapResult | null;
  /** Current spot prices from oracle */
  spotPrice: { price0: number; price1: number } | null;
  /** Price deviation metrics */
  deviation: { deviation0: number; deviation1: number } | null;

  // Oracle health metrics
  /** Oracle age in seconds */
  age: number | null;
  /** Whether oracle is stale */
  isStale: (maxAgeSeconds: number) => boolean;
  /** Buffer statistics */
  bufferStats: {
    capacity: number;
    filledCount: number;
    currentIndex: number;
    timeSpanSeconds: number;
  } | null;

  // Price comparison
  /** Compare oracle price with pool spot price (requires pool data) */
  compareWithPool: (pool: Pool) => {
    poolPrice0: number;
    oraclePrice0: number;
    divergencePct: number;
  } | null;
}

/**
 * Options for useOracle hook
 */
export interface UseOracleOptions {
  /** Override auto-refresh interval (ms). Set to 0 to disable. */
  refreshInterval?: number;
  /** Whether to fetch immediately on mount. Default: true */
  fetchOnMount?: boolean;
  /** Commitment level override */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Hook to fetch oracle data and calculate TWAPs
 *
 * @param poolAddress - Address of the pool (oracle is derived from pool)
 * @param options - Optional configuration
 * @returns Oracle data with TWAP calculations
 *
 * @example
 * ```tsx
 * function OracleInfo({ poolAddress }: { poolAddress: Address }) {
 *   const { oracle, loading, twap, spotPrice, age, isStale } = useOracle(poolAddress);
 *
 *   if (loading) return <div>Loading oracle...</div>;
 *   if (!oracle) return <div>Oracle not initialized</div>;
 *
 *   const twap5min = twap(300); // 5-minute TWAP
 *
 *   return (
 *     <div>
 *       <p>Spot Price: {spotPrice?.price0.toFixed(6)}</p>
 *       <p>5min TWAP: {twap5min?.price0.toFixed(6)}</p>
 *       <p>Oracle Age: {age}s {isStale(60) && '(STALE)'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOracle(
  poolAddress: Address | undefined,
  options: UseOracleOptions = {}
): UseOracleResult {
  const { rpc, programId, commitment: defaultCommitment, refreshInterval: defaultRefreshInterval } = useAmm();

  const {
    refreshInterval = defaultRefreshInterval,
    fetchOnMount = true,
    commitment = defaultCommitment,
  } = options;

  const [oracle, setOracle] = useState<OracleState | null>(null);
  const [oracleAddress, setOracleAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  const fetchOracleData = useCallback(async () => {
    if (!poolAddress) {
      setOracle(null);
      setOracleAddress(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Derive oracle address from pool
      const [oracleAddr] = await getOracleAddress(poolAddress, programId);
      setOracleAddress(oracleAddr);

      const oracleData = await fetchOracle(rpc, oracleAddr, {
        programId,
        commitment,
      });

      if (mountedRef.current) {
        setOracle(oracleData);
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
  }, [poolAddress, rpc, programId, commitment]);

  const refetch = useCallback(async () => {
    await fetchOracleData();
  }, [fetchOracleData]);

  // TWAP calculation function
  const twap = useCallback(
    (windowSeconds: number): TwapResult | null => {
      if (!oracle || !oracle.initialized) return null;
      return consultTwap(oracle, windowSeconds);
    },
    [oracle]
  );

  // Current spot prices
  const spotPrice = useMemo(() => {
    if (!oracle || !oracle.initialized) return null;
    const prices = getOracleSpotPrices(oracle);
    return { price0: prices.price0, price1: prices.price1 };
  }, [oracle]);

  // Price deviation
  const deviation = useMemo(() => {
    if (!oracle || !oracle.initialized) return null;
    const dev = getOracleDeviation(oracle);
    return { deviation0: dev.deviation0, deviation1: dev.deviation1 };
  }, [oracle]);

  // Oracle age
  const age = useMemo(() => {
    if (!oracle || !oracle.initialized) return null;
    return getOracleAge(oracle);
  }, [oracle]);

  // Stale check function
  const isStaleCheck = useCallback(
    (maxAgeSeconds: number): boolean => {
      if (!oracle || !oracle.initialized) return true;
      return isOracleStale(oracle, maxAgeSeconds);
    },
    [oracle]
  );

  // Buffer stats
  const bufferStats = useMemo(() => {
    if (!oracle || !oracle.initialized) return null;
    const stats = getOracleBufferStats(oracle);
    return {
      capacity: stats.capacity,
      filledCount: stats.filledCount,
      currentIndex: stats.currentIndex,
      timeSpanSeconds: stats.timeSpanSeconds,
    };
  }, [oracle]);

  // Compare with pool function
  const compareWithPool = useCallback(
    (pool: Pool) => {
      if (!oracle || !oracle.initialized) return null;
      return comparePoolAndOraclePrices(pool, oracle);
    },
    [oracle]
  );

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchOracleData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchOracleData, fetchOnMount]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0 || !poolAddress) {
      return;
    }

    const intervalId = setInterval(fetchOracleData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchOracleData, refreshInterval, poolAddress]);

  return {
    oracle,
    oracleAddress,
    loading,
    error,
    refetch,
    twap,
    spotPrice,
    deviation,
    age,
    isStale: isStaleCheck,
    bufferStats,
    compareWithPool,
  };
}

/**
 * Hook to get TWAP for a specific window with automatic updates
 *
 * @param poolAddress - Pool address
 * @param windowSeconds - TWAP window in seconds
 * @param options - Optional configuration
 */
export function useTwap(
  poolAddress: Address | undefined,
  windowSeconds: number,
  options: UseOracleOptions = {}
): {
  twap: TwapResult | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { oracle, loading, error, refetch } = useOracle(poolAddress, options);

  const twap = useMemo(() => {
    if (!oracle || !oracle.initialized) return null;
    return consultTwap(oracle, windowSeconds);
  }, [oracle, windowSeconds]);

  return {
    twap,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch oracle data for multiple pools
 */
export function useOracles(
  poolAddresses: Address[],
  options: UseOracleOptions = {}
): {
  oracles: Map<Address, OracleWithAddress>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { rpc, programId, commitment: defaultCommitment, refreshInterval: defaultRefreshInterval } = useAmm();

  const {
    refreshInterval = defaultRefreshInterval,
    fetchOnMount = true,
    commitment = defaultCommitment,
  } = options;

  const [oracles, setOracles] = useState<Map<Address, OracleWithAddress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  const fetchOracles = useCallback(async () => {
    if (poolAddresses.length === 0) {
      setOracles(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        poolAddresses.map(async (poolAddr) => {
          try {
            const result = await getOracleForPool(rpc, poolAddr, { programId, commitment });
            return [poolAddr, result] as const;
          } catch {
            return [poolAddr, null] as const;
          }
        })
      );

      if (mountedRef.current) {
        const oracleMap = new Map<Address, OracleWithAddress>();
        for (const [poolAddr, oracleData] of results) {
          if (oracleData) {
            oracleMap.set(poolAddr, oracleData);
          }
        }
        setOracles(oracleMap);
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
      fetchOracles();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchOracles, fetchOnMount]);

  useEffect(() => {
    if (refreshInterval <= 0 || poolAddresses.length === 0) {
      return;
    }

    const intervalId = setInterval(fetchOracles, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchOracles, refreshInterval, poolAddresses.length]);

  return {
    oracles,
    loading,
    error,
    refetch: fetchOracles,
  };
}
