import {
  ReadContract,
  ReadAdapter,
  Drift,
  createDrift,
  FunctionReturn,
  FunctionArgs,
} from '@delvtech/drift';
import { Address } from 'viem';
import { v4QuoterAbi } from '../../abis';

/**
 * Type alias for QuoterV2 contract ABI
 */
export type V4QuoterABI = typeof v4QuoterAbi;

/**
 * A read-only interface to the Uniswap V3 QuoterV2 contract that provides:
 * - Price quotes for exact input and output swaps
 * - Formatted amounts with proper decimal handling
 * - Simulation of swap outcomes without executing transactions
 *
 * @example
 * ```typescript
 * const quoter = new ReadQuoter("0x...");
 * const quote = await quoter.quoteExactInput({
 *   tokenIn: "0x...",
 *   tokenOut: "0x...",
 *   amountIn: 1000000n,
 *   fee: 3000,
 *   sqrtPriceLimitX96: 0n
 * });
 * ```
 */
export class ReadQuoter {
  /** Underlying QuoterV2 contract instance */
  quoter: ReadContract<V4QuoterABI>;

  /**
   * Create a ReadQuoter instance
   * @param quoteV2Address - Contract address of the V4 Quoter
   * @param drift - Drift instance for blockchain interaction (defaults to new instance)
   */
  constructor(
    quoteV4Address: Address,
    drift: Drift<ReadAdapter> = createDrift()
  ) {
    this.quoter = drift.contract({
      abi: v4QuoterAbi,
      address: quoteV4Address,
    });
  }

  /**
   * Get a price quote for swapping an exact amount of input tokens
   * @param params - Arguments for the quoteExactInputSingle contract method
   * @param options - Formatting options for the output amount, defaults to 18 decimals
   * @returns Promise resolving to:
   * - Raw contract return values
   */
  async quoteExactInputV4(
    params: FunctionArgs<V4QuoterABI, 'quoteExactInputSingle'>['params']
  ): Promise<FunctionReturn<V4QuoterABI, 'quoteExactInputSingle'>> {
    return await this.quoter.simulateWrite('quoteExactInputSingle', {
      params: { ...params },
    });
  }

  /**
   * Get a price quote for receiving an exact amount of output tokens
   * @param params - Arguments for the quoteExactOutputSingle contract method
   * @param options - Formatting options for the input amount, defaults to 18 decimals
   * @returns Promise resolving to:
   * - Raw contract return values
   */
  async quoteExactOutputV4(
    params: FunctionArgs<V4QuoterABI, 'quoteExactOutputSingle'>['params']
  ): Promise<FunctionReturn<V4QuoterABI, 'quoteExactOutputSingle'>> {
    return await this.quoter.simulateWrite('quoteExactOutputSingle', {
      params: { ...params },
    });
  }
}
