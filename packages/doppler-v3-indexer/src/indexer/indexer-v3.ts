import { ponder } from "ponder:registry";
import { computeV3Price } from "@app/utils/v3-utils";
import { computeGraduationThresholdDelta } from "@app/utils/v3-utils/computeGraduationThreshold";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "./shared/entities/position";
import { insertTokenIfNotExists } from "./shared/entities/token";
import {
  insertOrUpdateDailyVolume,
  compute24HourPriceChange,
} from "./shared/timeseries";
import { insertPoolIfNotExists, updatePool } from "./shared/entities/pool";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertOrUpdateBuckets } from "./shared/timeseries";
import { getV3PoolReserves } from "@app/utils/v3-utils/getV3PoolData";
import {
  computeMarketCap,
  fetchEthPrice,
  updateMarketCap,
} from "./shared/oracle";
import {
  insertActivePoolsBlobIfNotExists,
  tryAddActivePool,
} from "./shared/scheduledJobs";

ponder.on("UniswapV3Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset, numeraire } = event.args;
  const timestamp = event.block.timestamp;

  const creatorId = event.transaction.from.toLowerCase() as `0x${string}`;
  const numeraireId = numeraire.toLowerCase() as `0x${string}`;
  const assetId = asset.toLowerCase() as `0x${string}`;
  const poolOrHookId = poolOrHook.toLowerCase() as `0x${string}`;

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const baseTokenEntity = await insertTokenIfNotExists({
    tokenAddress: assetId,
    creatorAddress: creatorId,
    timestamp,
    context,
    isDerc20: true,
  });

  const { totalSupply } = baseTokenEntity;

  const { price } = await insertPoolIfNotExists({
    poolAddress: poolOrHookId,
    timestamp,
    context,
    ethPrice,
    totalSupply,
  });

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  await Promise.all([
    insertActivePoolsBlobIfNotExists({
      context,
    }),
    insertTokenIfNotExists({
      tokenAddress: numeraireId,
      creatorAddress: creatorId,
      timestamp,
      context,
      isDerc20: false,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertOrUpdateBuckets({
      poolAddress: poolOrHookId,
      price,
      timestamp,
      ethPrice,
      context,
    }),
  ]);

  await insertOrUpdateDailyVolume({
    poolAddress: poolOrHookId,
    amountIn: 0n,
    amountOut: 0n,
    timestamp,
    context,
    tokenIn: assetId,
    tokenOut: numeraireId,
    ethPrice,
    marketCapUsd,
  });
});

ponder.on("UniswapV3Pool:Mint", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const { tickLower, tickUpper, amount, owner } = event.args;
  const timestamp = event.block.timestamp;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    quoteToken,
    isToken0,
    price,
    liquidity,
    graduationThreshold,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
    event: "UniswapV3Pool:Mint",
  });

  const token0 = isToken0 ? baseToken : quoteToken;
  const token1 = isToken0 ? quoteToken : baseToken;

  const { reserve0, reserve1 } = await getV3PoolReserves({
    address,
    token0,
    token1,
    context,
  });

  const assetBalance = isToken0 ? reserve0 : reserve1;
  const quoteBalance = isToken0 ? reserve1 : reserve0;

  const liquidityUsd = await computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price,
    ethPrice,
  });

  const graduationThresholdDelta = computeGraduationThresholdDelta({
    tickLower,
    tickUpper,
    liquidity: amount,
    isToken0,
  });

  await insertAssetIfNotExists({
    assetAddress: baseToken,
    timestamp,
    context,
  });

  await updateAsset({
    assetAddress: baseToken,
    context,
    update: {
      liquidityUsd,
    },
  });

  await updatePool({
    poolAddress: address,
    context,
    update: {
      graduationThreshold: graduationThreshold + graduationThresholdDelta,
      liquidity: liquidity + amount,
      dollarLiquidity: liquidityUsd,
      reserves0: reserve0,
      reserves1: reserve1,
    },
  });

  await updateMarketCap({
    assetAddress: baseToken,
    price,
    ethPrice,
    context,
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp,
    context,
  });

  if (positionEntity.createdAt != timestamp) {
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
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { tickLower, tickUpper, owner, amount } = event.args;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    quoteToken,
    isToken0,
    price,
    liquidity,
    graduationThreshold,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
    event: "UniswapV3Pool:Burn",
  });

  const token0 = isToken0 ? baseToken : quoteToken;
  const token1 = isToken0 ? quoteToken : baseToken;

  const { reserve0, reserve1 } = await getV3PoolReserves({
    address,
    token0,
    token1,
    context,
  });

  const assetBalance = isToken0 ? reserve0 : reserve1;
  const quoteBalance = isToken0 ? reserve1 : reserve0;

  const liquidityUsd = computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price,
    ethPrice,
  });

  const graduationThresholdDelta = computeGraduationThresholdDelta({
    tickLower,
    tickUpper,
    liquidity,
    isToken0,
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp,
    context,
  });

  await Promise.all([
    updateMarketCap({
      assetAddress: baseToken,
      price,
      ethPrice,
      context,
    }),
    updateAsset({
      assetAddress: baseToken,
      context,
      update: {
        liquidityUsd,
      },
    }),
    updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity: liquidity - amount,
        dollarLiquidity: liquidityUsd,
        graduationThreshold: graduationThreshold - graduationThresholdDelta,
      },
    }),
    updatePosition({
      poolAddress: address,
      tickLower,
      tickUpper,
      context,
      update: {
        liquidity: positionEntity.liquidity - amount,
      },
    }),
  ]);
});

ponder.on("UniswapV3Pool:Swap", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { amount0, amount1, sqrtPriceX96 } = event.args;

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const {
    isToken0,
    baseToken,
    quoteToken,
    reserves0,
    reserves1,
    fee,
    totalFee0,
    totalFee1,
    graduationBalance,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });

  const price = computeV3Price({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });

  const assetBalance = isToken0 ? reserves0 + amount0 : reserves1 + amount1;
  const quoteBalance = isToken0 ? reserves1 + amount1 : reserves0 + amount0;

  const token0 = isToken0 ? baseToken : quoteToken;
  const token1 = isToken0 ? quoteToken : baseToken;

  const tokenIn = amount0 > 0n ? token0 : token1;
  const tokenOut = amount0 > 0n ? token1 : token0;

  let amountIn;
  let amountOut;
  let fee0;
  let fee1;
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

  const quoteDelta = isToken0 ? amount1 - fee1 : amount0 - fee0;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price,
    ethPrice,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: address,
    timestamp,
    context,
    isDerc20: true,
    poolAddress: address,
  });

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  const priceChangeInfo = await compute24HourPriceChange({
    poolAddress: address,
    marketCapUsd,
    context,
  });

  await Promise.all([
    tryAddActivePool({
      poolAddress: address,
      lastSwapTimestamp: Number(timestamp),
      context,
    }),
    insertOrUpdateBuckets({
      poolAddress: address,
      price,
      timestamp,
      ethPrice,
      context,
    }),
    insertOrUpdateDailyVolume({
      poolAddress: address,
      amountIn,
      amountOut,
      timestamp,
      context,
      tokenIn,
      tokenOut,
      ethPrice,
      marketCapUsd,
    }),
    updatePool({
      poolAddress: address,
      context,
      update: {
        price,
        dollarLiquidity,
        totalFee0: totalFee0 + fee0,
        totalFee1: totalFee1 + fee1,
        graduationBalance: graduationBalance + quoteDelta,
        lastRefreshed: timestamp,
        lastSwapTimestamp: timestamp,
        marketCapUsd,
        percentDayChange: priceChangeInfo,
      },
    }),
    updateAsset({
      assetAddress: baseToken,
      context,
      update: {
        liquidityUsd: dollarLiquidity,
        percentDayChange: priceChangeInfo,
        marketCapUsd,
      },
    }),
  ]);
});
