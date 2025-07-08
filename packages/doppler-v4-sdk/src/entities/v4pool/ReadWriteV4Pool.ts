import {
  ReadWriteContract,
  ReadContract,
  Drift,
  createDrift,
  ReadWriteAdapter,
} from '@delvtech/drift';
import { Address, Hex } from 'viem';
import { poolManagerAbi, stateViewAbi } from '@/abis';
import { PoolKey } from '@/types';
import { ReadV4Pool } from './ReadV4Pool';

type PoolManagerABI = typeof poolManagerAbi;
type StateViewABI = typeof stateViewAbi;

export interface SwapParams {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96?: bigint;
  recipient?: Address;
  hookData?: Hex;
}

export interface ModifyLiquidityParams {
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  salt?: Hex;
}

export interface DonateParams {
  amount0: bigint;
  amount1: bigint;
}

/**
 * A read-write interface for interacting with standard Uniswap V4 pools.
 *
 * The ReadWriteV4Pool class extends ReadV4Pool to provide methods for executing
 * swaps, managing liquidity, and performing other write operations on V4 pools.
 *
 * @example
 * ```typescript
 * const pool = new ReadWriteV4Pool(
 *   poolManagerContract,
 *   stateViewContract,
 *   poolKey
 * );
 * 
 * // Execute a swap
 * await pool.swap({
 *   zeroForOne: true,
 *   amountSpecified: parseEther('1'),
 *   sqrtPriceLimitX96: 0n
 * });
 * 
 * // Add liquidity
 * await pool.modifyLiquidity({
 *   tickLower: -60,
 *   tickUpper: 60,
 *   liquidityDelta: parseEther('100')
 * });
 * ```
 */
export class ReadWriteV4Pool extends ReadV4Pool {
  drift: Drift<ReadWriteAdapter>;
  poolManager: ReadWriteContract<PoolManagerABI>;
  poolKey: PoolKey;

  constructor(
    poolManager: ReadWriteContract<PoolManagerABI>,
    stateView: ReadContract<StateViewABI>,
    poolKey: PoolKey,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    // Pass the poolManager as ReadContract to parent class
    super(poolManager as any, stateView, poolKey, drift as any);

    this.poolKey = poolKey;
    this.poolManager = poolManager;
    this.drift = drift;
  }

  /**
   * Executes a swap on the V4 pool.
   * 
   * @param params Swap parameters
   * @returns Transaction receipt
   */
  async swap(params: SwapParams): Promise<Hex> {
    const swapParams = {
      zeroForOne: params.zeroForOne,
      amountSpecified: params.amountSpecified,
      sqrtPriceLimitX96: params.sqrtPriceLimitX96 || 0n,
    };

    // V4 swaps are executed through the PoolManager's swap function
    return await this.poolManager.write("swap", {
      key: this.poolKey,
      params: swapParams,
      hookData: params.hookData || '0x', // Empty hook data for standard pools
    });
  }

  /**
   * Modifies liquidity in the pool (add or remove).
   * 
   * @param params Liquidity modification parameters
   * @returns Transaction receipt
   */
  async modifyLiquidity(params: ModifyLiquidityParams): Promise<Hex> {
    const modifyLiquidityParams = {
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      liquidityDelta: params.liquidityDelta,
      salt: params.salt || '0x0000000000000000000000000000000000000000000000000000000000000000',
    };

    // V4 liquidity modifications go through the PoolManager
    return await this.poolManager.write("modifyLiquidity", {
      key: this.poolKey,
      params: modifyLiquidityParams,
      hookData: '0x', // Hook data
    });
  }

  /**
   * Adds liquidity to the pool.
   * This is a convenience method that calls modifyLiquidity with positive delta.
   * 
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to add
   * @param salt Optional salt for position identification
   * @returns Transaction receipt
   */
  async addLiquidity(
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    salt?: Hex
  ): Promise<Hex> {
    return this.modifyLiquidity({
      tickLower,
      tickUpper,
      liquidityDelta: liquidity,
      salt,
    });
  }

  /**
   * Removes liquidity from the pool.
   * This is a convenience method that calls modifyLiquidity with negative delta.
   * 
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to remove
   * @param salt Optional salt for position identification
   * @returns Transaction receipt
   */
  async removeLiquidity(
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    salt?: Hex
  ): Promise<Hex> {
    return this.modifyLiquidity({
      tickLower,
      tickUpper,
      liquidityDelta: -liquidity,
      salt,
    });
  }

  /**
   * Donates tokens to the pool.
   * This increases the pool's liquidity without minting positions.
   * 
   * @param params Donation parameters
   * @returns Transaction receipt
   */
  async donate(params: DonateParams): Promise<Hex> {
    return await this.poolManager.write("donate", {
      key: this.poolKey,
      amount0: params.amount0,
      amount1: params.amount1,
      hookData: '0x', // Hook data
    });
  }

  /**
   * Initializes a new V4 pool with the given sqrt price.
   * This can only be called once per pool.
   * 
   * @param sqrtPriceX96 Initial sqrt price in X96 format
   * @param hookData Optional data to pass to hooks
   * @returns Transaction receipt
   */
  async initialize(
    sqrtPriceX96: bigint,
    hookData?: Hex
  ): Promise<Hex> {
    return await this.poolManager.write("initialize", {
      key: this.poolKey,
      sqrtPriceX96,
      hookData: hookData || '0x',
    });
  }

  /**
   * Takes tokens from the pool (requires permission).
   * This is typically used by hooks or other authorized contracts.
   * 
   * @param currency Address of the currency to take
   * @param recipient Address to receive the tokens
   * @param amount Amount to take
   * @returns Transaction receipt
   */
  async take(
    currency: Address,
    recipient: Address,
    amount: bigint
  ): Promise<Hex> {
    return await this.poolManager.write("take", {
      amount,
      currency,
      to: recipient,
    });

  }

  /**
   * Settles tokens with the pool.
   * This is typically used after take operations.
   * 
   * @returns Transaction receipt
   */
  async settle(): Promise<Hex> {
    return await this.poolManager.write("settle");
  }
}