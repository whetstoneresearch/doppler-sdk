import { ponder } from "ponder:registry";
import { getV3PoolData } from "@app/utils/v3-utils";
import {
  computeGraduationThresholdDelta,
  insertPoolConfigIfNotExists,
} from "@app/utils/v3-utils/computeGraduationThreshold";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "./shared/entities/position";
import { insertTokenIfNotExists } from "./shared/entities/token";
import { insertOrUpdateDailyVolume } from "./shared/timeseries";
import { insertPoolIfNotExists, updatePool } from "./shared/entities/pool";
import { insertAssetIfNotExists } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertOrUpdateBuckets } from "./shared/timeseries";
import { getV3PoolReserves } from "@app/utils/v3-utils/getV3PoolData";

ponder.on("UniswapV3Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;

  await insertTokenIfNotExists({
    address: numeraire,
    timestamp: event.block.timestamp,
    context,
    isDerc20: false,
  });

  await insertTokenIfNotExists({
    address: assetId,
    timestamp: event.block.timestamp,
    context,
    isDerc20: true,
    poolAddress: poolOrHook,
  });

  await insertPoolConfigIfNotExists({
    poolAddress: poolOrHook,
    context,
  });

  await insertOrUpdateDailyVolume({
    poolAddress: poolOrHook,
    amountIn: 0n,
    amountOut: 0n,
    timestamp: event.block.timestamp,
    context,
    tokenIn: assetId,
  });

  const poolEntity = await insertPoolIfNotExists({
    poolAddress: poolOrHook,
    timestamp: event.block.timestamp,
    context,
  });

  await insertOrUpdateBuckets({
    poolAddress: poolOrHook,
    price: poolEntity.price,
    timestamp: event.block.timestamp,
    context,
  });

  await insertAssetIfNotExists({
    assetAddress: assetId,
    timestamp: event.block.timestamp,
    context,
  });
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
    token0: poolEntity.baseToken,
    token1: poolEntity.quoteToken,
    context,
  });

  const assetBalance = poolEntity.isToken0 ? reserve0 : reserve1;
  const quoteBalance = poolEntity.isToken0 ? reserve1 : reserve0;

  const dollarLiquidity = await computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price: poolEntity.price,
    timestamp: event.block.timestamp,
    context,
  });

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
    update: {
      graduationThreshold:
        poolEntity.graduationThreshold + graduationThresholdDelta,
      liquidity: poolEntity.liquidity + amount,
      dollarLiquidity: dollarLiquidity,
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

  const dollarLiquidity = await computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price,
    timestamp: event.block.timestamp,
    context,
  });

  const graduationThresholdDelta = await computeGraduationThresholdDelta({
    poolAddress: address,
    context,
    tickLower,
    tickUpper,
    liquidity,
    isToken0: token0.toLowerCase() === poolState.asset.toLowerCase(),
  });

  const update = {
    liquidity: liquidity - amount,
    dollarLiquidity: dollarLiquidity,
    graduationThreshold:
      poolEntity.graduationThreshold - graduationThresholdDelta,
  };

  await updatePool({
    poolAddress: address,
    context,
    update,
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

  const poolEntity = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp: event.block.timestamp,
    context,
  });

  const {
    slot0Data,
    liquidity,
    price,
    fee,
    reserve0,
    reserve1,
    token0,
    token1,
  } = await getV3PoolData({
    address,
    context,
  });

  const assetBalance = poolEntity.isToken0 ? reserve0 : reserve1;
  const quoteBalance = poolEntity.isToken0 ? reserve1 : reserve0;

  const dollarLiquidity = await computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price,
    timestamp: event.block.timestamp,
    context,
  });

  let amountIn;
  let amountOut;
  let tokenIn;
  let fee0;
  let fee1;
  if (amount0 > 0n) {
    amountIn = amount0;
    amountOut = amount1;
    tokenIn = token0;
    fee0 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee1 = 0n;
  } else {
    amountIn = amount1;
    amountOut = amount0;
    tokenIn = token1;
    fee1 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee0 = 0n;
  }

  const quoteDelta = poolEntity.isToken0 ? amount1 - fee1 : amount0 - fee0;

  await insertOrUpdateBuckets({
    poolAddress: address,
    price,
    timestamp: event.block.timestamp,
    context,
  });

  await insertOrUpdateDailyVolume({
    poolAddress: address,
    amountIn,
    amountOut,
    timestamp: event.block.timestamp,
    context,
    tokenIn,
  });

  await updatePool({
    poolAddress: address,
    context,
    update: {
      liquidity: liquidity,
      price: price,
      dollarLiquidity: dollarLiquidity,
      totalFee0: poolEntity.totalFee0 + fee0,
      totalFee1: poolEntity.totalFee1 + fee1,
      graduationBalance: poolEntity.graduationBalance + quoteDelta,
      ...slot0Data,
    },
  });
});
