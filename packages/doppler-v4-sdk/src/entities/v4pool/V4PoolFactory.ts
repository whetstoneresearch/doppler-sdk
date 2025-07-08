import {
  ReadAdapter,
  ReadWriteAdapter,
  Drift,
  createDrift,
} from '@delvtech/drift';
import { Address, Hex } from 'viem';
import { poolManagerAbi, stateViewAbi } from '@/abis';
import { PoolKey } from '@/types';
import { ReadV4Pool } from './ReadV4Pool';
import { ReadWriteV4Pool } from './ReadWriteV4Pool';
import { buildPoolKey } from '@/utils/v4pool/poolKey';

/**
 * Factory class for creating V4 pool instances.
 * 
 * Provides convenient methods to instantiate ReadV4Pool and ReadWriteV4Pool
 * objects from various inputs like PoolKey, pool ID, or token addresses.
 * 
 * @example
 * ```typescript
 * // From PoolKey
 * const pool = V4PoolFactory.fromPoolKey(
 *   poolKey,
 *   poolManagerAddress,
 *   stateViewAddress
 * );
 * 
 * // From tokens
 * const pool = V4PoolFactory.fromTokens(
 *   token0,
 *   token1,
 *   3000, // 0.3% fee
 *   60,   // tick spacing
 *   v4MigratorHook,
 *   poolManagerAddress,
 *   stateViewAddress
 * );
 * ```
 */
export class V4PoolFactory {
  /**
   * Creates a ReadV4Pool instance from a PoolKey.
   * 
   * @param poolKey The PoolKey identifying the pool
   * @param poolManagerAddress Address of the PoolManager contract
   * @param stateViewAddress Address of the StateView contract
   * @param drift Optional Drift instance for contract interactions
   * @returns A new ReadV4Pool instance
   */
  static fromPoolKey(
    poolKey: PoolKey,
    poolManagerAddress: Address,
    stateViewAddress: Address,
    drift: Drift<ReadAdapter> = createDrift()
  ): ReadV4Pool {
    const driftInstance = drift || createDrift({});

    const poolManager = driftInstance.contract({
      abi: poolManagerAbi,
      address: poolManagerAddress,
    });

    const stateView = driftInstance.contract({
      abi: stateViewAbi,
      address: stateViewAddress,
    });

    return new ReadV4Pool(poolManager, stateView, poolKey, driftInstance);
  }

  /**
   * Creates a ReadWriteV4Pool instance from a PoolKey.
   * 
   * @param poolKey The PoolKey identifying the pool
   * @param poolManagerAddress Address of the PoolManager contract
   * @param stateViewAddress Address of the StateView contract
   * @param drift Optional Drift instance for contract interactions
   * @returns A new ReadWriteV4Pool instance
   */
  static fromPoolKeyWrite(
    poolKey: PoolKey,
    poolManagerAddress: Address,
    stateViewAddress: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ): ReadWriteV4Pool {
    const poolManager = drift.contract({
      abi: poolManagerAbi,
      address: poolManagerAddress,
    });

    const stateView = drift.contract({
      abi: stateViewAbi,
      address: stateViewAddress,
    });

    return new ReadWriteV4Pool(poolManager, stateView, poolKey, drift);
  }

  /**
   * Creates a ReadV4Pool instance from individual token parameters.
   * 
   * @param token0 Address of the first token
   * @param token1 Address of the second token
   * @param fee Fee tier in hundredths of a bip
   * @param tickSpacing Tick spacing for the pool
   * @param hooks Address of the hooks contract (e.g., V4MigratorHook)
   * @param poolManagerAddress Address of the PoolManager contract
   * @param stateViewAddress Address of the StateView contract
   * @param drift Optional Drift instance for contract interactions
   * @returns A new ReadV4Pool instance
   */
  static fromTokens(
    token0: Address,
    token1: Address,
    fee: number,
    tickSpacing: number,
    hooks: Address,
    poolManagerAddress: Address,
    stateViewAddress: Address,
    drift?: Drift<ReadAdapter>
  ): ReadV4Pool {
    const poolKey = buildPoolKey({
      currency0: token0,
      currency1: token1,
      fee,
      tickSpacing,
      hooks,
    });

    return this.fromPoolKey(poolKey, poolManagerAddress, stateViewAddress, drift);
  }

  /**
   * Creates a ReadWriteV4Pool instance from individual token parameters.
   * 
   * @param token0 Address of the first token
   * @param token1 Address of the second token
   * @param fee Fee tier in hundredths of a bip
   * @param tickSpacing Tick spacing for the pool
   * @param hooks Address of the hooks contract (e.g., V4MigratorHook)
   * @param poolManagerAddress Address of the PoolManager contract
   * @param stateViewAddress Address of the StateView contract
   * @param drift Optional Drift instance for contract interactions
   * @returns A new ReadWriteV4Pool instance
   */
  static fromTokensWrite(
    token0: Address,
    token1: Address,
    fee: number,
    tickSpacing: number,
    hooks: Address,
    poolManagerAddress: Address,
    stateViewAddress: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ): ReadWriteV4Pool {
    const poolKey = buildPoolKey({
      currency0: token0,
      currency1: token1,
      fee,
      tickSpacing,
      hooks,
    });

    return this.fromPoolKeyWrite(poolKey, poolManagerAddress, stateViewAddress, drift);
  }

  /**
   * Creates a ReadV4Pool instance from a pool ID by querying the indexer.
   * This is an async method as it needs to fetch the PoolKey components.
   * 
   * Note: This requires an indexer API endpoint to be configured.
   * 
   * @param poolId The 32-byte pool ID
   * @param poolManagerAddress Address of the PoolManager contract
   * @param stateViewAddress Address of the StateView contract
   * @param indexerUrl URL of the indexer GraphQL endpoint
   * @param drift Optional Drift instance for contract interactions
   * @returns A new ReadV4Pool instance
   */
  static async fromPoolId(
    poolId: Hex,
    poolManagerAddress: Address,
    stateViewAddress: Address,
    indexerUrl: string,
    drift?: Drift<ReadAdapter>
  ): Promise<ReadV4Pool> {
    // Query the indexer for pool details
    // This would require implementing a GraphQL query to fetch v4pools by poolId
    // For now, this is a placeholder that shows the intended interface

    throw new Error(
      'fromPoolId requires indexer integration. Use fromPoolKey or fromTokens instead.'
    );

    // Future implementation would:
    // 1. Query indexer for v4pools where poolId matches
    // 2. Extract PoolKey components from result
    // 3. Call fromPoolKey with the reconstructed PoolKey
  }

  /**
   * Creates a ReadV4Pool instance for a graduated Doppler pool.
   * This is specifically for pools that have migrated from Doppler to standard V4.
   * 
   * @param assetAddress Address of the Doppler asset token
   * @param quoteAddress Address of the quote token (usually WETH)
   * @param poolManagerAddress Address of the PoolManager contract
   * @param stateViewAddress Address of the StateView contract
   * @param v4MigratorHookAddress Address of the V4MigratorHook
   * @param drift Optional Drift instance for contract interactions
   * @returns A new ReadV4Pool instance
   */
  static forGraduatedPool(
    assetAddress: Address,
    quoteAddress: Address,
    poolManagerAddress: Address,
    stateViewAddress: Address,
    v4MigratorHookAddress: Address,
    drift?: Drift<ReadAdapter>
  ): ReadV4Pool {
    // Graduated pools typically use standard fee and tick spacing
    const GRADUATED_POOL_FEE = 3000; // 0.3%
    const GRADUATED_POOL_TICK_SPACING = 60;

    return this.fromTokens(
      assetAddress,
      quoteAddress,
      GRADUATED_POOL_FEE,
      GRADUATED_POOL_TICK_SPACING,
      v4MigratorHookAddress,
      poolManagerAddress,
      stateViewAddress,
      drift
    );
  }
}