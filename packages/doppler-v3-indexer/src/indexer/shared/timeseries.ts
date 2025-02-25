import { Address } from "viem";
import {
  fifteenMinuteBucket,
  fifteenMinuteBucketUsd,
  hourBucket,
  hourBucketUsd,
  thirtyMinuteBucket,
  thirtyMinuteBucketUsd,
  dailyVolume,
} from "ponder.schema";
import { Context } from "ponder:registry";
import {
  secondsInDay,
  secondsIn30Minutes,
  secondsIn15Minutes,
  secondsInHour,
  CHAINLINK_ETH_DECIMALS,
} from "@app/utils/constants";
import { configs } from "addresses";
import { updatePool } from "./entities/pool";

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

    // insertOrUpdateThirtyMinuteBucket({
    //   poolAddress,
    //   price,
    //   timestamp,
    //   context,
    // }),

    // insertOrUpdateThirtyMinuteBucketUsd({
    //   poolAddress,
    //   price,
    //   timestamp,
    //   ethPrice,
    //   context,
    // }),

    // insertOrUpdateFifteenMinuteBucket({
    //   poolAddress,
    //   price,
    //   timestamp,
    //   context,
    // }),

    // insertOrUpdateFifteenMinuteBucketUsd({
    //   poolAddress,
    //   price,
    //   timestamp,
    //   ethPrice,
    //   context,
    // }),
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

export const insertOrUpdateDailyVolume = async ({
  tokenIn,
  poolAddress,
  amountIn,
  amountOut,
  timestamp,
  ethPrice,
  context,
}: {
  tokenIn: Address;
  poolAddress: Address;
  amountIn: bigint;
  amountOut: bigint;
  timestamp: bigint;
  ethPrice: bigint;
  context: Context;
}) => {
  const { db, network } = context;

  let volumeUsd;
  if (
    tokenIn.toLowerCase() ===
    (configs[network.name].shared.weth.toLowerCase() as `0x${string}`)
  ) {
    volumeUsd = (amountIn * ethPrice) / CHAINLINK_ETH_DECIMALS;
  } else {
    const uintAmountOut = amountOut > 0n ? amountOut : -amountOut;
    volumeUsd = (uintAmountOut * ethPrice) / CHAINLINK_ETH_DECIMALS;
  }

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
      },
    });
  }

  return volume;
};

// const insertOrUpdateThirtyMinuteBucketUsd = async ({
//   poolAddress,
//   price,
//   timestamp,
//   ethPrice,
//   context,
// }: {
//   poolAddress: Address;
//   price: bigint;
//   timestamp: bigint;
//   ethPrice: bigint;
//   context: Context;
// }) => {
//   const { db, network } = context;
//   const thirtyMinuteId =
//     Math.floor(Number(timestamp) / secondsIn30Minutes) * secondsIn30Minutes;

//   const usdPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;

//   try {
//     await db
//       .insert(thirtyMinuteBucketUsd)
//       .values({
//         thirtyMinuteId,
//         pool: poolAddress.toLowerCase() as `0x${string}`,
//         open: usdPrice,
//         close: usdPrice,
//         low: usdPrice,
//         high: usdPrice,
//         average: usdPrice,
//         count: 1,
//         chainId: BigInt(network.chainId),
//       })
//       .onConflictDoUpdate((row) => ({
//         close: usdPrice,
//         low: row.low < usdPrice ? row.low : usdPrice,
//         high: row.high > usdPrice ? row.high : usdPrice,
//         average:
//           (row.average * BigInt(row.count) + usdPrice) / BigInt(row.count + 1),
//         count: row.count + 1,
//       }));
//   } catch (e) {
//     console.error("error inserting hour bucket", e);
//   }
// };

// const insertOrUpdateFifteenMinuteBucket = async ({
//   poolAddress,
//   price,
//   timestamp,
//   context,
// }: {
//   poolAddress: Address;
//   price: bigint;
//   timestamp: bigint;
//   context: Context;
// }) => {
//   const { db, network } = context;
//   const fifteenMinuteId =
//     Math.floor(Number(timestamp) / secondsIn15Minutes) * secondsIn15Minutes;

//   try {
//     await db
//       .insert(fifteenMinuteBucket)
//       .values({
//         fifteenMinuteId,
//         pool: poolAddress.toLowerCase() as `0x${string}`,
//         open: price,
//         close: price,
//         low: price,
//         high: price,
//         average: price,
//         count: 1,
//         chainId: BigInt(network.chainId),
//       })
//       .onConflictDoUpdate((row) => ({
//         close: price,
//         low: row.low < price ? row.low : price,
//         high: row.high > price ? row.high : price,
//         average:
//           (row.average * BigInt(row.count) + price) / BigInt(row.count + 1),
//         count: row.count + 1,
//       }));
//   } catch (e) {
//     console.error("error inserting hour bucket", e);
//   }
// };

// const insertOrUpdateFifteenMinuteBucketUsd = async ({
//   poolAddress,
//   price,
//   timestamp,
//   ethPrice,
//   context,
// }: {
//   poolAddress: Address;
//   price: bigint;
//   timestamp: bigint;
//   ethPrice: bigint;
//   context: Context;
// }) => {
//   const { db, network } = context;
//   const fifteenMinuteId =
//     Math.floor(Number(timestamp) / secondsIn15Minutes) * secondsIn15Minutes;

//   const usdPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;

//   try {
//     await db
//       .insert(fifteenMinuteBucketUsd)
//       .values({
//         fifteenMinuteId,
//         pool: poolAddress.toLowerCase() as `0x${string}`,
//         open: usdPrice,
//         close: usdPrice,
//         low: usdPrice,
//         high: usdPrice,
//         average: usdPrice,
//         count: 1,
//         chainId: BigInt(network.chainId),
//       })
//       .onConflictDoUpdate((row) => ({
//         close: usdPrice,
//         low: row.low < usdPrice ? row.low : usdPrice,
//         high: row.high > usdPrice ? row.high : usdPrice,
//         average:
//           (row.average * BigInt(row.count) + usdPrice) / BigInt(row.count + 1),
//         count: row.count + 1,
//       }));
//   } catch (e) {
//     console.error("error inserting hour bucket", e);
//   }
// };

// const insertOrUpdateHourBucket = async ({
//   poolAddress,
//   price,
//   timestamp,
//   context,
// }: {
//   poolAddress: Address;
//   price: bigint;
//   timestamp: bigint;
//   context: Context;
// }) => {
//   const { db, network } = context;
//   const hourId = Math.floor(Number(timestamp) / secondsInHour) * secondsInHour;

//   try {
//     await db
//       .insert(hourBucket)
//       .values({
//         hourId,
//         pool: poolAddress.toLowerCase() as `0x${string}`,
//         open: price,
//         close: price,
//         low: price,
//         high: price,
//         average: price,
//         count: 1,
//         chainId: BigInt(network.chainId),
//       })
//       .onConflictDoUpdate((row) => ({
//         close: price,
//         low: row.low < price ? row.low : price,
//         high: row.high > price ? row.high : price,
//         average:
//           (row.average * BigInt(row.count) + price) / BigInt(row.count + 1),
//         count: row.count + 1,
//       }));
//   } catch (e) {
//     console.error("error inserting hour bucket", e);
//   }
// };