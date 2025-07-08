import { Address, formatEther, zeroAddress } from "viem";
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
import { insertAssetIfNotExists, updateAsset } from "./entities/asset";

export interface DayMetrics {
  volumeUsd: bigint;
  marketCapUsd: bigint;
}

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
  const { db, chain } = context;
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
        chainId: BigInt(chain.id),
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
  marketCapUsd,
  context,
}: {
  poolAddress: Address;
  marketCapUsd: bigint;
  context: Context;
}) => {
  const { db } = context;

  const dailyVolumeEntity = await db.find(dailyVolume, {
    pool: poolAddress.toLowerCase() as `0x${string}`,
  });

  if (!dailyVolumeEntity) {
    return 0;
  }

  const checkpoints = dailyVolumeEntity.checkpoints as Record<
    string,
    DayMetrics
  >;

  const oldestCheckpointTime =
    Object.keys(checkpoints).length > 0
      ? BigInt(Math.min(...Object.keys(checkpoints).map(Number)))
      : undefined;

  const oldestMarketCapUsd = oldestCheckpointTime
    ? BigInt(checkpoints[oldestCheckpointTime!.toString()]?.marketCapUsd || "0")
    : 0n;

  const priceChangePercent =
    oldestMarketCapUsd === 0n || marketCapUsd === 0n
      ? 0
      : Number(
        formatEther(
          ((BigInt(marketCapUsd) - BigInt(oldestMarketCapUsd)) *
            BigInt(1e18)) /
          BigInt(oldestMarketCapUsd)
        )
      ) * 100;

  return Number(priceChangePercent);
};

export const insertOrUpdateDailyVolume = async ({
  poolAddress,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  timestamp,
  ethPrice,
  marketCapUsd,
  context,
}: {
  poolAddress: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  timestamp: bigint;
  ethPrice: bigint;
  marketCapUsd: bigint;
  context: Context;
}) => {
  const { db, chain } = context;

  let volumeUsd;

  const isTokenInEth =
    tokenIn.toLowerCase() === zeroAddress ||
    tokenIn.toLowerCase() ===
    (configs[chain.name].shared.weth.toLowerCase() as `0x${string}`);

  if (isTokenInEth) {
    volumeUsd = (amountIn * ethPrice) / CHAINLINK_ETH_DECIMALS;
  } else {
    const uintAmountOut = amountOut > 0n ? amountOut : -amountOut;
    volumeUsd = (uintAmountOut * ethPrice) / CHAINLINK_ETH_DECIMALS;
  }

  const assetAddress = isTokenInEth ? tokenOut : tokenIn;

  const asset = await insertAssetIfNotExists({
    assetAddress: assetAddress.toLowerCase() as `0x${string}`,
    timestamp,
    context,
  });

  let computedVolumeUsd;
  const volume = await db
    .insert(dailyVolume)
    .values({
      pool: poolAddress.toLowerCase() as `0x${string}`,
      volumeUsd: volumeUsd,
      chainId: BigInt(chain.id),
      lastUpdated: timestamp,
      checkpoints: {},
      earliestCheckpoint: 0n,
      dayChangeUsd: 0n,
    })
    .onConflictDoUpdate((row) => {
      const checkpoints = {
        ...(row.checkpoints as Record<string, DayMetrics>),
        [timestamp.toString()]: {
          volumeUsd: volumeUsd.toString(),
          marketCapUsd: marketCapUsd.toString(),
        },
      };

      const updatedCheckpoints = Object.fromEntries(
        Object.entries(checkpoints).filter(
          ([ts]) => BigInt(ts) >= timestamp - BigInt(secondsInDay)
        )
      );

      const totalVolumeUsd = Object.values(updatedCheckpoints).reduce(
        (acc, vol) => acc + BigInt(vol.volumeUsd),
        BigInt(0)
      );

      computedVolumeUsd = totalVolumeUsd;

      return {
        volumeUsd: totalVolumeUsd,
        checkpoints: updatedCheckpoints,
        lastUpdated: timestamp,
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
      tokenAddress: asset.address,
      context,
      update: {
        volumeUsd: computedVolumeUsd,
      },
    });
    await updateAsset({
      assetAddress: asset.address,
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
  volumeData,
  context,
}: {
  poolAddress: Address;
  volumeData: {
    volumeUsd: bigint;
    checkpoints: Record<string, DayMetrics>;
  };
  context: Context;
}) => {
  const { db } = context;

  await db
    .update(dailyVolume, {
      pool: poolAddress,
    })
    .set({ ...volumeData });
};
