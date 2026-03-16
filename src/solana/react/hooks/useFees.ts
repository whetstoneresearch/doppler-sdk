/**
 * useFees Hook
 *
 * Calculates and tracks pending fees for a user's position, with collection capability.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Address } from '@solana/kit';
import type { Position, Pool } from '../../core/types.js';
import { getPendingFees } from '../../core/math.js';
import { fetchPosition } from '../../client/position.js';
import { fetchPool } from '../../client/pool.js';
import {
  createCollectFeesInstruction,
  MAX_FEE_AMOUNT,
} from '../../instructions/collectFees.js';
import {
  appendTransactionMessageInstruction,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit';
import {
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
} from '@solana/kit';
import { getBase64EncodedWireTransaction } from '@solana/kit';
import { useAmm } from '../providers/AmmContext.js';
import { useWalletOptional } from '../providers/WalletContext.js';

/**
 * Transaction status
 */
export type TransactionStatus =
  | 'idle'
  | 'signing'
  | 'sending'
  | 'confirming'
  | 'success'
  | 'error';

/**
 * Pending fees data
 */
export interface PendingFees {
  /** Pending fees in token0 */
  pending0: bigint;
  /** Pending fees in token1 */
  pending1: bigint;
  /** Whether there are any fees to collect */
  hasFees: boolean;
}

/**
 * Options for collecting fees
 */
export interface CollectFeesOptions {
  /** Maximum amount of token0 to collect (default: all) */
  max0?: bigint;
  /** Maximum amount of token1 to collect (default: all) */
  max1?: bigint;
  /** User's token0 account */
  userToken0: Address;
  /** User's token1 account */
  userToken1: Address;
}

/**
 * Result from useFees hook
 */
export interface UseFeesResult {
  /** Pending fees data */
  fees: PendingFees | null;
  /** Whether loading */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually trigger refetch */
  refetch: () => Promise<void>;
  /** Whether a refetch is in progress */
  refetching: boolean;

  // Collection functionality
  /** Collect pending fees */
  collect: (options: CollectFeesOptions) => Promise<string>;
  /** Current transaction status */
  status: TransactionStatus;
  /** Transaction error */
  txError: Error | null;
  /** Last transaction signature */
  txSignature: string | null;
  /** Reset transaction status */
  reset: () => void;
  /** Whether fees can be collected */
  canCollect: boolean;
}

/**
 * Options for useFees hook
 */
export interface UseFeesOptions {
  /** Override auto-refresh interval (ms). Set to 0 to disable. */
  refreshInterval?: number;
  /** Whether to fetch immediately on mount. Default: true */
  fetchOnMount?: boolean;
  /** Commitment level override */
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Pre-fetched pool data */
  pool?: Pool | null;
  /** Pre-fetched position data */
  position?: Position | null;
}

/**
 * Hook to calculate and track pending fees for a position
 *
 * @param positionAddress - Address of the position
 * @param poolAddress - Address of the pool (needed if position not provided)
 * @param options - Optional configuration
 * @returns Pending fees with loading/error states
 *
 * @example
 * ```tsx
 * function PositionFees({ positionAddress, poolAddress }: Props) {
 *   const { fees, loading, refetch } = useFees(positionAddress, poolAddress);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!fees) return <div>No fees data</div>;
 *
 *   return (
 *     <div>
 *       <p>Token0 fees: {fees.pending0.toString()}</p>
 *       <p>Token1 fees: {fees.pending1.toString()}</p>
 *       {fees.hasFees && <button onClick={() => {}}>Collect Fees</button>}
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFees(
  positionAddress: Address | undefined,
  poolAddress: Address | undefined,
  options: UseFeesOptions = {},
): UseFeesResult {
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
    position: providedPosition,
  } = options;

  const [pool, setPool] = useState<Pool | null>(providedPool ?? null);
  const [position, setPosition] = useState<Position | null>(
    providedPosition ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Transaction state
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [txError, setTxError] = useState<Error | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Update from provided data
  useEffect(() => {
    if (providedPool) setPool(providedPool);
    if (providedPosition) setPosition(providedPosition);
  }, [providedPool, providedPosition]);

  // Calculate pending fees
  const fees = useMemo<PendingFees | null>(() => {
    if (!pool || !position) return null;

    const { pending0, pending1 } = getPendingFees(pool, position);

    return {
      pending0,
      pending1,
      hasFees: pending0 > 0n || pending1 > 0n,
    };
  }, [pool, position]);

  const fetchFeesData = useCallback(
    async (isRefetch = false) => {
      // If both pool and position are provided, no need to fetch
      if (providedPool && providedPosition) {
        setLoading(false);
        return;
      }

      if (!positionAddress && !providedPosition) {
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
        // Fetch what we need
        const promises: Promise<any>[] = [];

        if (!providedPosition && positionAddress) {
          promises.push(
            fetchPosition(rpc, positionAddress, { programId, commitment }),
          );
        } else {
          promises.push(Promise.resolve(providedPosition));
        }

        if (!providedPool && poolAddress) {
          promises.push(fetchPool(rpc, poolAddress, { programId, commitment }));
        } else {
          promises.push(Promise.resolve(providedPool));
        }

        const [posData, poolData] = await Promise.all(promises);

        if (mountedRef.current) {
          if (posData && !providedPosition) setPosition(posData);
          if (poolData && !providedPool) setPool(poolData);
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
    [
      positionAddress,
      poolAddress,
      providedPool,
      providedPosition,
      rpc,
      programId,
      commitment,
    ],
  );

  const refetch = useCallback(async () => {
    await fetchFeesData(true);
  }, [fetchFeesData]);

  // Collect fees
  const collect = useCallback(
    async (collectOptions: CollectFeesOptions): Promise<string> => {
      if (
        !pool ||
        !poolAddress ||
        !position ||
        !positionAddress ||
        !wallet?.address
      ) {
        throw new Error('Pool, position, or wallet not available');
      }

      if (!wallet.signer) {
        throw new Error('Wallet signer is not available');
      }

      setStatus('signing');
      setTxError(null);
      setTxSignature(null);

      try {
        const {
          max0 = MAX_FEE_AMOUNT,
          max1 = MAX_FEE_AMOUNT,
          userToken0,
          userToken1,
        } = collectOptions;

        // Build the collect fees instruction
        const ix = createCollectFeesInstruction(
          {
            pool: poolAddress,
            position: positionAddress,
            owner: wallet.address,
            authority: pool.authority,
            vault0: pool.vault0,
            vault1: pool.vault1,
            token0Mint: pool.token0Mint,
            token1Mint: pool.token1Mint,
            user0: userToken0,
            user1: userToken1,
          },
          { max0, max1 },
          programId,
        );

        const { value: latestBlockhash } = await rpc
          .getLatestBlockhash({ commitment })
          .send();

        const baseMessage = createTransactionMessage({ version: 'legacy' });
        const messageWithPayer = setTransactionMessageFeePayerSigner(
          wallet.signer,
          baseMessage,
        );
        const messageWithLifetime = setTransactionMessageLifetimeUsingBlockhash(
          latestBlockhash,
          messageWithPayer,
        );
        const messageWithIx = appendTransactionMessageInstruction(
          ix,
          messageWithLifetime,
        );

        setStatus('sending');

        const signedTransaction =
          await signTransactionMessageWithSigners(messageWithIx);
        const wireTransaction =
          getBase64EncodedWireTransaction(signedTransaction);
        const signature = await rpc
          .sendTransaction(wireTransaction, { encoding: 'base64' })
          .send();

        setStatus('success');
        setTxSignature(signature);

        // Refresh fee data after successful collection
        await fetchFeesData(true);

        return signature;
      } catch (err) {
        setStatus('error');
        const error = err instanceof Error ? err : new Error(String(err));
        setTxError(error);
        throw error;
      }
    },
    [
      pool,
      poolAddress,
      position,
      positionAddress,
      wallet,
      programId,
      rpc,
      commitment,
      fetchFeesData,
    ],
  );

  // Reset transaction status
  const reset = useCallback(() => {
    setStatus('idle');
    setTxError(null);
    setTxSignature(null);
  }, []);

  // Can collect check
  const canCollect = useMemo(() => {
    return !!(
      fees?.hasFees &&
      wallet?.connected &&
      wallet?.signer &&
      pool &&
      position
    );
  }, [fees, wallet, pool, position]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchFeesData(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetchFeesData, fetchOnMount]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchFeesData(true);
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchFeesData, refreshInterval]);

  return {
    fees,
    loading,
    error,
    refetch,
    refetching,
    collect,
    status,
    txError,
    txSignature,
    reset,
    canCollect,
  };
}

/**
 * Hook to calculate fees from pre-fetched data (no RPC calls)
 *
 * @param pool - Pool data
 * @param position - Position data
 * @returns Pending fees
 */
export function useFeesFromData(
  pool: Pool | null | undefined,
  position: Position | null | undefined,
): PendingFees | null {
  return useMemo<PendingFees | null>(() => {
    if (!pool || !position) return null;

    const { pending0, pending1 } = getPendingFees(pool, position);

    return {
      pending0,
      pending1,
      hasFees: pending0 > 0n || pending1 > 0n,
    };
  }, [pool, position]);
}
