import { Context } from "ponder:registry";
import { pool, token } from "ponder:schema";
import { Address } from "viem";
import { SwapOrchestrator } from "@app/core";
import { SwapService } from "@app/core";
import { computeV3Price } from "@app/utils";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { computeMarketCap, fetchEthPrice, fetchZoraPrice } from "./oracle";
import { updatePool } from "./entities";
import { chainConfigs } from "@app/config";
import { updateFifteenMinuteBucketUsd } from "@app/utils/time-buckets";
import { SwapType } from "@app/types";
import { CHAINLINK_ETH_DECIMALS, WAD } from "@app/utils/constants";

interface SwapHandlerParams {
  poolAddress: `0x${string}`; // can be 32byte poolid or 20byte pool address
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
  
  let isQuoteCreatorCoin = false;
  let creatorCoinPid = null;
  
  const creatorCoinEntity = await db.find(token, {
    address: poolEntity.quoteToken,
    chainId: chain.id,
  });
  isQuoteCreatorCoin = creatorCoinEntity?.isCreatorCoin ?? false;
  creatorCoinPid = isQuoteCreatorCoin ? creatorCoinEntity?.pool : null;
  
  if (!isQuoteCreatorCoin || !creatorCoinPid) {
    return null;
  }
  
  // Get creator coin pool price
  const creatorCoinPool = await db.find(pool, {
    address: creatorCoinPid as `0x${string}`,
    chainId: chain.id,
  });
  
  if (!creatorCoinPool) {
    return null;
  }
  
  const creatorCoinPrice = computeV3Price({
    sqrtPriceX96: creatorCoinPool.sqrtPrice,
    isToken0: creatorCoinPool.isToken0,
    decimals: 18,
  });
  
  return (creatorCoinPrice * zoraPrice) / WAD;
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
  const price = computeV3Price({
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
    usdPrice) / (isQuoteEth ? CHAINLINK_ETH_DECIMALS : WAD);
  
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
  isZora?: boolean,
): Promise<void> {
  const { context, timestamp } = params;
  const { db, chain } = context;
  const poolAddress = params.poolAddress;

  let zoraPrice, ethPrice, poolEntity;
  if (isZora) {
    [zoraPrice, ethPrice, poolEntity] = await Promise.all([
    fetchZoraPrice(timestamp, context),
    fetchEthPrice(timestamp, context),
    db.find(pool, {
      address: poolAddress,
      chainId: chain.id,
    }),
  ]);
  } else {
    [ethPrice, poolEntity] = await Promise.all([
      fetchEthPrice(timestamp, context),
      db.find(pool, {
        address: poolAddress,
        chainId: chain.id,
      }),
    ]);
  }

  
  if (!poolEntity) {
    return;
  }
  
  // Get USD price efficiently
  const usdPrice = await getPoolUsdPrice(poolEntity, zoraPrice ?? 1n, ethPrice, context);

  if (!usdPrice) {
    return;
  }
  
  const isQuoteEth = poolEntity.quoteToken.toLowerCase() === 
    chainConfigs[chain.name].addresses.shared.weth.toLowerCase();
  
  const swapData = processSwapCalculations(poolEntity, params, usdPrice, isQuoteEth);

  const tokenEntity = await db.find(token, {
    address: poolEntity.baseToken,
    chainId: chain.id,
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
    usdPrice,
  });

  // Create metrics
  const metrics = {
    liquidityUsd: swapData.dollarLiquidity,
    marketCapUsd,
    swapValueUsd: swapData.swapValueUsd,
  };
  
  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateFifteenMinuteBucketUsd,
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
          isQuoteEth
        },
        chainId: chain.id,
        context,
      },
      entityUpdaters
    ),
  ]);
}