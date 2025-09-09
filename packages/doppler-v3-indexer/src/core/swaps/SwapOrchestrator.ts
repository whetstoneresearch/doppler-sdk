import { Address } from "viem";
import { Context } from "ponder:registry";
import { SwapService, SwapData, SwapMarketMetrics } from "./SwapService";
import { SwapType } from "@app/types/shared-types";
import { CHAINLINK_ETH_DECIMALS, WAD } from "@app/utils/constants";

/**
 * Orchestrates all entity updates required after a swap
 */
export interface SwapUpdateParams {
  swapData: SwapData;
  swapType: SwapType;
  metrics: SwapMarketMetrics;
  poolData: {
    parentPoolAddress: Address;
    price: bigint;
    isQuoteEth?: boolean;
  };
  chainId: number;
  context: Context;
}

/**
 * Entity update functions that must be provided
 */
export interface EntityUpdaters {
  updatePool: (params: any) => Promise<any>;
  updateFifteenMinuteBucketUsd: (context: Context, params: any) => Promise<any>;
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
    const { swapData, metrics, poolData, chainId, context } = params;
    const {
      updatePool,
      updateFifteenMinuteBucketUsd,
    } = updaters;

    const updates = [
      // Update pool entity
      updatePool({
        poolAddress: poolData.parentPoolAddress,
        context,
        update: SwapService.formatPoolUpdate({
          price: poolData.price,
          liquidityUsd: metrics.liquidityUsd,
          marketCapUsd: metrics.marketCapUsd,
          timestamp: swapData.timestamp,
        }),
      }),
      updateFifteenMinuteBucketUsd(context, {
        poolAddress: poolData.parentPoolAddress,
        chainId,
        timestamp: swapData.timestamp,
        priceUsd: swapData.price * swapData.usdPrice / (poolData.isQuoteEth ? CHAINLINK_ETH_DECIMALS : WAD),
        volumeUsd: metrics.swapValueUsd,
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
    usdPrice: bigint;
  }): SwapData {
    return params;
  }
}