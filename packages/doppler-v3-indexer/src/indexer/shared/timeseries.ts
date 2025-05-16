import { Address, zeroAddress } from "viem";
import { hourBucketUsd, dailyVolume } from "ponder.schema";
import { Context } from "ponder:registry";
import {
  secondsInDay,
  secondsInHour,
  CHAINLINK_ETH_DECIMALS,
} from "@app/utils/constants";
import { configs } from "addresses";
import { updatePool } from "./entities/pool";
import { updateToken } from "./entities/token";
import { updateAsset } from "./entities/asset";

export const insertOrUpdateBuckets = async ({
  poolAddress,
  price,
  timestamp,
  ethPrice,
  context,
}: {
  poolAddress: Address;
  price: bigint;
  timestamp: bigint;
  ethPrice: bigint;
  context: Context;
}) => {
  if (!ethPrice) {
    console.error("No price found for timestamp", timestamp);
    return;
  }

  await Promise.all([
    insertOrUpdateHourBucketUsd({
      poolAddress,
      price,
      timestamp,
      ethPrice,
      context,
    }),
  ]);
};

const insertOrUpdateHourBucketUsd = async ({
  poolAddress,
  price,
  timestamp,
  ethPrice,
  context,
}: {
  poolAddress: Address;
  price: bigint;
  timestamp: bigint;
  ethPrice: bigint;
  context: Context;
}) => {
  const { db, network } = context;
  const hourId = Math.floor(Number(timestamp) / secondsInHour) * secondsInHour;
  const usdPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;

  try {
    await db
      .insert(hourBucketUsd)
      .values({
        hourId,
        pool: poolAddress.toLowerCase() as `0x${string}`,
        open: usdPrice,
        close: usdPrice,
        low: usdPrice,
        high: usdPrice,
        average: usdPrice,
        count: 1,
        chainId: BigInt(network.chainId),
      })
      .onConflictDoUpdate((row) => ({
        close: usdPrice,
        low: row.low < usdPrice ? row.low : usdPrice,
        high: row.high > usdPrice ? row.high : usdPrice,
        average:
          (row.average * BigInt(row.count) + usdPrice) / BigInt(row.count + 1),
        count: row.count + 1,
      }));
  } catch (e) {
    console.error("error inserting hour bucket", e);
  }
};

export const compute24HourPriceChange = async ({
  poolAddress,
  currentPrice,
  currentTimestamp,
  ethPrice,
  createdAt,
  context,
}: {
  poolAddress: Address;
  currentPrice: bigint;
  currentTimestamp: bigint;
  ethPrice: bigint;
  createdAt: bigint;
  context: Context;
}) => {
  const { db, network } = context;

  const usdPrice = (currentPrice * ethPrice) / CHAINLINK_ETH_DECIMALS;
  const dayHasElapsed = currentTimestamp - createdAt > BigInt(secondsInDay);
  const timestampFrom = dayHasElapsed
    ? Math.floor(Number(createdAt) / secondsInHour) * secondsInHour
    : Math.floor(
        Number(currentTimestamp - BigInt(secondsInDay)) / secondsInHour
      ) * secondsInHour;

  const priceFrom = await db.find(hourBucketUsd, {
    pool: poolAddress.toLowerCase() as `0x${string}`,
    hourId: timestampFrom,
    chainId: BigInt(network.chainId),
  });

  if (!priceFrom) {
    return 0;
  }

  // Calculate the price change percentage
  let priceChangePercent =
    (Number(usdPrice - priceFrom.open) / Number(priceFrom.open)) * 100;

  // Ensure we're not sending null values to the database
  if (isNaN(priceChangePercent) || !isFinite(priceChangePercent)) {
    priceChangePercent = 0;
  }

  return priceChangePercent;
};

export const insertOrUpdateDailyVolume = async ({
  poolAddress,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  timestamp,
  ethPrice,
  context,
}: {
  poolAddress: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  timestamp: bigint;
  ethPrice: bigint;
  context: Context;
}) => {
  const { db, network } = context;

  let volumeUsd;

  const isTokenInWeth =
    tokenIn.toLowerCase() ===
    (configs[network.name].shared.weth.toLowerCase() as `0x${string}`);

  const isTokenInEth = tokenIn.toLowerCase() === zeroAddress;

  if (isTokenInWeth || isTokenInEth) {
    volumeUsd = (amountIn * ethPrice) / CHAINLINK_ETH_DECIMALS;
  } else {
    const uintAmountOut = amountOut > 0n ? amountOut : -amountOut;
    volumeUsd = (uintAmountOut * ethPrice) / CHAINLINK_ETH_DECIMALS;
  }

  const assetAddress = isTokenInWeth || isTokenInEth ? tokenOut : tokenIn;

  let computedVolumeUsd;
  const volume = await db
    .insert(dailyVolume)
    .values({
      pool: poolAddress.toLowerCase() as `0x${string}`,
      volumeUsd: volumeUsd,
      chainId: BigInt(network.chainId),
      lastUpdated: timestamp,
      checkpoints: {},
      earliestCheckpoint: 0n,
      dayChangeUsd: 0n,
    })
    .onConflictDoUpdate((row) => {
      const checkpoints = {
        ...(row.checkpoints as Record<string, string>),
        [timestamp.toString()]: volumeUsd.toString(),
      };

      const updatedCheckpoints = Object.fromEntries(
        Object.entries(checkpoints).filter(
          ([ts]) => BigInt(ts) >= timestamp - BigInt(secondsInDay)
        )
      );

      const oldestCheckpointTime =
        Object.keys(updatedCheckpoints).length > 0
          ? BigInt(Math.min(...Object.keys(updatedCheckpoints).map(Number)))
          : timestamp;

      const totalVolumeUsd = Object.values(updatedCheckpoints).reduce(
        (acc, vol) => acc + BigInt(vol),
        BigInt(0)
      );

      computedVolumeUsd = totalVolumeUsd;

      return {
        volumeUsd: totalVolumeUsd,
        checkpoints: updatedCheckpoints,
        lastUpdated: timestamp,
        earliestCheckpoint: oldestCheckpointTime,
        inactive: totalVolumeUsd === 0n,
      };
    });

  if (computedVolumeUsd) {
    await updatePool({
      poolAddress,
      context,
      update: {
        volumeUsd: computedVolumeUsd,
        lastRefreshed: timestamp,
        lastSwapTimestamp: timestamp,
      },
    });
    await updateToken({
      tokenAddress: assetAddress,
      context,
      update: {
        volumeUsd: computedVolumeUsd,
      },
    });
    await updateAsset({
      assetAddress,
      context,
      update: {
        dayVolumeUsd: computedVolumeUsd,
      },
    });
  }

  return volume;
};

export const updateDailyVolume = async ({
  poolAddress,
  asset,
  volumeData,
  timestamp,
  context,
}: {
  poolAddress: Address;
  asset: Address;
  volumeData: {
    volumeUsd: bigint;
    checkpoints: Record<string, string>;
    lastUpdated: bigint;
  };
  timestamp: bigint;
  context: Context;
}) => {
  const { db } = context;

  try {
    let checkpoints = volumeData.checkpoints as Record<string, string>;

    const updatedCheckpoints = Object.fromEntries(
      Object.entries(checkpoints).filter(
        ([ts]) => BigInt(ts) >= timestamp - BigInt(secondsInDay)
      )
    );

    const oldestCheckpointTime =
      Object.keys(updatedCheckpoints).length > 0
        ? BigInt(Math.min(...Object.keys(updatedCheckpoints).map(Number)))
        : timestamp;

    const totalVolumeUsd = Object.values(updatedCheckpoints).reduce(
      (acc, vol) => acc + BigInt(vol),
      BigInt(0)
    );

    console.log("totalVolumeUsd", totalVolumeUsd);

    await db
      .update(dailyVolume, {
        pool: poolAddress.toLowerCase() as `0x${string}`,
      })
      .set({
        volumeUsd: totalVolumeUsd,
        checkpoints: updatedCheckpoints,
        lastUpdated: timestamp,
        earliestCheckpoint: oldestCheckpointTime,
        inactive: totalVolumeUsd === 0n,
      });

    await updatePool({
      poolAddress,
      context,
      update: {
        volumeUsd: totalVolumeUsd,
        lastRefreshed: timestamp, // Mark as recently updated to prevent redundant refresh
        lastSwapTimestamp: timestamp, // Track when the pool was last swapped on
      },
    });
    await updateToken({
      tokenAddress: asset,
      context,
      update: {
        volumeUsd: totalVolumeUsd,
      },
    });
    await updateAsset({
      assetAddress: asset,
      context,
      update: {
        dayVolumeUsd: totalVolumeUsd,
      },
    });
  } catch (e) {
    console.error("error updating daily volume", e);
  }
};
