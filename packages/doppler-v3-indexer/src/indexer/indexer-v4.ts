import { ponder } from "ponder:registry";
import { getV4PoolData } from "@app/utils/v4-utils";
import { insertTokenIfNotExists } from "./shared/entities/token";
import {
  computeMarketCap,
  fetchEthPrice,
  updateMarketCap,
} from "./shared/oracle";
import { insertPoolIfNotExistsV4, updatePool } from "./shared/entities/pool";
import { insertOrUpdateDailyVolume } from "./shared/timeseries";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { insertOrUpdateBuckets } from "./shared/timeseries";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertV4ConfigIfNotExists } from "./shared/entities/v4-entities/v4Config";
import { getReservesV4 } from "@app/utils/v4-utils/getV4PoolData";
import { computeV4Price } from "@app/utils/v4-utils/computeV4Price";
import {
  addV4PoolCheckpoint,
  insertV4PoolCheckpointsIfNotExist,
} from "./shared/entities/v4-entities/v4PoolCheckpoints";
import { computeDollarPrice } from "@app/utils/computePrice";

ponder.on("UniswapV4Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;

  const creatorAddress = event.transaction.from;

  await insertTokenIfNotExists({
    tokenAddress: numeraire,
    creatorAddress,
    timestamp: event.block.timestamp,
    context,
    isDerc20: false,
  });

  const baseToken = await insertTokenIfNotExists({
    tokenAddress: assetId,
    creatorAddress,
    timestamp: event.block.timestamp,
    context,
    isDerc20: true,
    poolAddress: poolOrHook,
  });

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const v4PoolData = await getV4PoolData({
    hook: poolOrHook,
    context,
  });

  const poolEntity = await insertPoolIfNotExistsV4({
    poolAddress: poolOrHook,
    timestamp: event.block.timestamp,
    context,
  });

  await insertV4PoolCheckpointsIfNotExist({
    context,
  });

  const v4Config = await insertV4ConfigIfNotExists({
    hookAddress: poolOrHook,
    context,
  });

  const price = poolEntity.price;
  const totalSupply = baseToken.totalSupply;

  let marketCapUsd;
  if (ethPrice) {
    marketCapUsd = await computeMarketCap({
      price,
      ethPrice,
      totalSupply,
    });
  }

  await insertAssetIfNotExists({
    assetAddress: assetId,
    timestamp: event.block.timestamp,
    context,
    marketCapUsd,
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

  await addV4PoolCheckpoint({
    poolAddress: poolOrHook,
    asset: assetId,
    totalSupply,
    startingTime: v4Config.startingTime,
    endingTime: v4Config.endingTime,
    epochLength: v4Config.epochLength,
    isToken0: v4Config.isToken0,
    poolKey: v4PoolData.poolKey,
    context,
  });
});

ponder.on("UniswapV4Pool:Swap", async ({ event, context }) => {
  const address = event.log.address;
  const { currentTick, totalProceeds, totalTokensSold } = event.args;

  const { isToken0, baseToken } = await insertPoolIfNotExistsV4({
    poolAddress: address,
    timestamp: event.block.timestamp,
    context,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: event.transaction.from,
    timestamp: event.block.timestamp,
    context,
  });

  const price = computeV4Price({
    isToken0,
    currentTick,
    baseTokenDecimals: 18,
  });

  const v4PoolData = await getV4PoolData({
    hook: address,
    context,
  });

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const { token0Reserve, token1Reserve } = await getReservesV4({
    hook: address,
    context,
  });

  const unitPrice = await computeDollarPrice({
    sqrtPriceX96: v4PoolData.slot0Data.sqrtPrice,
    totalSupply: totalSupply,
    ethPrice,
    isToken0: isToken0,
    decimals: 18,
  });

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: token0Reserve,
    quoteBalance: token1Reserve,
    price,
    ethPrice,
  });

  Promise.all([
    updateAsset({
      assetAddress: baseToken,
      context,
      update: {
        liquidityUsd: dollarLiquidity,
      },
    }),
    updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity: v4PoolData.liquidity,
        dollarLiquidity: dollarLiquidity,
        unitPriceUsd: unitPrice,
      },
    }),
    updateMarketCap({
      assetAddress: baseToken,
      price,
      ethPrice,
      context,
    }),
  ]);
});
