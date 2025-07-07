import { Address } from "viem";
import { Context } from "ponder:registry";
import {
  IV4Adapter,
  V4SwapEventData,
  V4PoolData,
  PoolCreateEventData,
  SwapResult,
  AdapterConfig
} from "./types";
import { SwapService, PriceService } from "@app/core";
import { TickMath } from "@uniswap/v3-sdk";
import { getV4PoolData, getReservesV4 } from "@app/utils/v4-utils/getV4PoolData";
import { insertPoolIfNotExistsV4 } from "@app/entities/pool";
import { insertTokenIfNotExists } from "@app/entities/token";
import { insertAssetIfNotExists } from "@app/entities/asset";
import { insertOrUpdateBuckets, insertOrUpdateDailyVolume } from "@app/indexer/shared/timeseries";
import { fetchEthPrice, computeMarketCap } from "@app/indexer/shared/oracle";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import {
  insertActivePoolsBlobIfNotExists,
} from "@app/indexer/shared/scheduledJobs";
import { insertV4ConfigIfNotExists } from "@app/entities/v4-entities/v4Config";
import { insertV4PoolPriceHistoryIfNotExists } from "@app/entities/v4-entities/v4PoolPriceHistory";
import { insertCheckpointBlobIfNotExist } from "@app/entities/v4-entities/v4CheckpointBlob";

/**
 * V4 Protocol Adapter
 * Handles all V4-specific logic including hooks and advanced features
 */
export class V4Adapter implements IV4Adapter {
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Handle pool creation event
   */
  async handlePoolCreate(
    event: PoolCreateEventData,
    context: Context
  ): Promise<void> {
    const { timestamp } = event;

    // Check if V4 pool data exists
    const v4PoolData = await getV4PoolData({
      hook: event.poolAddress,
      context,
    });

    if (!v4PoolData) {
      throw new Error(`V4 pool data not found for: ${event.poolAddress}`);
    }

    const ethPrice = await fetchEthPrice(timestamp, context);

    // Insert tokens
    const { totalSupply } = await insertTokenIfNotExists({
      tokenAddress: event.assetAddress,
      creatorAddress: event.creatorAddress,
      timestamp,
      context,
      isDerc20: true,
      poolAddress: event.poolAddress,
    });

    await insertTokenIfNotExists({
      tokenAddress: event.numeraireAddress,
      creatorAddress: event.creatorAddress,
      timestamp,
      context,
      isDerc20: false,
    });

    // Initialize V4-specific entities
    await Promise.all([
      insertCheckpointBlobIfNotExist({ context }),
      insertV4PoolPriceHistoryIfNotExists({
        pool: event.poolAddress,
        context,
      }),
      insertActivePoolsBlobIfNotExists({ context }),
    ]);

    // Insert pool with V4-specific handling
    const poolEntity = await insertPoolIfNotExistsV4({
      poolAddress: event.poolAddress,
      timestamp,
      context,
      totalSupply,
    });

    // Insert V4 config
    await insertV4ConfigIfNotExists({
      hookAddress: event.poolAddress,
      context,
    });

    const price = poolEntity.price;
    const marketCapUsd = computeMarketCap({
      price,
      ethPrice,
      totalSupply,
    });

    // Initialize related entities
    await Promise.all([
      insertAssetIfNotExists({
        assetAddress: event.assetAddress,
        timestamp,
        context,
      }),
      insertOrUpdateBuckets({
        poolAddress: event.poolAddress,
        price,
        timestamp,
        ethPrice,
        context,
      }),
      insertOrUpdateDailyVolume({
        poolAddress: event.poolAddress,
        amountIn: 0n,
        amountOut: 0n,
        timestamp,
        context,
        tokenIn: event.assetAddress,
        tokenOut: event.numeraireAddress,
        ethPrice,
        marketCapUsd,
      }),
    ]);
  }

  /**
   * Handle swap event
   */
  async handleSwap(
    event: V4SwapEventData,
    context: Context
  ): Promise<SwapResult> {
    const { timestamp, currentTick, totalProceeds, totalTokensSold } = event;

    // Get V4 pool data
    const v4PoolData = await getV4PoolData({
      hook: event.poolAddress,
      context,
    });

    if (!v4PoolData) {
      throw new Error(`V4 pool data not found for: ${event.poolAddress}`);
    }

    const ethPrice = await fetchEthPrice(timestamp, context);
    const poolData = await this.getPoolData(event.poolAddress, context);

    // Calculate amounts based on proceeds delta
    const quoteIn = totalProceeds > poolData.totalProceeds;
    const amountIn = quoteIn
      ? totalProceeds - poolData.totalProceeds
      : poolData.totalTokensSold - totalTokensSold;
    const amountOut = quoteIn
      ? poolData.totalTokensSold - totalTokensSold
      : poolData.totalProceeds - totalProceeds;

    // Calculate swap type
    const type = SwapService.determineSwapType({
      isToken0: poolData.isToken0,
      amountIn,
      amountOut,
    });

    // Calculate price from tick
    const sqrtPriceX96 = BigInt(TickMath.getSqrtRatioAtTick(currentTick).toString());
    const price = PriceService.computePriceFromSqrtPriceX96({
      sqrtPriceX96,
      isToken0: poolData.isToken0,
      decimals: 18,
    });

    // Calculate swap value in USD
    const swapValueUsd = (amountIn * ethPrice) / CHAINLINK_ETH_DECIMALS;

    return {
      type,
      amountIn,
      amountOut,
      tokenIn: quoteIn ? poolData.quoteToken : poolData.baseToken,
      tokenOut: quoteIn ? poolData.baseToken : poolData.quoteToken,
      price,
      swapValueUsd,
      protocolSpecificData: {
        currentTick,
        totalProceeds,
        totalTokensSold,
        quoteIn,
        v4PoolData,
      },
    };
  }

  /**
   * Get pool data
   */
  async getPoolData(
    poolAddress: Address,
    context: Context
  ): Promise<V4PoolData> {
    // Get pool entity
    const poolEntity = await insertPoolIfNotExistsV4({
      poolAddress,
      timestamp: 0n,
      context,
    });

    // Get reserves
    const reserves = await getReservesV4({
      hook: poolAddress,
      context,
    });

    // Get V4-specific data
    const v4PoolData = await getV4PoolData({
      hook: poolAddress,
      context,
    });

    if (!v4PoolData) {
      throw new Error(`V4 pool data not found for: ${poolAddress}`);
    }

    return {
      isToken0: poolEntity.isToken0,
      baseToken: poolEntity.baseToken,
      quoteToken: poolEntity.quoteToken,
      reserves0: reserves.token0Reserve,
      reserves1: reserves.token1Reserve,
      liquidity: v4PoolData.liquidity,
      price: poolEntity.price,
      currentTick: v4PoolData.slot0Data.tick,
      totalProceeds: poolEntity.totalProceeds || 0n,
      totalTokensSold: poolEntity.totalTokensSold || 0n,
    };
  }

  /**
   * Calculate price from V4 pool data
   */
  calculatePrice(poolData: V4PoolData): bigint {
    const sqrtPriceX96 = BigInt(TickMath.getSqrtRatioAtTick(poolData.currentTick).toString());
    return PriceService.computePriceFromSqrtPriceX96({
      sqrtPriceX96,
      isToken0: poolData.isToken0,
      decimals: 18,
    });
  }
}