/**
 * useLiquidity Hook
 *
 * Provides liquidity quote calculations for adding/removing liquidity.
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  Pool,
  AddLiquidityQuote,
  RemoveLiquidityQuote,
} from '../../core/types.js';
import {
  getAddLiquidityQuote,
  getRemoveLiquidityQuote,
} from '../../core/math.js';
import { BPS_DENOM } from '../../core/constants.js';
import { useAmm } from '../providers/AmmContext.js';

/**
 * Liquidity operation mode
 */
export type LiquidityMode = 'add' | 'remove';

/**
 * Add liquidity state
 */
export interface AddLiquidityState {
  /** Amount of token0 to deposit */
  amount0: bigint;
  /** Amount of token1 to deposit */
  amount1: bigint;
  /** Slippage tolerance in basis points */
  slippageBps: number;
}

/**
 * Remove liquidity state
 */
export interface RemoveLiquidityState {
  /** Shares to burn */
  shares: bigint;
  /** Percentage of position to remove (0-100) */
  percentage: number;
  /** Slippage tolerance in basis points */
  slippageBps: number;
}

/**
 * Add liquidity quote with computed fields
 */
export interface AddLiquidityQuoteResult extends AddLiquidityQuote {
  /** Minimum shares to receive (after slippage) */
  minSharesOut: bigint;
  /** Whether the quote is valid */
  isValid: boolean;
  /** Error message if invalid */
  error: string | null;
}

/**
 * Remove liquidity quote with computed fields
 */
export interface RemoveLiquidityQuoteResult extends RemoveLiquidityQuote {
  /** Minimum token0 to receive (after slippage) */
  minAmount0Out: bigint;
  /** Minimum token1 to receive (after slippage) */
  minAmount1Out: bigint;
  /** Whether the quote is valid */
  isValid: boolean;
  /** Error message if invalid */
  error: string | null;
}

/**
 * Result from useLiquidity hook
 */
export interface UseLiquidityResult {
  /** Current mode (add or remove) */
  mode: LiquidityMode;
  /** Set mode */
  setMode: (mode: LiquidityMode) => void;

  // Add liquidity
  /** Add liquidity state */
  addState: AddLiquidityState;
  /** Add liquidity quote */
  addQuote: AddLiquidityQuoteResult | null;
  /** Set amount0 for add */
  setAmount0: (amount: bigint) => void;
  /** Set amount1 for add */
  setAmount1: (amount: bigint) => void;
  /** Whether can add liquidity */
  canAdd: boolean;

  // Remove liquidity
  /** Remove liquidity state */
  removeState: RemoveLiquidityState;
  /** Remove liquidity quote */
  removeQuote: RemoveLiquidityQuoteResult | null;
  /** Set shares for remove */
  setShares: (shares: bigint) => void;
  /** Set percentage for remove (calculates shares from position) */
  setPercentage: (percentage: number) => void;
  /** Whether can remove liquidity */
  canRemove: boolean;

  /** Set slippage tolerance */
  setSlippage: (bps: number) => void;
  /** Reset all state */
  reset: () => void;
}

/**
 * Options for useLiquidity hook
 */
export interface UseLiquidityOptions {
  /** Pool to add/remove liquidity from */
  pool: Pool | null;
  /** User's current position shares (for remove percentage calculation) */
  userShares?: bigint;
  /** Initial slippage tolerance in basis points (default: 50 = 0.5%) */
  defaultSlippageBps?: number;
  /** Initial mode */
  defaultMode?: LiquidityMode;
}

/**
 * Hook for liquidity quote calculation and state management
 *
 * @param options - Configuration options
 * @returns Liquidity state and helpers
 *
 * @example
 * ```tsx
 * function LiquidityInterface({ pool, position }) {
 *   const {
 *     mode,
 *     setMode,
 *     addState,
 *     addQuote,
 *     setAmount0,
 *     removeState,
 *     removeQuote,
 *     setPercentage,
 *   } = useLiquidity({
 *     pool,
 *     userShares: position?.shares,
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={() => setMode('add')}>Add</button>
 *       <button onClick={() => setMode('remove')}>Remove</button>
 *
 *       {mode === 'add' && addQuote && (
 *         <div>Shares out: {addQuote.sharesOut.toString()}</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLiquidity(options: UseLiquidityOptions): UseLiquidityResult {
  const { defaultSlippageBps: contextSlippage } = useAmm();
  const {
    pool,
    userShares = 0n,
    defaultSlippageBps = contextSlippage ?? 50,
    defaultMode = 'add',
  } = options;

  const [mode, setMode] = useState<LiquidityMode>(defaultMode);

  const [addState, setAddState] = useState<AddLiquidityState>({
    amount0: 0n,
    amount1: 0n,
    slippageBps: defaultSlippageBps,
  });

  const [removeState, setRemoveState] = useState<RemoveLiquidityState>({
    shares: 0n,
    percentage: 0,
    slippageBps: defaultSlippageBps,
  });

  // Calculate add liquidity quote
  const addQuote = useMemo<AddLiquidityQuoteResult | null>(() => {
    if (!pool) {
      return null;
    }

    if (addState.amount0 === 0n && addState.amount1 === 0n) {
      return {
        sharesOut: 0n,
        amount0: 0n,
        amount1: 0n,
        poolShare: 0,
        minSharesOut: 0n,
        isValid: false,
        error: null,
      };
    }

    try {
      const quote = getAddLiquidityQuote(
        pool,
        addState.amount0,
        addState.amount1,
      );

      // Calculate min shares with slippage
      const slippageFactor = BPS_DENOM - BigInt(addState.slippageBps);
      const minSharesOut = (quote.sharesOut * slippageFactor) / BPS_DENOM;

      return {
        ...quote,
        minSharesOut,
        isValid: quote.sharesOut > 0n,
        error: null,
      };
    } catch (err) {
      return {
        sharesOut: 0n,
        amount0: 0n,
        amount1: 0n,
        poolShare: 0,
        minSharesOut: 0n,
        isValid: false,
        error: err instanceof Error ? err.message : 'Failed to calculate quote',
      };
    }
  }, [pool, addState.amount0, addState.amount1, addState.slippageBps]);

  // Calculate remove liquidity quote
  const removeQuote = useMemo<RemoveLiquidityQuoteResult | null>(() => {
    if (!pool) {
      return null;
    }

    if (removeState.shares === 0n) {
      return {
        amount0: 0n,
        amount1: 0n,
        minAmount0Out: 0n,
        minAmount1Out: 0n,
        isValid: false,
        error: null,
      };
    }

    try {
      const quote = getRemoveLiquidityQuote(pool, removeState.shares);

      // Calculate min amounts with slippage
      const slippageFactor = BPS_DENOM - BigInt(removeState.slippageBps);
      const minAmount0Out = (quote.amount0 * slippageFactor) / BPS_DENOM;
      const minAmount1Out = (quote.amount1 * slippageFactor) / BPS_DENOM;

      return {
        ...quote,
        minAmount0Out,
        minAmount1Out,
        isValid: quote.amount0 > 0n || quote.amount1 > 0n,
        error: null,
      };
    } catch (err) {
      return {
        amount0: 0n,
        amount1: 0n,
        minAmount0Out: 0n,
        minAmount1Out: 0n,
        isValid: false,
        error: err instanceof Error ? err.message : 'Failed to calculate quote',
      };
    }
  }, [pool, removeState.shares, removeState.slippageBps]);

  const setAmount0 = useCallback((amount: bigint) => {
    setAddState((s) => ({ ...s, amount0: amount }));
  }, []);

  const setAmount1 = useCallback((amount: bigint) => {
    setAddState((s) => ({ ...s, amount1: amount }));
  }, []);

  const setShares = useCallback(
    (shares: bigint) => {
      setRemoveState((s) => ({
        ...s,
        shares,
        percentage: userShares > 0n ? Number((shares * 100n) / userShares) : 0,
      }));
    },
    [userShares],
  );

  const setPercentage = useCallback(
    (percentage: number) => {
      const clampedPercentage = Math.min(100, Math.max(0, percentage));
      const shares =
        (userShares * BigInt(Math.round(clampedPercentage))) / 100n;
      setRemoveState((s) => ({
        ...s,
        shares,
        percentage: clampedPercentage,
      }));
    },
    [userShares],
  );

  const setSlippage = useCallback((bps: number) => {
    setAddState((s) => ({ ...s, slippageBps: bps }));
    setRemoveState((s) => ({ ...s, slippageBps: bps }));
  }, []);

  const reset = useCallback(() => {
    setAddState({
      amount0: 0n,
      amount1: 0n,
      slippageBps: defaultSlippageBps,
    });
    setRemoveState({
      shares: 0n,
      percentage: 0,
      slippageBps: defaultSlippageBps,
    });
  }, [defaultSlippageBps]);

  const canAdd = useMemo(() => {
    return !!(
      addQuote?.isValid &&
      (addState.amount0 > 0n || addState.amount1 > 0n)
    );
  }, [addQuote, addState]);

  const canRemove = useMemo(() => {
    return !!(
      removeQuote?.isValid &&
      removeState.shares > 0n &&
      removeState.shares <= userShares
    );
  }, [removeQuote, removeState.shares, userShares]);

  return {
    mode,
    setMode,
    addState,
    addQuote,
    setAmount0,
    setAmount1,
    canAdd,
    removeState,
    removeQuote,
    setShares,
    setPercentage,
    canRemove,
    setSlippage,
    reset,
  };
}
