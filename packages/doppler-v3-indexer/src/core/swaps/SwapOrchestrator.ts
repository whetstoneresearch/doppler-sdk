import { Address } from "viem";
import { Context } from "ponder:registry";
import { SwapService, SwapData, MarketMetrics } from "./SwapService";
import { SwapType } from "@app/types/shared";

/**
 * Orchestrates all entity updates required after a swap
 */
export interface SwapUpdateParams {
  swapData: SwapData;
  swapType: SwapType;
  metrics: MarketMetrics;
  poolData: {
    parentPoolAddress: Address;
    price: bigint;
    volume24h?: bigint;
  };
  chainId: bigint;
  context: Context;
}

/**
 * Entity update functions that must be provided
 */
export interface EntityUpdaters {
  updatePool: (params: any) => Promise<any>;
  updateAsset: (params: any) => Promise<any>;
  insertSwap: (params: any) => Promise<any>;
  insertOrUpdateBuckets: (params: any) => Promise<any>;
  insertOrUpdateDailyVolume: (params: any) => Promise<any>;
  tryAddActivePool: (params: any) => Promise<any>;
}

/**
 * Orchestrates common swap-related entity updates across all protocols
 */
export class SwapOrchestrator {
  /**
   * Performs all standard entity updates after a swap
   * This consolidates the common update pattern used across V2, V3, and V4
   */
  static async performSwapUpdates(
    params: SwapUpdateParams,
    updaters: EntityUpdaters
  ): Promise<void> {
    const { swapData, swapType, metrics, poolData, chainId, context } = params;
    const {
      updatePool,
      updateAsset,
      insertSwap,
      insertOrUpdateBuckets,
      insertOrUpdateDailyVolume,
      tryAddActivePool,
    } = updaters;

    // Prepare all update operations
    const updates = [
      // Update pool entity
      updatePool({
        poolAddress: poolData.parentPoolAddress,
        context,
        update: SwapService.formatPoolUpdate({
          price: poolData.price,
          liquidityUsd: metrics.liquidityUsd,
          marketCapUsd: metrics.marketCapUsd,
          volume24h: poolData.volume24h ?? 0n,
          timestamp: swapData.timestamp,
        }),
      }),

      // Update asset entity
      updateAsset({
        assetAddress: swapData.assetAddress,
        context,
        update: SwapService.formatAssetUpdate(metrics),
      }),

      // Insert swap record
      insertSwap({
        ...SwapService.formatSwapEntity({
          swapData,
          swapType,
          swapValueUsd: metrics.swapValueUsd,
          chainId,
        }),
        context,
      }),

      // Update time series data
      insertOrUpdateBuckets({
        poolAddress: poolData.parentPoolAddress,
        price: poolData.price,
        timestamp: swapData.timestamp,
        ethPrice: swapData.ethPriceUSD,
        context,
      }),

      // Update daily volume
      insertOrUpdateDailyVolume({
        context,
        poolAddress: poolData.parentPoolAddress,
        amountIn: swapData.amountIn,
        amountOut: swapData.amountOut,
        timestamp: swapData.timestamp,
        tokenIn: swapType === "buy" ? swapData.quoteAddress : swapData.assetAddress,
        tokenOut: swapType === "buy" ? swapData.assetAddress : swapData.quoteAddress,
        ethPrice: swapData.ethPriceUSD,
        marketCapUsd: metrics.marketCapUsd,
      }),

      // Try to add to active pools
      tryAddActivePool({
        poolAddress: poolData.parentPoolAddress,
        lastSwapTimestamp: Number(swapData.timestamp),
        context,
      }),
    ];

    // Execute all updates in parallel
    await Promise.all(updates);
  }

  /**
   * Creates a swap data object from common event parameters
   */
  static createSwapData(params: {
    poolAddress: Address;
    sender: Address;
    transactionHash: `0x${string}`;
    transactionFrom: Address;
    blockNumber: bigint;
    timestamp: bigint;
    assetAddress: Address;
    quoteAddress: Address;
    isToken0: boolean;
    amountIn: bigint;
    amountOut: bigint;
    price: bigint;
    ethPriceUSD: bigint;
  }): SwapData {
    return params;
  }
}