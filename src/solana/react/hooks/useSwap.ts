/**
 * useSwap Hook
 *
 * Provides swap quote calculations and execution for the CPMM program.
 */

import { useState, useCallback, useMemo } from 'react';
import type { Address } from '@solana/kit';
import type { Pool, SwapQuote, SwapDirection } from '../../core/types.js';
import {
  getSwapQuote,
  getSwapQuoteExactOut,
  ratioToNumber,
} from '../../core/math.js';
import { BPS_DENOM } from '../../core/constants.js';
import { useAmm } from '../providers/AmmContext.js';

/**
 * Swap state
 */
export interface SwapState {
  /** Input token address */
  inputToken: Address | null;
  /** Output token address */
  outputToken: Address | null;
  /** Input amount (raw bigint) */
  inputAmount: bigint;
  /** Output amount (raw bigint) */
  outputAmount: bigint;
  /** Whether input is exact (vs exact output) */
  exactInput: boolean;
  /** Slippage tolerance in basis points */
  slippageBps: number;
}

/**
 * Swap quote with additional computed fields
 */
export interface SwapQuoteResult extends SwapQuote {
  /** Minimum output amount (after slippage) */
  minAmountOut: bigint;
  /** Maximum input amount (after slippage, for exact output) */
  maxAmountIn: bigint;
  /** Swap direction (0 = token0->token1, 1 = token1->token0) */
  direction: SwapDirection;
  /** Whether the quote is valid */
  isValid: boolean;
  /** Error message if invalid */
  error: string | null;
}

/**
 * Result from useSwap hook
 */
export interface UseSwapResult {
  /** Current swap state */
  state: SwapState;
  /** Computed quote based on current state */
  quote: SwapQuoteResult | null;
  /** Whether a quote calculation is in progress */
  quoting: boolean;
  /** Set input token */
  setInputToken: (token: Address | null) => void;
  /** Set output token */
  setOutputToken: (token: Address | null) => void;
  /** Set input amount */
  setInputAmount: (amount: bigint) => void;
  /** Set output amount (switches to exact output mode) */
  setOutputAmount: (amount: bigint) => void;
  /** Set slippage tolerance */
  setSlippage: (bps: number) => void;
  /** Swap input and output tokens */
  flipTokens: () => void;
  /** Reset all state */
  reset: () => void;
  /** Whether swap can be executed */
  canSwap: boolean;
}

/**
 * Options for useSwap hook
 */
export interface UseSwapOptions {
  /** Initial slippage tolerance in basis points (default: 50 = 0.5%) */
  defaultSlippageBps?: number;
  /** Pool to swap on */
  pool: Pool | null;
  /** Token0 mint address */
  token0Mint: Address | null;
  /** Token1 mint address */
  token1Mint: Address | null;
}

/**
 * Hook for swap quote calculation and state management
 *
 * @param options - Configuration options
 * @returns Swap state and helpers
 *
 * @example
 * ```tsx
 * function SwapInterface({ pool }: { pool: Pool }) {
 *   const {
 *     state,
 *     quote,
 *     setInputAmount,
 *     setInputToken,
 *     setOutputToken,
 *     flipTokens,
 *   } = useSwap({
 *     pool,
 *     token0Mint: pool.token0Mint,
 *     token1Mint: pool.token1Mint,
 *   });
 *
 *   return (
 *     <div>
 *       <input
 *         type="number"
 *         onChange={(e) => setInputAmount(BigInt(e.target.value))}
 *       />
 *       {quote && (
 *         <div>
 *           Output: {quote.amountOut.toString()}
 *           Price Impact: {(quote.priceImpact * 100).toFixed(2)}%
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSwap(options: UseSwapOptions): UseSwapResult {
  const { defaultSlippageBps: contextSlippage } = useAmm();
  const {
    defaultSlippageBps = contextSlippage ?? 50,
    pool,
    token0Mint,
    token1Mint,
  } = options;

  const [state, setState] = useState<SwapState>({
    inputToken: token0Mint,
    outputToken: token1Mint,
    inputAmount: 0n,
    outputAmount: 0n,
    exactInput: true,
    slippageBps: defaultSlippageBps,
  });

  const [quoting] = useState(false);

  // Calculate swap direction
  const direction = useMemo<SwapDirection | null>(() => {
    if (!token0Mint || !token1Mint || !state.inputToken) return null;
    if (state.inputToken === token0Mint) return 0;
    if (state.inputToken === token1Mint) return 1;
    return null;
  }, [token0Mint, token1Mint, state.inputToken]);

  // Calculate quote
  const quote = useMemo<SwapQuoteResult | null>(() => {
    if (!pool || direction === null) {
      return null;
    }

    if (state.exactInput) {
      if (state.inputAmount === 0n) {
        return {
          amountOut: 0n,
          feeTotal: 0n,
          feeDist: 0n,
          feeComp: 0n,
          priceImpact: 0,
          executionPrice: 0,
          minAmountOut: 0n,
          maxAmountIn: 0n,
          direction,
          isValid: false,
          error: null,
        };
      }

      try {
        const swapQuote = getSwapQuote(pool, state.inputAmount, direction);

        // Calculate min output with slippage
        const slippageFactor = BPS_DENOM - BigInt(state.slippageBps);
        const minAmountOut = (swapQuote.amountOut * slippageFactor) / BPS_DENOM;

        return {
          ...swapQuote,
          minAmountOut,
          maxAmountIn: state.inputAmount,
          direction,
          isValid: swapQuote.amountOut > 0n,
          error: null,
        };
      } catch (err) {
        return {
          amountOut: 0n,
          feeTotal: 0n,
          feeDist: 0n,
          feeComp: 0n,
          priceImpact: 0,
          executionPrice: 0,
          minAmountOut: 0n,
          maxAmountIn: 0n,
          direction,
          isValid: false,
          error:
            err instanceof Error ? err.message : 'Failed to calculate quote',
        };
      }
    } else {
      // Exact output mode
      if (state.outputAmount === 0n) {
        return {
          amountOut: 0n,
          feeTotal: 0n,
          feeDist: 0n,
          feeComp: 0n,
          priceImpact: 0,
          executionPrice: 0,
          minAmountOut: 0n,
          maxAmountIn: 0n,
          direction,
          isValid: false,
          error: null,
        };
      }

      try {
        const { amountIn, feeTotal } = getSwapQuoteExactOut(
          pool,
          state.outputAmount,
          direction,
        );

        // Calculate max input with slippage
        const slippageFactor = BPS_DENOM + BigInt(state.slippageBps);
        const maxAmountIn = (amountIn * slippageFactor) / BPS_DENOM;

        // Get price impact from forward quote
        const forwardQuote = getSwapQuote(pool, amountIn, direction);

        return {
          amountOut: state.outputAmount,
          feeTotal,
          feeDist: 0n, // Not calculated for exact out
          feeComp: 0n,
          priceImpact: forwardQuote.priceImpact,
          executionPrice: ratioToNumber(state.outputAmount, amountIn),
          minAmountOut: state.outputAmount,
          maxAmountIn,
          direction,
          isValid: amountIn > 0n,
          error: null,
        };
      } catch (err) {
        return {
          amountOut: 0n,
          feeTotal: 0n,
          feeDist: 0n,
          feeComp: 0n,
          priceImpact: 0,
          executionPrice: 0,
          minAmountOut: 0n,
          maxAmountIn: 0n,
          direction,
          isValid: false,
          error:
            err instanceof Error ? err.message : 'Failed to calculate quote',
        };
      }
    }
  }, [
    pool,
    direction,
    state.inputAmount,
    state.outputAmount,
    state.exactInput,
    state.slippageBps,
  ]);

  const setInputToken = useCallback((token: Address | null) => {
    setState((s) => ({ ...s, inputToken: token }));
  }, []);

  const setOutputToken = useCallback((token: Address | null) => {
    setState((s) => ({ ...s, outputToken: token }));
  }, []);

  const setInputAmount = useCallback((amount: bigint) => {
    setState((s) => ({
      ...s,
      inputAmount: amount,
      exactInput: true,
    }));
  }, []);

  const setOutputAmount = useCallback((amount: bigint) => {
    setState((s) => ({
      ...s,
      outputAmount: amount,
      exactInput: false,
    }));
  }, []);

  const setSlippage = useCallback((bps: number) => {
    setState((s) => ({ ...s, slippageBps: bps }));
  }, []);

  const flipTokens = useCallback(() => {
    setState((s) => ({
      ...s,
      inputToken: s.outputToken,
      outputToken: s.inputToken,
      inputAmount: s.outputAmount,
      outputAmount: s.inputAmount,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      inputToken: token0Mint,
      outputToken: token1Mint,
      inputAmount: 0n,
      outputAmount: 0n,
      exactInput: true,
      slippageBps: defaultSlippageBps,
    });
  }, [token0Mint, token1Mint, defaultSlippageBps]);

  const canSwap = useMemo(() => {
    return !!(
      quote?.isValid &&
      state.inputToken &&
      state.outputToken &&
      (state.exactInput ? state.inputAmount > 0n : state.outputAmount > 0n)
    );
  }, [quote, state]);

  return {
    state,
    quote,
    quoting,
    setInputToken,
    setOutputToken,
    setInputAmount,
    setOutputAmount,
    setSlippage,
    flipTokens,
    reset,
    canSwap,
  };
}
