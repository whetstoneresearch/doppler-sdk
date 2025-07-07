import { Address } from "viem";
import { Context } from "ponder:registry";
import {
  IV3Adapter,
  V3SwapEventData,
  V3PoolData,
  PoolCreateEventData,
  SwapResult,
  AdapterConfig,
  BaseEventData
} from "./types";
import { SwapService, PriceService } from "@app/core";
import { computeGraduationThresholdDelta } from "@app/utils/v3-utils/computeGraduationThreshold";
import { insertPoolIfNotExists, insertTokenIfNotExists } from "@app/entities";
import { insertAssetIfNotExists } from "@app/entities/asset";
import { insertOrUpdateBuckets, insertOrUpdateDailyVolume } from "@app/indexer/shared/timeseries";
import { fetchEthPrice, computeMarketCap } from "@app/indexer/shared/oracle";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { insertActivePoolsBlobIfNotExists } from "@app/indexer/shared/scheduledJobs";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "@app/entities/position";
import { position } from "ponder:schema";


/**
 * V3 Protocol Adapter
 * Handles all V3-specific logic including concentrated liquidity
 */
export class V3Adapter implements IV3Adapter {
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
    event: V3SwapEventData,
    context: Context
  ): Promise<SwapResult> {
    const { timestamp } = event;
    const { amount0, amount1, sqrtPriceX96 } = event;

    const ethPrice = await fetchEthPrice(timestamp, context);
    const poolData = await this.getPoolData(event.poolAddress, context);

    // Calculate price from sqrtPriceX96
    const price = PriceService.computePriceFromSqrtPriceX96({
      sqrtPriceX96,
      isToken0: poolData.isToken0,
      decimals: 18,
    });

    // Determine swap amounts and direction
    let amountIn: bigint;
    let amountOut: bigint;
    let fee0 = 0n;
    let fee1 = 0n;

    if (amount0 > 0n) {
      amountIn = amount0;
      amountOut = amount1;
      fee0 = (amountIn * BigInt(poolData.fee)) / BigInt(1_000_000);
    } else {
      amountIn = amount1;
      amountOut = amount0;
      fee1 = (amountIn * BigInt(poolData.fee)) / BigInt(1_000_000);
    }

    // Calculate swap type
    const type = SwapService.determineSwapType({
      isToken0: poolData.isToken0,
      amountIn: amount0,
      amountOut: amount1,
    });

    // Calculate quote delta for swap value
    const quoteDelta = poolData.isToken0 ? amount1 - fee1 : amount0 - fee0;
    const swapValueUsd = (quoteDelta < 0n ? -quoteDelta : quoteDelta) * ethPrice / CHAINLINK_ETH_DECIMALS;

    return {
      type,
      amountIn,
      amountOut,
      tokenIn: amount0 > 0n ? poolData.baseToken : poolData.quoteToken,
      tokenOut: amount0 > 0n ? poolData.quoteToken : poolData.baseToken,
      price,
      swapValueUsd,
      protocolSpecificData: {
        sqrtPriceX96,
        tick: event.tick,
        liquidity: event.liquidity,
        fee0,
        fee1,
        quoteDelta,
      },
    };
  }

  /**
   * Get pool data
   */
  async getPoolData(
    poolAddress: Address,
    context: Context
  ): Promise<V3PoolData> {
    const poolEntity = await insertPoolIfNotExists({
      poolAddress,
      timestamp: 0n,
      context,
      ethPrice: 0n,
    });

    // V3 specific fields with defaults
    return {
      isToken0: poolEntity.isToken0,
      baseToken: poolEntity.baseToken,
      quoteToken: poolEntity.quoteToken,
      reserves0: poolEntity.reserves0 || 0n,
      reserves1: poolEntity.reserves1 || 0n,
      liquidity: poolEntity.liquidity || 0n,
      price: poolEntity.price,
      sqrtPriceX96: poolEntity.sqrtPrice || 0n,
      tick: poolEntity.tick || 0,
      fee: poolEntity.fee || 3000,
      totalFee0: poolEntity.totalFee0 || 0n,
      totalFee1: poolEntity.totalFee1 || 0n,
      graduationBalance: poolEntity.graduationBalance || 0n,
    };
  }

  /**
   * Calculate price from V3 pool data
   */
  calculatePrice(poolData: V3PoolData): bigint {
    return PriceService.computePriceFromSqrtPriceX96({
      sqrtPriceX96: poolData.sqrtPriceX96,
      isToken0: poolData.isToken0,
      decimals: 18,
    });
  }

  /**
   * Handle mint event (liquidity addition)
   */
  async handleMint(
    event: BaseEventData & {
      chainId: number;
      tickLower: number;
      tickUpper: number;
      amount: bigint;
      amount0: bigint;
      amount1: bigint;
    },
    context: Context
  ): Promise<void> {
    const { address: poolAddress, tickLower, tickUpper, amount, chainId, transactionFrom } = event;

    // Insert or update position
    await insertPositionIfNotExists({
      poolAddress,
      tickLower,
      tickUpper,
      context,
      owner: transactionFrom,
      liquidity: amount,
      timestamp: event.timestamp,
    });

    // Get current position
    const positionEntity = await context.db.find(position, {
      pool: poolAddress,
      tickLower,
      tickUpper,
      chainId: BigInt(chainId),
    });

    if (positionEntity) {
      await updatePosition({
        poolAddress,
        tickLower,
        tickUpper,
        context,
        update: {
          liquidity: positionEntity.liquidity + amount,
        },
      });
    }

    // Update pool reserves and liquidity
    const poolData = await this.getPoolData(poolAddress, context);
    const ethPrice = await fetchEthPrice(event.timestamp, context);

    const graduationThresholdDelta = await computeGraduationThresholdDelta({
      tickLower,
      tickUpper,
      liquidity: amount,
      isToken0: poolData.isToken0,
    });

    // Additional pool updates would be handled by the main indexer
  }

  /**
   * Handle burn event (liquidity removal)
   */
  async handleBurn(
    event: BaseEventData & {
      chainId: number;
      tickLower: number;
      tickUpper: number;
      amount: bigint;
      amount0: bigint;
      amount1: bigint;
    },
    context: Context
  ): Promise<void> {
    const { address: poolAddress, tickLower, tickUpper, amount, chainId } = event;

    // Get current position
    const positionEntity = await context.db.find(position, {
      pool: poolAddress,
      tickLower,
      tickUpper,
      chainId: BigInt(chainId),
    });

    if (positionEntity) {
      await updatePosition({
        poolAddress,
        tickLower,
        tickUpper,
        context,
        update: {
          liquidity: positionEntity.liquidity - amount,
        },
      });
    }

    // Additional pool updates would be handled by the main indexer
  }
}