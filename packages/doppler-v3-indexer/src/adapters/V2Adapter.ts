import { Address } from "viem";
import { Context } from "ponder:registry";
import {
  IV2Adapter,
  V2SwapEventData,
  V2PoolData,
  PoolCreateEventData,
  SwapResult,
  AdapterConfig
} from "./types";
import { SwapService, PriceService } from "@app/core";
import { getPairData } from "@app/utils/v2-utils/getPairData";
import { insertPoolIfNotExists, insertTokenIfNotExists } from "@app/entities";
import { insertAssetIfNotExists } from "@app/entities/asset";
import { insertOrUpdateBuckets, insertOrUpdateDailyVolume } from "@app/indexer/shared/timeseries";
import { fetchEthPrice, computeMarketCap } from "@app/indexer/shared/oracle";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { insertActivePoolsBlobIfNotExists } from "@app/indexer/shared/scheduledJobs";
import { v2Pool } from "ponder.schema";

/**
 * V2 Protocol Adapter
 * Handles all V2-specific logic for pool creation, swaps, and data retrieval
 */
export class V2Adapter implements IV2Adapter {
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
    const ethPrice = await fetchEthPrice(timestamp, context);

    // Insert pool entity
    const { price } = await insertPoolIfNotExists({
      poolAddress: event.poolAddress,
      context,
      timestamp,
      ethPrice,
    });

    // Insert tokens
    const { totalSupply } = await insertTokenIfNotExists({
      tokenAddress: event.assetAddress,
      creatorAddress: event.creatorAddress,
      timestamp,
      context,
      isDerc20: true,
    });

    await insertTokenIfNotExists({
      tokenAddress: event.numeraireAddress,
      creatorAddress: event.creatorAddress,
      timestamp,
      context,
      isDerc20: false,
    });

    // Calculate initial market cap
    const marketCapUsd = computeMarketCap({
      price,
      ethPrice,
      totalSupply,
    });

    // Initialize related entities
    await Promise.all([
      insertActivePoolsBlobIfNotExists({ context }),
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
    event: V2SwapEventData,
    context: Context
  ): Promise<SwapResult> {
    const { db } = context;
    const { timestamp } = event;
    const { amount0In, amount1In, amount0Out, amount1Out } = event;

    // Get V2 pool data
    const v2PoolData = await db.find(v2Pool, { address: event.poolAddress });
    if (!v2PoolData) {
      throw new Error(`V2 pool not found: ${event.poolAddress}`);
    }

    const parentPool = v2PoolData.parentPool.toLowerCase() as Address;
    const poolData = await this.getPoolData(event.poolAddress, context);
    const ethPrice = await fetchEthPrice(timestamp, context);

    // Determine swap direction
    const amountIn = amount0In > 0 ? amount0In : amount1In;
    const amountOut = amount0Out > 0 ? amount0Out : amount1Out;

    const tokenIn = amount0In > 0 ? poolData.token0 : poolData.token1;
    const tokenOut = amount0In > 0 ? poolData.token1 : poolData.token0;

    // Calculate swap type
    const type = SwapService.determineSwapType({
      isToken0: poolData.isToken0,
      amountIn: amount0In,
      amountOut: amount0Out,
    });

    // Calculate swap value in USD
    let quoteDelta = 0n;
    if (poolData.isToken0) {
      quoteDelta = amount1In > 0n ? amount1In : amount1Out;
    } else {
      quoteDelta = amount0In > 0n ? amount0In : amount0Out;
    }
    const swapValueUsd = (quoteDelta * ethPrice) / CHAINLINK_ETH_DECIMALS;

    return {
      type,
      amountIn,
      amountOut,
      tokenIn,
      tokenOut,
      price: poolData.price,
      swapValueUsd,
      protocolSpecificData: {
        parentPool,
        v2PoolAddress: event.poolAddress,
      },
    };
  }

  /**
   * Get pool data
   */
  async getPoolData(
    poolAddress: Address,
    context: Context
  ): Promise<V2PoolData> {
    const { db } = context;

    // Get V2 pool entity
    const v2PoolEntity = await db.find(v2Pool, { address: poolAddress });
    if (!v2PoolEntity) {
      throw new Error(`V2 pool not found: ${poolAddress}`);
    }

    // Get parent pool data
    const parentPool = v2PoolEntity.parentPool.toLowerCase() as Address;
    const poolEntity = await insertPoolIfNotExists({
      poolAddress: parentPool,
      timestamp: 0n, // Will use existing data
      context,
      ethPrice: 0n, // Will use existing data
    });

    // Get reserves from pair contract
    const { reserve0, reserve1 } = await getPairData({
      address: poolAddress,
      context
    });

    // Calculate price
    const assetBalance = poolEntity.isToken0 ? reserve0 : reserve1;
    const quoteBalance = poolEntity.isToken0 ? reserve1 : reserve0;
    const price = this.calculatePrice({
      ...poolEntity,
      reserves0: reserve0,
      reserves1: reserve1
    });

    return {
      isToken0: poolEntity.isToken0,
      baseToken: poolEntity.baseToken,
      quoteToken: poolEntity.quoteToken,
      token0: poolEntity.isToken0 ? poolEntity.baseToken : poolEntity.quoteToken,
      token1: poolEntity.isToken0 ? poolEntity.quoteToken : poolEntity.baseToken,
      reserves0: reserve0,
      reserves1: reserve1,
      liquidity: quoteBalance,
      price,
    };
  }

  /**
   * Calculate price based on V2 formula
   */
  calculatePrice(poolData: PoolData): bigint {
    const assetBalance = poolData.isToken0 ? poolData.reserves0 : poolData.reserves1;
    const quoteBalance = poolData.isToken0 ? poolData.reserves1 : poolData.reserves0;

    return PriceService.computePriceFromReserves({ assetBalance, quoteBalance });
  }
}