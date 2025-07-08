import {
  ReadContract,
  ReadAdapter,
  Drift,
  createDrift,
  FunctionReturn,
} from '@delvtech/drift';
import { Address, Hex, encodePacked, keccak256 } from 'viem';
import { poolManagerAbi, stateViewAbi } from '@/abis';
import { PoolKey } from '@/types';

type PoolManagerABI = typeof poolManagerAbi;
type StateViewABI = typeof stateViewAbi;

export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

export interface TickInfo {
  liquidityGross: bigint;
  liquidityNet: bigint;
  feeGrowthOutside0X128: bigint;
  feeGrowthOutside1X128: bigint;
}

/**
 * A read-only interface for interacting with standard Uniswap V4 pools.
 *
 * The ReadV4Pool class provides methods to query state from V4 pools that exist
 * within the PoolManager singleton contract. This is used for pools that have
 * graduated from Doppler's price discovery mechanism to standard V4 AMM pools.
 *
 * @example
 * ```typescript
 * const poolKey = {
 *   currency0: '0x...',
 *   currency1: '0x...',
 *   fee: 3000,
 *   tickSpacing: 60,
 *   hooks: '0x...' // V4MigratorHook address
 * };
 * 
 * const pool = new ReadV4Pool(
 *   poolManagerContract,
 *   stateViewContract,
 *   poolKey
 * );
 * 
 * const currentPrice = await pool.getCurrentPrice();
 * const liquidity = await pool.getLiquidity();
 * ```
 */
export class ReadV4Pool {
  /** The Drift adapter instance used for contract interactions */
  drift: Drift<ReadAdapter>;
  /** Read contract instance for the PoolManager */
  poolManager: ReadContract<PoolManagerABI>;
  /** Read contract instance for the StateView contract */
  stateView: ReadContract<StateViewABI>;
  /** The PoolKey that identifies this pool */
  poolKey: PoolKey;
  /** The computed pool ID (32-byte hash of PoolKey) */
  poolId: Hex;

  constructor(
    poolManager: ReadContract<PoolManagerABI>,
    stateView: ReadContract<StateViewABI>,
    poolKey: PoolKey,
    drift: Drift<ReadAdapter> = createDrift()
  ) {
    this.drift = drift;
    this.poolManager = poolManager;
    this.stateView = stateView;
    this.poolKey = poolKey;
    this.poolId = this.computePoolId();
  }

  /**
   * Computes the pool ID from the PoolKey components.
   * Pool IDs in V4 are the keccak256 hash of the encoded PoolKey.
   */
  private computePoolId(): Hex {
    // Sort tokens to ensure consistent pool ID
    const [currency0, currency1] = this.sortCurrencies(
      this.poolKey.currency0,
      this.poolKey.currency1
    );

    return keccak256(
      encodePacked(
        ['address', 'address', 'uint24', 'uint24', 'address'],
        [currency0, currency1, this.poolKey.fee, this.poolKey.tickSpacing, this.poolKey.hooks]
      )
    );
  }

  /**
   * Sorts two currency addresses according to V4 conventions.
   */
  private sortCurrencies(
    currency0: Address,
    currency1: Address
  ): [Address, Address] {
    return currency0.toLowerCase() < currency1.toLowerCase()
      ? [currency0, currency1]
      : [currency1, currency0];
  }

  /**
   * Returns the computed pool ID.
   */
  getPoolId(): Hex {
    return this.poolId;
  }

  /**
   * Returns the PoolKey for this pool.
   */
  getPoolKey(): PoolKey {
    return this.poolKey;
  }

  /**
   * Returns the current pool state (slot0).
   */
  async getSlot0(): Promise<FunctionReturn<StateViewABI, "getSlot0">> {
    return await this.stateView.read("getSlot0", {
      poolId: this.poolId,
    });
  }

  /**
   * Returns the total liquidity in the pool.
   */
  async getLiquidity(): Promise<FunctionReturn<StateViewABI, "getLiquidity">> {
    return await this.stateView.read("getLiquidity", {
      poolId: this.poolId,
    });
  }

  /**
   * Returns information about a specific tick.
   */
  async getTickInfo(tick: number): Promise<FunctionReturn<StateViewABI, "getTickInfo">> {
    return await this.stateView.read("getTickInfo", {
      poolId: this.poolId,
      tick,
    });
  }

  /**
   * Returns the first currency (token0) address.
   */
  getCurrency0(): Address {
    return this.poolKey.currency0;
  }

  /**
   * Returns the second currency (token1) address.
   */
  getCurrency1(): Address {
    return this.poolKey.currency1;
  }

  /**
   * Returns the pool fee in hundredths of a bip.
   */
  getFee(): number {
    return this.poolKey.fee;
  }

  /**
   * Returns the tick spacing for this pool.
   */
  getTickSpacing(): number {
    return this.poolKey.tickSpacing;
  }

  /**
   * Returns the hooks contract address for this pool.
   */
  getHooks(): Address {
    return this.poolKey.hooks;
  }

  /**
   * Returns the current sqrt price (X96 format).
   */
  async getSqrtPriceX96(): Promise<bigint> {
    const slot0 = await this.getSlot0();
    return slot0.sqrtPriceX96;
  }

  /**
   * Returns the current tick.
   */
  async getCurrentTick(): Promise<number> {
    const slot0 = await this.getSlot0();
    return slot0.tick;
  }

  /**
   * Calculates and returns the current price as a ratio of token1/token0.
   * This is the raw price without decimal adjustment.
   */
  async getCurrentPrice(): Promise<bigint> {
    const sqrtPriceX96 = await this.getSqrtPriceX96();
    // Price = (sqrtPriceX96 / 2^96)^2
    // To maintain precision, we calculate: (sqrtPriceX96^2) / 2^192
    const price = (sqrtPriceX96 * sqrtPriceX96) / (1n << 192n);
    return price;
  }
}