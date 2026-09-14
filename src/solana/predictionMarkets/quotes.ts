import { getCurveSwapFeeAmount } from '../initializer/helpers.js';
import { assertU64 } from './validation.js';
/** Independent bonding-curve price; it is not a normalized probability. Reserves exclude pending fees. */
export function quoteBuy(input: {
  amountIn: bigint;
  baseReserve: bigint;
  quoteReserve: bigint;
  virtualBase: bigint;
  virtualQuote: bigint;
  swapFeeBps: number;
  slippageBps?: number;
}) {
  for (const [name, value] of Object.entries(input))
    if (typeof value === 'bigint') assertU64(value, name);
  const slippage = input.slippageBps ?? 50;
  if (!Number.isInteger(slippage) || slippage < 0 || slippage > 10000)
    throw new Error('slippageBps must be an integer from 0 to 10000');
  if (input.amountIn === 0n || input.virtualQuote === 0n)
    throw new Error('Input and virtual quote reserve must be positive');
  const feeAmount = getCurveSwapFeeAmount(input.amountIn, input.swapFeeBps);
  const net = input.amountIn - feeAmount;
  const amountOut =
    ((input.baseReserve + input.virtualBase) * net) /
    (input.quoteReserve + input.virtualQuote + net);
  if (amountOut === 0n || amountOut > input.baseReserve)
    throw new Error('Insufficient curve liquidity or input after fees');
  return {
    amountOut,
    feeAmount,
    minAmountOut: (amountOut * BigInt(10000 - slippage)) / 10000n,
  };
}
