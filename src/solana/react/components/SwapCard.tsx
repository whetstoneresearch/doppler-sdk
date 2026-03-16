/**
 * SwapCard Component
 *
 * Token swap interface with input fields, quote display, and execution.
 */

import { useCallback, useMemo, type ChangeEvent } from 'react';
import type { Address } from '@solana/kit';
import type { Pool } from '../../core/types.js';
import { useSwap } from '../hooks/useSwap.js';
import { usePool } from '../hooks/usePool.js';

/**
 * Token metadata for display
 */
export interface TokenInfo {
  /** Token mint address */
  mint: Address;
  /** Token symbol (e.g., "SOL", "USDC") */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Token icon URL (optional) */
  icon?: string;
}

/**
 * Props for SwapCard component
 */
export interface SwapCardProps {
  /** Pool address to swap on */
  poolAddress: Address;
  /** Pre-fetched pool data (optional) */
  pool?: Pool | null;
  /** Token0 metadata */
  token0: TokenInfo;
  /** Token1 metadata */
  token1: TokenInfo;
  /** User's token0 balance */
  balance0?: bigint;
  /** User's token1 balance */
  balance1?: bigint;
  /** Additional CSS classes */
  className?: string;
  /** Default slippage in basis points */
  defaultSlippageBps?: number;
  /** Callback when swap is executed */
  onSwap?: (params: {
    inputToken: Address;
    outputToken: Address;
    amountIn: bigint;
    minAmountOut: bigint;
  }) => Promise<void>;
  /** Whether swap execution is in progress */
  swapping?: boolean;
  /** Whether the swap button should be disabled */
  disabled?: boolean;
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

  const fracStr = fracPart
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return `${intPart.toLocaleString()}.${fracStr}`;
}

/**
 * Parse a decimal string to bigint with decimals
 */
function parseAmount(value: string, decimals: number): bigint {
  if (!value || value === '0') return 0n;

  const [intPart, fracPart = ''] = value.split('.');
  const paddedFrac = fracPart.slice(0, decimals).padEnd(decimals, '0');

  const intBigInt = BigInt(intPart || '0');
  const fracBigInt = BigInt(paddedFrac);
  const multiplier = 10n ** BigInt(decimals);

  return intBigInt * multiplier + fracBigInt;
}

/**
 * Format percentage for display
 */
function formatPercent(value: number): string {
  if (value < 0.0001) return '<0.01%';
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Swap interface card
 *
 * Provides a complete swap interface with:
 * - Token input/output fields with balance display
 * - Real-time quote calculation
 * - Price impact and fee display
 * - Swap execution button
 *
 * @example
 * ```tsx
 * function SwapPage() {
 *   const handleSwap = async (params) => {
 *     // Build and send swap transaction
 *   };
 *
 *   return (
 *     <SwapCard
 *       poolAddress={poolAddress}
 *       token0={{ mint: sol, symbol: 'SOL', decimals: 9 }}
 *       token1={{ mint: usdc, symbol: 'USDC', decimals: 6 }}
 *       balance0={1000000000n}
 *       balance1={100000000n}
 *       onSwap={handleSwap}
 *       className="max-w-md mx-auto"
 *     />
 *   );
 * }
 * ```
 */
export function SwapCard({
  poolAddress,
  pool: providedPool,
  token0,
  token1,
  balance0 = 0n,
  balance1 = 0n,
  className = '',
  defaultSlippageBps = 50,
  onSwap,
  swapping = false,
  disabled = false,
}: SwapCardProps): JSX.Element {
  // Fetch pool if not provided
  const { pool: fetchedPool, loading: poolLoading } = usePool(
    providedPool ? undefined : poolAddress,
  );
  const pool = providedPool ?? fetchedPool;

  // Initialize swap hook
  const {
    state,
    quote,
    setInputAmount,
    setOutputAmount,
    flipTokens,
    setSlippage,
    canSwap,
  } = useSwap({
    pool,
    token0Mint: token0.mint,
    token1Mint: token1.mint,
    defaultSlippageBps,
  });

  // Determine which token is input/output
  const inputToken = state.inputToken === token0.mint ? token0 : token1;
  const outputToken = state.outputToken === token0.mint ? token0 : token1;
  const inputBalance = state.inputToken === token0.mint ? balance0 : balance1;
  const outputBalance = state.outputToken === token0.mint ? balance0 : balance1;

  // Handle input change
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!/^\d*\.?\d*$/.test(value)) return;
      const amount = parseAmount(value, inputToken.decimals);
      setInputAmount(amount);
    },
    [inputToken.decimals, setInputAmount],
  );

  // Handle output change (exact output mode)
  const handleOutputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!/^\d*\.?\d*$/.test(value)) return;
      const amount = parseAmount(value, outputToken.decimals);
      setOutputAmount(amount);
    },
    [outputToken.decimals, setOutputAmount],
  );

  // Handle max button
  const handleMax = useCallback(() => {
    setInputAmount(inputBalance);
  }, [inputBalance, setInputAmount]);

  // Handle swap button
  const handleSwap = useCallback(async () => {
    if (
      !canSwap ||
      !quote ||
      !state.inputToken ||
      !state.outputToken ||
      !onSwap
    )
      return;

    await onSwap({
      inputToken: state.inputToken,
      outputToken: state.outputToken,
      amountIn: state.exactInput ? state.inputAmount : quote.maxAmountIn,
      minAmountOut: quote.minAmountOut,
    });
  }, [canSwap, quote, state, onSwap]);

  // Handle slippage change
  const handleSlippageChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        setSlippage(Math.round(value * 100));
      }
    },
    [setSlippage],
  );

  // Format display values
  const inputDisplayValue = useMemo(() => {
    if (state.exactInput) {
      return state.inputAmount > 0n
        ? formatAmount(state.inputAmount, inputToken.decimals)
        : '';
    }
    if (quote?.maxAmountIn) {
      return formatAmount(quote.maxAmountIn, inputToken.decimals);
    }
    return '';
  }, [
    state.exactInput,
    state.inputAmount,
    quote?.maxAmountIn,
    inputToken.decimals,
  ]);

  const outputDisplayValue = useMemo(() => {
    if (!state.exactInput) {
      return state.outputAmount > 0n
        ? formatAmount(state.outputAmount, outputToken.decimals)
        : '';
    }
    if (quote?.amountOut) {
      return formatAmount(quote.amountOut, outputToken.decimals);
    }
    return '';
  }, [
    state.exactInput,
    state.outputAmount,
    quote?.amountOut,
    outputToken.decimals,
  ]);

  // Determine button state
  const buttonDisabled =
    disabled || swapping || poolLoading || !canSwap || !onSwap;
  const buttonText = useMemo(() => {
    if (poolLoading) return 'Loading...';
    if (swapping) return 'Swapping...';
    if (!pool) return 'Pool not found';
    if (state.inputAmount === 0n && state.exactInput) return 'Enter amount';
    if (state.outputAmount === 0n && !state.exactInput) return 'Enter amount';
    if (quote?.error) return quote.error;
    if (state.inputAmount > inputBalance && state.exactInput)
      return 'Insufficient balance';
    if (!canSwap) return 'Invalid swap';
    return 'Swap';
  }, [poolLoading, swapping, pool, state, quote, inputBalance, canSwap]);

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Swap</h2>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="slippage" className="text-gray-500">
            Slippage:
          </label>
          <input
            id="slippage"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={(state.slippageBps / 100).toFixed(1)}
            onChange={handleSlippageChange}
            className="w-16 px-2 py-1 border rounded text-center"
            aria-label="Slippage tolerance percentage"
          />
          <span>%</span>
        </div>
      </div>

      {/* Input token */}
      <div className="bg-gray-50 rounded-lg p-3 mb-2">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>From</span>
          <span>
            Balance: {formatAmount(inputBalance, inputToken.decimals)}{' '}
            {inputToken.symbol}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {inputToken.icon && (
              <img
                src={inputToken.icon}
                alt={inputToken.symbol}
                className="w-6 h-6"
              />
            )}
            <span className="font-medium">{inputToken.symbol}</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={inputDisplayValue}
            onChange={handleInputChange}
            className="flex-1 text-right text-xl bg-transparent outline-none"
            aria-label={`Amount of ${inputToken.symbol} to swap`}
          />
          <button
            type="button"
            onClick={handleMax}
            className="text-sm text-blue-500 hover:text-blue-600"
            aria-label="Use maximum balance"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Swap direction button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          type="button"
          onClick={flipTokens}
          className="bg-white border rounded-full p-2 hover:bg-gray-50"
          aria-label="Switch input and output tokens"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 3L7 17M7 17L3 13M7 17L11 13" />
            <path d="M13 17L13 3M13 3L9 7M13 3L17 7" />
          </svg>
        </button>
      </div>

      {/* Output token */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>To</span>
          <span>
            Balance: {formatAmount(outputBalance, outputToken.decimals)}{' '}
            {outputToken.symbol}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {outputToken.icon && (
              <img
                src={outputToken.icon}
                alt={outputToken.symbol}
                className="w-6 h-6"
              />
            )}
            <span className="font-medium">{outputToken.symbol}</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={outputDisplayValue}
            onChange={handleOutputChange}
            className="flex-1 text-right text-xl bg-transparent outline-none"
            aria-label={`Amount of ${outputToken.symbol} to receive`}
          />
        </div>
      </div>

      {/* Quote details */}
      {quote && quote.isValid && (
        <div className="text-sm text-gray-500 space-y-1 mb-4 px-1">
          <div className="flex justify-between">
            <span>Rate</span>
            <span>
              1 {inputToken.symbol} = {quote.executionPrice.toFixed(6)}{' '}
              {outputToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Price Impact</span>
            <span className={quote.priceImpact > 0.03 ? 'text-red-500' : ''}>
              {formatPercent(quote.priceImpact)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Fee</span>
            <span>
              {formatAmount(quote.feeTotal, inputToken.decimals)}{' '}
              {inputToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Minimum received</span>
            <span>
              {formatAmount(quote.minAmountOut, outputToken.decimals)}{' '}
              {outputToken.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Swap button */}
      <button
        type="button"
        onClick={handleSwap}
        disabled={buttonDisabled}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          buttonDisabled
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
        aria-label={buttonText}
      >
        {buttonText}
      </button>
    </div>
  );
}
