import { Address } from "viem";
import { Context } from "ponder:registry";
import { SwapService, SwapData, MarketMetrics } from "./SwapService";
import { SwapType } from "@app/types/shared";
import { updateDayBucket, BucketUpdateParams, get24HourVolume } from "@app/utils/time-buckets";

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
    } = updaters;

    // Update the 24-hour bucket with this swap data
    const bucketParams: BucketUpdateParams = {
      poolAddress: poolData.parentPoolAddress,
      assetAddress: swapData.assetAddress,
      chainId,
      timestamp: swapData.timestamp,
      volumeUsd: metrics.swapValueUsd,
      volumeToken0: swapData.isToken0 ? swapData.amountIn : swapData.amountOut,
      volumeToken1: swapData.isToken0 ? swapData.amountOut : swapData.amountIn,
      price: poolData.price,
      liquidityUsd: metrics.liquidityUsd,
      marketCapUsd: metrics.marketCapUsd,
      isBuy: swapType === "buy",
      userAddress: swapData.sender,
    };

    // Update the bucket first to get the new volume
    await updateDayBucket(context, bucketParams);

    // Get the updated 24-hour volume from bucket
    const volume24h = await get24HourVolume(
      context,
      poolData.parentPoolAddress,
      chainId,
      swapData.timestamp
    );

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
          volume24h: volume24h,
          timestamp: swapData.timestamp,
        }),
      }),

      // Update asset entity
      updateAsset({
        assetAddress: swapData.assetAddress,
        context,
        update: SwapService.formatAssetUpdate(metrics),
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