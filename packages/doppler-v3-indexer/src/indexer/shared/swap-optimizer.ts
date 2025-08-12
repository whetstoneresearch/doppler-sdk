import { Context } from "ponder:registry";
import { pool, token } from "ponder:schema";
import { Address } from "viem";
import { tokenCache } from "./cache/token-cache";
import { SwapOrchestrator } from "@app/core";
import { PriceService, SwapService } from "@app/core";
import { computeV3Price } from "@app/utils";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { computeMarketCap } from "./oracle";
import { updatePool, updateAsset } from "./entities";
import { tryAddActivePool } from "./scheduledJobs";
import { upsertTokenWithPool } from "./entities/token-optimized";
import { chainConfigs } from "@app/config";
import { SwapType } from "@app/types";

interface SwapHandlerParams {
  poolKeyHash: Address;
  swapSender: Address;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
  isCoinBuy: boolean;
  timestamp: bigint;
  transactionHash: `0x${string}`;
  transactionFrom: Address;
  blockNumber: bigint;
  context: Context;
}

interface ProcessedSwapData {
  price: bigint;
  dollarLiquidity: bigint;
  marketCapUsd: bigint;
  swapValueUsd: bigint;
  nextReserves0: bigint;
  nextReserves1: bigint;
  fee0: bigint;
  fee1: bigint;
  swapType: SwapType;
  amountIn: bigint;
  amountOut: bigint;
}

/**
 * Get USD price for a pool efficiently using cache
 */
export async function getPoolUsdPrice(
  poolEntity: typeof pool.$inferSelect,
  zoraPrice: bigint,
  ethPrice: bigint,
  context: Context
): Promise<bigint | null> {
  const { db, chain } = context;
  const zoraToken = chainConfigs[chain.name].addresses.zora.zoraToken;
  const wethToken = chainConfigs[chain.name].addresses.shared.weth;
  
  const isQuoteZora = poolEntity.quoteToken.toLowerCase() === zoraToken.toLowerCase();
  const isQuoteEth = poolEntity.quoteToken.toLowerCase() === wethToken.toLowerCase();
  
  if (isQuoteZora) {
    return zoraPrice;
  }
  
  if (isQuoteEth) {
    return ethPrice;
  }
  
  // Check cache for creator coin - DISABLED FOR TESTING
  let isQuoteCreatorCoin = false;
  let creatorCoinPid = null;
  
  // const cached = tokenCache.get(poolEntity.quoteToken);
  // if (cached) {
  //   isQuoteCreatorCoin = cached.isCreatorCoin;
  //   creatorCoinPid = cached.creatorCoinPid;
  // } else {
    const creatorCoinEntity = await db.find(token, {
      address: poolEntity.quoteToken,
    });
    isQuoteCreatorCoin = creatorCoinEntity?.isCreatorCoin ?? false;
    creatorCoinPid = isQuoteCreatorCoin ? creatorCoinEntity?.pool : null;
    // tokenCache.set(poolEntity.quoteToken, isQuoteCreatorCoin, creatorCoinPid || null);
  // }
  
  if (!isQuoteCreatorCoin || !creatorCoinPid) {
    return null;
  }
  
  // Get creator coin pool price
  const creatorCoinPool = await db.find(pool, {
    address: creatorCoinPid as `0x${string}`,
    chainId: BigInt(chain.id),
  });
  
  if (!creatorCoinPool) {
    return null;
  }
  
  const creatorCoinPrice = computeV3Price({
    sqrtPriceX96: creatorCoinPool.sqrtPrice,
    isToken0: creatorCoinPool.isToken0,
    decimals: 18,
  });
  
  return (creatorCoinPrice * zoraPrice) / 10n ** 18n;
}

/**
 * Process swap calculations in batch
 */
export function processSwapCalculations(
  poolEntity: typeof pool.$inferSelect,
  params: SwapHandlerParams,
  usdPrice: bigint,
  isQuoteEth: boolean
): ProcessedSwapData {
  const { amount0, amount1, sqrtPriceX96, isCoinBuy } = params;
  const { isToken0, reserves0, reserves1, fee } = poolEntity;
  
  // Calculate price
  const price = PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });
  
  // Calculate reserves
  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;
  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;
  
  const realQuoteDelta = isCoinBuy ? reserveQuoteDelta : -reserveQuoteDelta;
  const realAssetDelta = isCoinBuy ? -reserveAssetDelta : reserveAssetDelta;
  
  const nextReservesAsset = reserveAssetBefore + realAssetDelta;
  const nextReservesQuote = reserveQuoteBefore + realQuoteDelta;
  
  // Calculate fees
  let amountIn, amountOut, fee0, fee1;
  if (amount0 > 0n) {
    amountIn = amount0;
    amountOut = amount1;
    fee0 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee1 = 0n;
  } else {
    amountIn = amount1;
    amountOut = amount0;
    fee1 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee0 = 0n;
  }
  
  // Determine swap type
  const swapType = SwapService.determineSwapType({
    isToken0,
    amount0,
    amount1,
  });
  
  // Calculate dollar values
  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice: usdPrice,
    decimals: isQuoteEth ? 8 : 18,
  });
  
  const swapValueUsd = ((reserveQuoteDelta < 0n ? -reserveQuoteDelta : reserveQuoteDelta) * 
    usdPrice) / BigInt(10 ** 18);
  
  return {
    price,
    dollarLiquidity,
    marketCapUsd: 0n, // Will be calculated after token fetch
    swapValueUsd,
    nextReserves0: reserves0 - amount0,
    nextReserves1: reserves1 - amount1,
    fee0,
    fee1,
    swapType,
    amountIn,
    amountOut,
  };
}

/**
 * Optimized swap handler for both V4 hooks
 */
export async function handleOptimizedSwap(
  params: SwapHandlerParams,
  zoraPrice: bigint,
  ethPrice: bigint
): Promise<void> {
  const { context, poolKeyHash, timestamp } = params;
  const { db, chain } = context;
  const poolAddress = poolKeyHash.toLowerCase() as `0x${string}`;
  
  // Get pool entity
  const poolEntity = await db.find(pool, {
    address: poolAddress,
    chainId: BigInt(chain.id),
  });
  
  if (!poolEntity) {
    return;
  }
  
  // Get USD price efficiently
  const usdPrice = await getPoolUsdPrice(poolEntity, zoraPrice, ethPrice, context);
  if (!usdPrice) {
    return;
  }
  
  const isQuoteEth = poolEntity.quoteToken.toLowerCase() === 
    chainConfigs[chain.name].addresses.shared.weth.toLowerCase();
  
  // Process all swap calculations
  const swapData = processSwapCalculations(poolEntity, params, usdPrice, isQuoteEth);
  
  // Ensure token exists and get total supply

  const tokenEntity = await db.find(token, {
    address: poolEntity.baseToken,
  });

  if (!tokenEntity) {
    return;
  }
  
  // Calculate market cap
  const marketCapUsd = computeMarketCap({
    price: swapData.price,
    ethPrice: usdPrice,
    totalSupply: tokenEntity.totalSupply,
    decimals: isQuoteEth ? 8 : 18,
  });
  
  // Create swap data for orchestrator
  const orchestratorSwapData = SwapOrchestrator.createSwapData({
    poolAddress,
    sender: params.transactionFrom,
    transactionHash: params.transactionHash,
    transactionFrom: params.transactionFrom,
    blockNumber: params.blockNumber,
    timestamp,
    assetAddress: poolEntity.baseToken,
    quoteAddress: poolEntity.quoteToken,
    isToken0: poolEntity.isToken0,
    amountIn: swapData.amountIn,
    amountOut: swapData.amountOut,
    price: swapData.price,
    ethPriceUSD: usdPrice,
  });
  
  // Create metrics
  const metrics = {
    liquidityUsd: swapData.dollarLiquidity,
    marketCapUsd,
    swapValueUsd: swapData.swapValueUsd,
    percentDayChange: 0,
  };
  
  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
    tryAddActivePool,
  };
  
  // Execute all updates in parallel
  await Promise.all([
    SwapOrchestrator.performSwapUpdates(
      {
        swapData: orchestratorSwapData,
        swapType: swapData.swapType,
        metrics,
        poolData: {
          parentPoolAddress: poolAddress,
          price: swapData.price,
        },
        chainId: BigInt(chain.id),
        context,
      },
      entityUpdaters
    ),
    updatePool({
      poolAddress,
      context,
      update: {
        sqrtPrice: params.sqrtPriceX96,
        totalFee0: poolEntity.totalFee0 + swapData.fee0,
        totalFee1: poolEntity.totalFee1 + swapData.fee1,
        lastRefreshed: timestamp,
        reserves0: swapData.nextReserves0,
        reserves1: swapData.nextReserves1,
        lastSwapTimestamp: timestamp,
      },
    }),
  ]);
}