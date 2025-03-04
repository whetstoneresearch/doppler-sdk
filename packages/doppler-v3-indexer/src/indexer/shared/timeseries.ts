import { Address } from "viem";
import {
  hourBucketUsd,
  dailyVolume,
} from "ponder.schema";
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

/**
 * Calculates the 24-hour price change without updating anything in the database.
 * This allows us to return the calculated value for use in later database updates.
 */
export const calculatePriceChange = async ({
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
}): Promise<number> => {
  const { db } = context;

  // Skip calculation for zero price
  if (currentPrice === 0n) {
    return 0;
  }

  const timestampFrom = currentTimestamp - BigInt(secondsInDay);
  const usdPrice = (currentPrice * ethPrice) / CHAINLINK_ETH_DECIMALS;
  const searchDelta = currentTimestamp - createdAt > BigInt(secondsInDay) ? secondsInHour : secondsInDay;

  try {
    const priceFrom = await db.sql.query.hourBucketUsd.findFirst({
      where: (fields, { and, eq, between }) =>
        and(
          eq(fields.pool, poolAddress.toLowerCase() as `0x${string}`),
          between(fields.hourId,
            Number(timestampFrom) - searchDelta,
            Number(timestampFrom) + searchDelta
          )
        ),
      orderBy: (fields, { asc }) => [
        asc(fields.hourId)
      ],
    });

    if (!priceFrom || priceFrom.open === 0n) {
      return 0;
    }

    // Calculate the price change percentage
    let priceChangePercent = Number(usdPrice - priceFrom.open) / Number(priceFrom.open) * 100;
    
    // Ensure we're not returning invalid values
    if (isNaN(priceChangePercent) || !isFinite(priceChangePercent)) {
      return 0;
    }
    
    return priceChangePercent;
  } catch (error) {
    console.error(`Error calculating price change for ${poolAddress}: ${error}`);
    return 0;
  }
};

/**
 * Legacy update function - calculates price change and updates both asset and pool
 * You should prefer to use calculatePriceChange and handle updates separately
 */
export const update24HourPriceChange = async ({
  poolAddress,
  assetAddress,
  currentPrice,
  currentTimestamp,
  ethPrice,
  createdAt,
  context,
}: {
  poolAddress: Address;
  assetAddress: Address;
  currentPrice: bigint;
  currentTimestamp: bigint;
  ethPrice: bigint;
  createdAt: bigint;
  context: Context;
}) => {
  // Calculate the price change
  const priceChangePercent = await calculatePriceChange({
    poolAddress,
    currentPrice,
    currentTimestamp,
    ethPrice,
    createdAt,
    context,
  });
  
  // Update both records in parallel
  await Promise.all([
    updateAsset({
      assetAddress,
      context,
      update: {
        percentDayChange: priceChangePercent,
      },
    }),
    
    updatePool({
      poolAddress,
      context,
      update: {
        percentDayChange: priceChangePercent,
      },
    })
  ]);
  
  return priceChangePercent;
};


export const insertOrUpdateDailyVolume = async ({
  tokenIn,
  tokenOut,
  poolAddress,
  amountIn,
  amountOut,
  timestamp,
  ethPrice,
  context,
}: {
  tokenIn: Address;
  tokenOut: Address;
  poolAddress: Address;
  amountIn: bigint;
  amountOut: bigint;
  timestamp: bigint;
  ethPrice: bigint;
  context: Context;
}) => {
  const { db, network } = context;

  let volumeUsd;

  const isTokenInWeth = tokenIn.toLowerCase() ===
    (configs[network.name].shared.weth.toLowerCase() as `0x${string}`)

  if (isTokenInWeth) {
    volumeUsd = (amountIn * ethPrice) / CHAINLINK_ETH_DECIMALS;
  } else {
    const uintAmountOut = amountOut > 0n ? amountOut : -amountOut;
    volumeUsd = (uintAmountOut * ethPrice) / CHAINLINK_ETH_DECIMALS;
  }

  const assetAddress = isTokenInWeth ? tokenOut : tokenIn;

  let computedVolumeUsd;
  const volume = await db
    .insert(dailyVolume)
    .values({
      pool: poolAddress.toLowerCase() as `0x${string}`,
      volumeUsd: volumeUsd,
      chainId: BigInt(network.chainId),
      lastUpdated: timestamp,
      checkpoints: {
        [timestamp.toString()]: volumeUsd.toString(),
      },
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

      const totalVolumeUsd = Object.values(updatedCheckpoints).reduce(
        (acc, vol) => acc + BigInt(vol),
        BigInt(0)
      );

      computedVolumeUsd = totalVolumeUsd;

      return {
        volumeUsd: totalVolumeUsd,
        checkpoints: updatedCheckpoints,
        lastUpdated: timestamp,
      };
    });

  if (computedVolumeUsd && computedVolumeUsd > 0n) {
    await updatePool({
      poolAddress,
      context,
      update: {
        volumeUsd: computedVolumeUsd,
        lastRefreshed: timestamp, // Mark as recently updated to prevent redundant refresh
        lastSwapTimestamp: timestamp, // Track when the pool was last swapped on
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
