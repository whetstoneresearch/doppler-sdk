import {
  ReadContract,
  ReadAdapter,
  Drift,
  EventLog,
  GetEventsOptions,
  createDrift,
  FunctionReturn,
} from "@delvtech/drift";
import { Address } from "viem";
import { uniswapV3PoolAbi } from "../../abis";

export type UniswapV3PoolABI = typeof uniswapV3PoolAbi;

/**
 * A class providing read-only access to a Uniswap V3 pool contract.
 * Enables querying pool state, events, and key parameters including:
 * - Swap, mint, and burn events
 * - Pool slot0 state (current price/tick)
 * - Token addresses
 * - Fee tier
 */
export class ReadUniswapV3Pool {
  /** Underlying contract instance for direct pool interactions */
  pool: ReadContract<UniswapV3PoolABI>;

  /**
   * Create a ReadUniswapV3Pool instance
   * @param address - Contract address of the Uniswap V3 pool
   * @param drift - Drift instance for blockchain interaction (defaults to new instance)
   */
  constructor(address: Address, drift: Drift<ReadAdapter> = createDrift()) {
    this.pool = drift.contract({
      abi: uniswapV3PoolAbi,
      address,
    });
  }

  /**
   * Retrieve Mint events from the pool contract
   * @param options - Optional filters for event retrieval (block range, listener)
   * @returns Array of Mint event logs
   */
  async getMintEvents(
    options?: GetEventsOptions
  ): Promise<EventLog<UniswapV3PoolABI, "Mint">[]> {
    return this.pool.getEvents("Mint", {
      ...options,
    });
  }

  /**
   * Retrieve Burn events from the pool contract
   * @param options - Optional filters for event retrieval (block range, listener)
   * @returns Array of Burn event logs
   */
  async getBurnEvents(
    options?: GetEventsOptions
  ): Promise<EventLog<UniswapV3PoolABI, "Burn">[]> {
    return this.pool.getEvents("Burn", {
      ...options,
    });
  }

  /**
   * Retrieve Swap events from the pool contract
   * @param options - Optional filters for event retrieval (block range, listener)
   * @returns Array of Swap event logs
   */
  async getSwapEvents(
    options?: GetEventsOptions
  ): Promise<EventLog<UniswapV3PoolABI, "Swap">[]> {
    return this.pool.getEvents("Swap", {
      ...options,
    });
  }

  /**
   * Get current pool state including:
   * - sqrtPriceX96: Current sqrt(price) as Q64.96
   * - tick: Current pool tick
   * - observationIndex/observationCardinality: Oracle-related parameters
   * @returns Object containing slot0 state values
   */
  async getSlot0(): Promise<FunctionReturn<UniswapV3PoolABI, "slot0">> {
    return this.pool.read("slot0");
  }

  /**
   * Get address of first token in pool pair
   * @returns Contract address of token0
   */
  async getToken0(): Promise<Address> {
    return this.pool.read("token0");
  }

  /**
   * Get address of second token in pool pair
   * @returns Contract address of token1
   */
  async getToken1(): Promise<Address> {
    return this.pool.read("token1");
  }

  /**
   * Get pool's fee tier
   * @returns Fee percentage represented as an integer (e.g., 3000 = 0.3%)
   */
  async getFee(): Promise<number> {
    return this.pool.read("fee");
  }
}
