/**
 * LiquidityPanel Component
 *
 * Interface for adding and removing liquidity from a pool.
 */

import { useState, useCallback, useMemo, type ChangeEvent } from 'react';
import type { Address } from '@solana/kit';
import type { Pool, Position } from '../../core/types.js';
import { useLiquidity, type LiquidityMode } from '../hooks/useLiquidity.js';
import { usePool } from '../hooks/usePool.js';
import type { TokenInfo } from './SwapCard.js';

/**
 * Props for LiquidityPanel component
 */
export interface LiquidityPanelProps {
  /** Pool address */
  poolAddress: Address;
  /** Pre-fetched pool data (optional) */
  pool?: Pool | null;
  /** User's position in this pool (optional) */
  position?: Position | null;
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
  /** Initial mode */
  defaultMode?: LiquidityMode;
  /** Callback when liquidity is added */
  onAddLiquidity?: (params: {
    amount0Max: bigint;
    amount1Max: bigint;
    minSharesOut: bigint;
  }) => Promise<void>;
  /** Callback when liquidity is removed */
  onRemoveLiquidity?: (params: {
    sharesIn: bigint;
    minAmount0Out: bigint;
    minAmount1Out: bigint;
  }) => Promise<void>;
  /** Whether operation is in progress */
  processing?: boolean;
  /** Whether the panel should be disabled */
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
 * Liquidity panel with add/remove tabs
 *
 * Provides a complete liquidity interface with:
 * - Tabs to switch between add and remove modes
 * - Token amount inputs with balance display
 * - Share calculation and pool share preview
 * - Slippage settings
 *
 * @example
 * ```tsx
 * function LiquidityPage() {
 *   const handleAdd = async (params) => {
 *     // Build and send add liquidity transaction
 *   };
 *
 *   const handleRemove = async (params) => {
 *     // Build and send remove liquidity transaction
 *   };
 *
 *   return (
 *     <LiquidityPanel
 *       poolAddress={poolAddress}
 *       token0={{ mint: sol, symbol: 'SOL', decimals: 9 }}
 *       token1={{ mint: usdc, symbol: 'USDC', decimals: 6 }}
 *       position={userPosition}
 *       onAddLiquidity={handleAdd}
 *       onRemoveLiquidity={handleRemove}
 *     />
 *   );
 * }
 * ```
 */
export function LiquidityPanel({
  poolAddress,
  pool: providedPool,
  position,
  token0,
  token1,
  balance0 = 0n,
  balance1 = 0n,
  className = '',
  defaultSlippageBps = 50,
  defaultMode = 'add',
  onAddLiquidity,
  onRemoveLiquidity,
  processing = false,
  disabled = false,
}: LiquidityPanelProps): JSX.Element {
  // Fetch pool if not provided
  const { pool: fetchedPool, loading: poolLoading } = usePool(
    providedPool ? undefined : poolAddress,
  );
  const pool = providedPool ?? fetchedPool;

  // User shares from position
  const userShares = position?.shares ?? 0n;

  // Initialize liquidity hook
  const {
    mode,
    setMode,
    addState,
    addQuote,
    setAmount0,
    setAmount1,
    canAdd,
    removeState,
    removeQuote,
    setPercentage,
    canRemove,
    setSlippage,
    reset,
  } = useLiquidity({
    pool,
    userShares,
    defaultSlippageBps,
    defaultMode,
  });

  // Input values for controlled inputs
  const [amount0Input, setAmount0Input] = useState('');
  const [amount1Input, setAmount1Input] = useState('');

  // Handle amount0 change
  const handleAmount0Change = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!/^\d*\.?\d*$/.test(value)) return;
      setAmount0Input(value);
      const amount = parseAmount(value, token0.decimals);
      setAmount0(amount);
    },
    [token0.decimals, setAmount0],
  );

  // Handle amount1 change
  const handleAmount1Change = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!/^\d*\.?\d*$/.test(value)) return;
      setAmount1Input(value);
      const amount = parseAmount(value, token1.decimals);
      setAmount1(amount);
    },
    [token1.decimals, setAmount1],
  );

  // Handle max buttons
  const handleMax0 = useCallback(() => {
    setAmount0Input(formatAmount(balance0, token0.decimals));
    setAmount0(balance0);
  }, [balance0, token0.decimals, setAmount0]);

  const handleMax1 = useCallback(() => {
    setAmount1Input(formatAmount(balance1, token1.decimals));
    setAmount1(balance1);
  }, [balance1, token1.decimals, setAmount1]);

  // Handle percentage slider for remove
  const handlePercentageChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      setPercentage(value);
    },
    [setPercentage],
  );

  // Handle quick percentage buttons
  const handleQuickPercentage = useCallback(
    (percent: number) => {
      setPercentage(percent);
    },
    [setPercentage],
  );

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

  // Handle add liquidity
  const handleAdd = useCallback(async () => {
    if (!canAdd || !addQuote || !onAddLiquidity) return;

    await onAddLiquidity({
      amount0Max: addQuote.amount0,
      amount1Max: addQuote.amount1,
      minSharesOut: addQuote.minSharesOut,
    });
  }, [canAdd, addQuote, onAddLiquidity]);

  // Handle remove liquidity
  const handleRemove = useCallback(async () => {
    if (!canRemove || !removeQuote || !onRemoveLiquidity) return;

    await onRemoveLiquidity({
      sharesIn: removeState.shares,
      minAmount0Out: removeQuote.minAmount0Out,
      minAmount1Out: removeQuote.minAmount1Out,
    });
  }, [canRemove, removeQuote, removeState.shares, onRemoveLiquidity]);

  // Handle mode switch
  const handleModeChange = useCallback(
    (newMode: LiquidityMode) => {
      setMode(newMode);
      reset();
      setAmount0Input('');
      setAmount1Input('');
    },
    [setMode, reset],
  );

  // Button state for add
  const addButtonDisabled =
    disabled || processing || poolLoading || !canAdd || !onAddLiquidity;
  const addButtonText = useMemo(() => {
    if (poolLoading) return 'Loading...';
    if (processing) return 'Processing...';
    if (!pool) return 'Pool not found';
    if (addState.amount0 === 0n && addState.amount1 === 0n)
      return 'Enter amounts';
    if (addQuote?.error) return addQuote.error;
    if (addState.amount0 > balance0) return 'Insufficient token0 balance';
    if (addState.amount1 > balance1) return 'Insufficient token1 balance';
    if (!canAdd) return 'Invalid amounts';
    return 'Add Liquidity';
  }, [
    poolLoading,
    processing,
    pool,
    addState,
    addQuote,
    balance0,
    balance1,
    canAdd,
  ]);

  // Button state for remove
  const removeButtonDisabled =
    disabled || processing || poolLoading || !canRemove || !onRemoveLiquidity;
  const removeButtonText = useMemo(() => {
    if (poolLoading) return 'Loading...';
    if (processing) return 'Processing...';
    if (!pool) return 'Pool not found';
    if (userShares === 0n) return 'No position';
    if (removeState.shares === 0n) return 'Select amount';
    if (removeQuote?.error) return removeQuote.error;
    if (!canRemove) return 'Invalid amount';
    return 'Remove Liquidity';
  }, [
    poolLoading,
    processing,
    pool,
    userShares,
    removeState.shares,
    removeQuote,
    canRemove,
  ]);

  const currentSlippage =
    mode === 'add' ? addState.slippageBps : removeState.slippageBps;

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      {/* Tabs */}
      <div className="flex mb-4 border-b">
        <button
          type="button"
          onClick={() => handleModeChange('add')}
          className={`flex-1 py-2 font-medium transition-colors ${
            mode === 'add'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-selected={mode === 'add'}
          role="tab"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('remove')}
          className={`flex-1 py-2 font-medium transition-colors ${
            mode === 'remove'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-selected={mode === 'remove'}
          role="tab"
        >
          Remove
        </button>
      </div>

      {/* Slippage setting */}
      <div className="flex justify-end items-center gap-2 text-sm mb-4">
        <label htmlFor="liq-slippage" className="text-gray-500">
          Slippage:
        </label>
        <input
          id="liq-slippage"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={(currentSlippage / 100).toFixed(1)}
          onChange={handleSlippageChange}
          className="w-16 px-2 py-1 border rounded text-center"
          aria-label="Slippage tolerance percentage"
        />
        <span>%</span>
      </div>

      {/* Add Liquidity Panel */}
      {mode === 'add' && (
        <>
          {/* Token0 input */}
          <div className="bg-gray-50 rounded-lg p-3 mb-2">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>{token0.symbol}</span>
              <span>Balance: {formatAmount(balance0, token0.decimals)}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount0Input}
                onChange={handleAmount0Change}
                className="flex-1 text-xl bg-transparent outline-none"
                aria-label={`Amount of ${token0.symbol} to deposit`}
              />
              <button
                type="button"
                onClick={handleMax0}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Plus indicator */}
          <div className="flex justify-center text-gray-400 my-1">+</div>

          {/* Token1 input */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>{token1.symbol}</span>
              <span>Balance: {formatAmount(balance1, token1.decimals)}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount1Input}
                onChange={handleAmount1Change}
                className="flex-1 text-xl bg-transparent outline-none"
                aria-label={`Amount of ${token1.symbol} to deposit`}
              />
              <button
                type="button"
                onClick={handleMax1}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Quote details */}
          {addQuote && addQuote.isValid && (
            <div className="text-sm text-gray-500 space-y-1 mb-4 px-1">
              <div className="flex justify-between">
                <span>Shares to receive</span>
                <span>{formatShares(addQuote.sharesOut)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pool share</span>
                <span>{formatPercent(addQuote.poolShare)}</span>
              </div>
              <div className="flex justify-between">
                <span>Minimum shares</span>
                <span>{formatShares(addQuote.minSharesOut)}</span>
              </div>
            </div>
          )}

          {/* Add button */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={addButtonDisabled}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              addButtonDisabled
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {addButtonText}
          </button>
        </>
      )}

      {/* Remove Liquidity Panel */}
      {mode === 'remove' && (
        <>
          {/* Current position info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-sm text-gray-500 mb-2">Your Position</div>
            <div className="text-xl font-medium">
              {formatShares(userShares)} shares
            </div>
          </div>

          {/* Percentage slider */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Amount to remove</span>
              <span>{removeState.percentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={removeState.percentage}
              onChange={handlePercentageChange}
              className="w-full"
              aria-label="Percentage of position to remove"
            />
            {/* Quick select buttons */}
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map((percent) => (
                <button
                  key={percent}
                  type="button"
                  onClick={() => handleQuickPercentage(percent)}
                  className={`flex-1 py-1 text-sm rounded ${
                    removeState.percentage === percent
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          {/* Output preview */}
          {removeQuote && removeQuote.isValid && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-sm text-gray-500 mb-2">You will receive</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>{token0.symbol}</span>
                  <span className="font-medium">
                    {formatAmount(removeQuote.amount0, token0.decimals)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{token1.symbol}</span>
                  <span className="font-medium">
                    {formatAmount(removeQuote.amount1, token1.decimals)}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Min: {formatAmount(removeQuote.minAmount0Out, token0.decimals)}{' '}
                {token0.symbol} /{' '}
                {formatAmount(removeQuote.minAmount1Out, token1.decimals)}{' '}
                {token1.symbol}
              </div>
            </div>
          )}

          {/* Remove button */}
          <button
            type="button"
            onClick={handleRemove}
            disabled={removeButtonDisabled}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              removeButtonDisabled
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {removeButtonText}
          </button>
        </>
      )}
    </div>
  );
}
