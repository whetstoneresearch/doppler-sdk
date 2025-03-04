import { ponder } from "ponder:registry";
import { getV3PoolData } from "@app/utils/v3-utils";
import { computeGraduationThresholdDelta } from "@app/utils/v3-utils/computeGraduationThreshold";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "./shared/entities/position";
import { insertTokenIfNotExists } from "./shared/entities/token";
import {
  insertOrUpdateDailyVolume,
  update24HourPriceChange,
} from "./shared/timeseries";
import { insertPoolIfNotExists, updatePool } from "./shared/entities/pool";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertOrUpdateBuckets } from "./shared/timeseries";
import { getV3PoolReserves } from "@app/utils/v3-utils/getV3PoolData";
import { fetchEthPrice, updateMarketCap } from "./shared/oracle";
import { Hex } from "viem";

ponder.on("UniswapV3Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;

  await insertTokenIfNotExists({
    tokenAddress: numeraire,
    timestamp: event.block.timestamp,
    context,
    isDerc20: false,
  });

  await insertTokenIfNotExists({
    tokenAddress: assetId,
    timestamp: event.block.timestamp,
    context,
    isDerc20: true,
    poolAddress: poolOrHook,
  });

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const poolEntity = await insertPoolIfNotExists({
    poolAddress: poolOrHook,
    timestamp: event.block.timestamp,
    context,
  });

  await insertAssetIfNotExists({
    assetAddress: assetId,
    timestamp: event.block.timestamp,
    context,
  });

  if (ethPrice) {
    await insertOrUpdateBuckets({
      poolAddress: poolOrHook,
      price: poolEntity.price,
      timestamp: event.block.timestamp,
      ethPrice,
      context,
    });

    await insertOrUpdateDailyVolume({
      poolAddress: poolOrHook,
      amountIn: 0n,
      amountOut: 0n,
      timestamp: event.block.timestamp,
      context,
      tokenIn: assetId,
      tokenOut: numeraire,
      ethPrice,
    });
  }
});

ponder.on("UniswapV3Pool:Mint", async ({ event, context }) => {
  const address = event.log.address;
  const { tickLower, tickUpper, amount, owner } = event.args;

  const poolEntity = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp: event.block.timestamp,
    context,
  });

  const { reserve0, reserve1 } = await getV3PoolReserves({
    address,
    token0: poolEntity.isToken0 ? poolEntity.baseToken : poolEntity.quoteToken,
    token1: poolEntity.isToken0 ? poolEntity.quoteToken : poolEntity.baseToken,
    context,
  });

  const assetBalance = poolEntity.isToken0 ? reserve0 : reserve1;
  const quoteBalance = poolEntity.isToken0 ? reserve1 : reserve0;

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  let dollarLiquidity;
  if (ethPrice) {
    dollarLiquidity = await computeDollarLiquidity({
      assetBalance,
      quoteBalance,
      price: poolEntity.price,
      ethPrice,
    });
  }

  const graduationThresholdDelta = await computeGraduationThresholdDelta({
    poolAddress: address,
    context,
    tickLower,
    tickUpper,
    liquidity: amount,
    isToken0: poolEntity.isToken0,
  });

  await updatePool({
    poolAddress: address,
    context,
    update: dollarLiquidity
      ? {
        graduationThreshold:
          poolEntity.graduationThreshold + graduationThresholdDelta,
        liquidity: poolEntity.liquidity + amount,
        dollarLiquidity: dollarLiquidity,
      }
      : {
        graduationThreshold:
          poolEntity.graduationThreshold + graduationThresholdDelta,
        liquidity: poolEntity.liquidity + amount,
      },
  });

  if (ethPrice) {
    await updateMarketCap({
      assetAddress: poolEntity.baseToken,
      price: poolEntity.price,
      ethPrice,
      context,
    });
  }

  await updateAsset({
    assetAddress: poolEntity.baseToken,
    context,
    update: {
      liquidityUsd: dollarLiquidity ?? 0n,
    },
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp: event.block.timestamp,
    context,
  });

  if (positionEntity.createdAt != event.block.timestamp) {
    await updatePosition({
      poolAddress: address,
      tickLower,
      tickUpper,
      context,
      update: {
        liquidity: positionEntity.liquidity + amount,
      },
    });
  }
});

ponder.on("UniswapV3Pool:Burn", async ({ event, context }) => {
  const address = event.log.address;
  const { tickLower, tickUpper, owner, amount } = event.args;

  const poolEntity = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp: event.block.timestamp,
    context,
  });

  const { liquidity, price, reserve0, reserve1, token0, poolState } =
    await getV3PoolData({
      address,
      context,
    });

  const assetBalance = poolEntity.isToken0 ? reserve0 : reserve1;
  const quoteBalance = poolEntity.isToken0 ? reserve1 : reserve0;

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  let dollarLiquidity;
  if (ethPrice) {
    dollarLiquidity = await computeDollarLiquidity({
      assetBalance,
      quoteBalance,
      price,
      ethPrice,
    });
    await updateMarketCap({
      assetAddress: poolEntity.baseToken,
      price,
      ethPrice,
      context,
    });
    await updateAsset({
      assetAddress: poolEntity.baseToken,
      context,
      update: {
        liquidityUsd: dollarLiquidity ?? 0n,
      },
    });
  }

  const graduationThresholdDelta = await computeGraduationThresholdDelta({
    poolAddress: address,
    context,
    tickLower,
    tickUpper,
    liquidity,
    isToken0: token0.toLowerCase() === poolState.asset.toLowerCase(),
  });

  await updatePool({
    poolAddress: address,
    context,
    update: dollarLiquidity
      ? {
        liquidity: liquidity - amount,
        dollarLiquidity: dollarLiquidity,
        graduationThreshold:
          poolEntity.graduationThreshold - graduationThresholdDelta,
      }
      : {
        liquidity: liquidity - amount,
        graduationThreshold:
          poolEntity.graduationThreshold - graduationThresholdDelta,
      },
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp: event.block.timestamp,
    context,
  });

  await updatePosition({
    poolAddress: address,
    tickLower,
    tickUpper,
    context,
    update: {
      liquidity: positionEntity.liquidity - amount,
    },
  });
});

ponder.on("UniswapV3Pool:Swap", async ({ event, context }) => {
  const address = event.log.address;
  const { amount0, amount1 } = event.args;
  const timestamp = event.block.timestamp;

  // Fetch pool data in parallel with ETH price
  const [poolEntity, poolData, ethPrice] = await Promise.all([
    insertPoolIfNotExists({
      poolAddress: address,
      timestamp,
      context,
    }),
    getV3PoolData({ address, context }),
    fetchEthPrice(timestamp, context)
  ]);

  const {
    slot0Data,
    liquidity,
    price,
    fee,
    reserve0,
    reserve1,
    token0,
    token1,
  } = poolData;

  // Determine asset token and balance
  const assetToken = poolEntity.isToken0 ? token0 : token1;
  const assetTokenLower = assetToken.toLowerCase() as Hex;
  const assetBalance = poolEntity.isToken0 ? reserve0 : reserve1;
  const quoteBalance = poolEntity.isToken0 ? reserve1 : reserve0;

  // Determine swap direction and calculate fees
  const isToken0In = amount0 > 0n;
  const amountIn = isToken0In ? amount0 : amount1;
  const amountOut = isToken0In ? amount1 : amount0;
  const tokenIn = isToken0In ? token0 : token1;
  const tokenOut = isToken0In ? token1 : token0;

  // Calculate fees
  const feeAmount = (amountIn * BigInt(fee)) / BigInt(1_000_000);
  const fee0 = isToken0In ? feeAmount : 0n;
  const fee1 = isToken0In ? 0n : feeAmount;

  // Calculate quote delta for graduation balance
  const quoteDelta = poolEntity.isToken0 ? amount1 - fee1 : amount0 - fee0;

  // Skip expensive operations if ETH price is not available
  if (!ethPrice) {
    // Minimal update if no ETH price available
    await updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity,
        price,
        totalFee0: poolEntity.totalFee0 + fee0,
        totalFee1: poolEntity.totalFee1 + fee1,
        graduationBalance: poolEntity.graduationBalance + quoteDelta,
        lastSwapTimestamp: timestamp,
        ...slot0Data,
      },
    });
    return;
  }

  // Process metrics if ETH price is available - do in parallel
  const [dollarLiquidity] = await Promise.all([
    // Calculate dollar liquidity
    computeDollarLiquidity({
      assetBalance,
      quoteBalance,
      price,
      ethPrice,
    }),

    // Update time series data in parallel
    Promise.all([
      // Update price buckets
      insertOrUpdateBuckets({
        poolAddress: address,
        price,
        timestamp,
        ethPrice,
        context,
      }),

      // Update volume
      insertOrUpdateDailyVolume({
        poolAddress: address,
        amountIn,
        amountOut,
        timestamp,
        context,
        tokenIn,
        tokenOut,
        ethPrice,
      }),

      // Update price change
      update24HourPriceChange({
        poolAddress: address,
        assetAddress: assetTokenLower,
        currentPrice: price,
        ethPrice,
        currentTimestamp: timestamp,
        createdAt: poolEntity.createdAt,
        context,
      }),

      // Update market cap
      updateMarketCap({
        assetAddress: assetTokenLower,
        price,
        ethPrice,
        context,
      })
    ])
  ]);

  // Update pool with all collected data
  await updatePool({
    poolAddress: address,
    context,
    update: {
      liquidity,
      price,
      dollarLiquidity,
      totalFee0: poolEntity.totalFee0 + fee0,
      totalFee1: poolEntity.totalFee1 + fee1,
      graduationBalance: poolEntity.graduationBalance + quoteDelta,
      lastRefreshed: timestamp,
      lastSwapTimestamp: timestamp,
      ...slot0Data,
    },
  });

  // Update asset data
  await updateAsset({
    assetAddress: assetTokenLower,
    context,
    update: {
      liquidityUsd: dollarLiquidity ?? 0n,
    },
  });
});
