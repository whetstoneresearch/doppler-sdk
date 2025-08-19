import { and, desc, eq, gte, lt } from "ponder";
import { Context } from "ponder:registry";
import { volumeBucket24h, fifteenMinuteBucketUsd } from "ponder:schema";
import { formatEther, parseEther } from "viem";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";

// 24 hours in seconds
export const DAY_IN_SECONDS = 86400n;
export const FIFTEEN_MINUTES_IN_SECONDS = 900n;

/**
 * Rounds a timestamp down to the start of the day (00:00:00 UTC)
 */
export function getDayBucketTimestamp(timestamp: bigint): bigint {
  return (BigInt(timestamp) / DAY_IN_SECONDS) * DAY_IN_SECONDS;
}

/**
 * Rounds a timestamp down to the start of the 15-minute interval (UTC)
 */
export function get15mBucketTimestamp(timestamp: bigint): bigint {
  return (BigInt(timestamp) / FIFTEEN_MINUTES_IN_SECONDS) * FIFTEEN_MINUTES_IN_SECONDS;
}

/**
 * Bucket update parameters
 */
export interface BucketUpdateParams {
  poolAddress: string;
  assetAddress: string;
  chainId: number;
  timestamp: bigint;
  volumeUsd: bigint;
  volumeToken0: bigint;
  volumeToken1: bigint;
  price: bigint;
  liquidityUsd: bigint;
  marketCapUsd: bigint;
  isBuy: boolean;
  userAddress?: string;
  holderCount?: number;
  feeUsd?: bigint;
}

/**
 * Updates or creates a 24-hour bucket
 */
export async function updateDayBucket(
  context: Context,
  params: BucketUpdateParams
): Promise<typeof volumeBucket24h.$inferSelect> {
  const { db } = context;
  const bucketTimestamp = getDayBucketTimestamp(params.timestamp);
  
  const bucketId = {
    poolAddress: params.poolAddress as `0x${string}`,
    timestamp: bucketTimestamp,
    chainId: params.chainId,
  };

  const existingBucket = await db.find(volumeBucket24h, bucketId);

  if (existingBucket) {
    // Calculate volume-weighted average price
    const totalVolume = existingBucket.volumeUsd + params.volumeUsd;
    const vwap = totalVolume > 0n
      ? ((existingBucket.vwap || existingBucket.close) * existingBucket.volumeUsd + params.price * params.volumeUsd) / totalVolume
      : params.price;

    return await db.update(volumeBucket24h, bucketId).set({
      volumeUsd: existingBucket.volumeUsd + params.volumeUsd,
      volumeToken0: existingBucket.volumeToken0 + params.volumeToken0,
      volumeToken1: existingBucket.volumeToken1 + params.volumeToken1,
      txCount: existingBucket.txCount + 1,
      uniqueUsers: params.userAddress ? existingBucket.uniqueUsers + 1 : existingBucket.uniqueUsers,
      buyCount: existingBucket.buyCount + (params.isBuy ? 1 : 0),
      sellCount: existingBucket.sellCount + (!params.isBuy ? 1 : 0),
      high: params.price > existingBucket.high ? params.price : existingBucket.high,
      low: params.price < existingBucket.low ? params.price : existingBucket.low,
      close: params.price,
      vwap,
      liquidityUsd: params.liquidityUsd,
      marketCapUsd: params.marketCapUsd,
      holderCount: params.holderCount || existingBucket.holderCount,
      feesUsd: existingBucket.feesUsd + (params.feeUsd || 0n),
      updatedAt: params.timestamp,
    });
  } else {
    return await db.insert(volumeBucket24h).values({
      ...bucketId,
      assetAddress: params.assetAddress as `0x${string}`,
      volumeUsd: params.volumeUsd,
      volumeToken0: params.volumeToken0,
      volumeToken1: params.volumeToken1,
      txCount: 1,
      uniqueUsers: params.userAddress ? 1 : 0,
      buyCount: params.isBuy ? 1 : 0,
      sellCount: !params.isBuy ? 1 : 0,
      open: params.price,
      high: params.price,
      low: params.price,
      close: params.price,
      vwap: params.price,
      liquidityUsd: params.liquidityUsd,
      marketCapUsd: params.marketCapUsd,
      holderCount: params.holderCount || 0,
      feesUsd: params.feeUsd || 0n,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
    });
  }
}

/**
 * Gets 24-hour volume for a pool from the current day's bucket
 */
export async function get24HourVolumeAndPercentChange(
  context: Context,
  poolAddress: string,
  chainId: number,
  currentTimestamp: bigint
): Promise<{ volumeUsd: bigint; percentChange: number }> {
  const { db } = context;
  const currentDayTimestamp = getDayBucketTimestamp(currentTimestamp);
  
  const bucket = await db.find(volumeBucket24h, {
    poolAddress: poolAddress as `0x${string}`,
    timestamp: currentDayTimestamp,
    chainId,
  });

  const open = bucket?.open || 0n;
  const close = bucket?.close || 0n;
  const percentChange24h = Number(formatEther(close - open)) / Number(formatEther(open)) * 100;

  if (typeof percentChange24h != "number" || isNaN(percentChange24h) || percentChange24h === Infinity || percentChange24h === -Infinity) {
    return {
      volumeUsd: bucket?.volumeUsd || 0n,
      percentChange: 0,
    };
  }
  
  return {
    volumeUsd: bucket?.volumeUsd || 0n,
    percentChange: percentChange24h,
  };
}

/**
 * Updates or creates a 15-minute USD OHLC bucket for a pool
 */
export async function updateFifteenMinuteBucketUsd(
  context: Context,
  params: {
    poolAddress: string;
    chainId: number;
    timestamp: bigint;
    priceUsd: bigint; // 1e18-scaled USD price
    volumeUsd: bigint;
  }
): Promise<void> {
  const { db } = context;
  const bucketTimestamp = get15mBucketTimestamp(params.timestamp);
  const minuteId = Number(bucketTimestamp);

  const rowId = {
    pool: params.poolAddress as `0x${string}`,
    minuteId,
    chainId: params.chainId,
  };

  const existing = await db.find(fifteenMinuteBucketUsd, rowId);
  if (existing) {
    await db
      .update(fifteenMinuteBucketUsd, rowId)
      .set({
        close: params.priceUsd,
        low: params.priceUsd < existing.low ? params.priceUsd : existing.low,
        high: params.priceUsd > existing.high ? params.priceUsd : existing.high,
        average:
          (existing.average * BigInt(existing.count) + params.priceUsd) /
          BigInt(existing.count + 1),
        count: existing.count + 1,
        volumeUsd: existing.volumeUsd + params.volumeUsd,
      });
  } else {
    await db.insert(fifteenMinuteBucketUsd).values({
      minuteId,
      pool: params.poolAddress as `0x${string}`,
      open: params.priceUsd,
      close: params.priceUsd,
      low: params.priceUsd,
      high: params.priceUsd,
      average: params.priceUsd,
      count: 1,
      chainId: params.chainId,
      volumeUsd: params.volumeUsd,
    });
  }
}

/**
 * Gets volume for the last N days
 */
export async function getVolumeForLastNDays(
  context: Context,
  poolAddress: string,
  chainId: number,
  days: number,
  currentTimestamp: bigint
): Promise<bigint> {
  const { db } = context;
  const startTimestamp = currentTimestamp - (BigInt(days) * DAY_IN_SECONDS);
  
  const buckets = await db.sql
    .select({
      volumeUsd: volumeBucket24h.volumeUsd,
    })
    .from(volumeBucket24h)
    .where(
      and(
        eq(volumeBucket24h.poolAddress, poolAddress as `0x${string}`),
        eq(volumeBucket24h.chainId, chainId),
        gte(volumeBucket24h.timestamp, startTimestamp),
        lt(volumeBucket24h.timestamp, currentTimestamp)
      )
    );
  
  return buckets.reduce((sum, bucket) => sum + bucket.volumeUsd, 0n);
}

/**
 * Gets historical daily volumes for a pool
 */
export async function getHistoricalDailyVolumes(
  context: Context,
  poolAddress: string,
  chainId: number,
  limit: number = 30
): Promise<Array<typeof volumeBucket24h.$inferSelect>> {
  const { db } = context;
  
  return await db.sql
    .select()
    .from(volumeBucket24h)
    .where(
      and(
        eq(volumeBucket24h.poolAddress, poolAddress as `0x${string}`),
        eq(volumeBucket24h.chainId, chainId)
      )
    )
    .orderBy(desc(volumeBucket24h.timestamp))
    .limit(limit);
}

/**
 * Gets top pools by volume for a specific day
 */
export async function getTopPoolsByDailyVolume(
  context: Context,
  chainId: number,
  dayTimestamp: bigint,
  limit: number = 100
): Promise<Array<typeof volumeBucket24h.$inferSelect>> {
  const { db } = context;
  
  return await db.sql
    .select()
    .from(volumeBucket24h)
    .where(
      and(
        eq(volumeBucket24h.chainId, chainId),
        eq(volumeBucket24h.timestamp, dayTimestamp)
      )
    )
    .orderBy(desc(volumeBucket24h.volumeUsd))
    .limit(limit);
}

/**
 * Gets top assets by market cap for a specific day
 */
export async function getTopAssetsByMarketCap(
  context: Context,
  chainId: number,
  dayTimestamp: bigint,
  limit: number = 100
): Promise<Array<typeof volumeBucket24h.$inferSelect>> {
  const { db } = context;
  
  return await db.sql
    .select()
    .from(volumeBucket24h)
    .where(
      and(
        eq(volumeBucket24h.chainId, chainId),
        eq(volumeBucket24h.timestamp, dayTimestamp)
      )
    )
    .orderBy(desc(volumeBucket24h.marketCapUsd))
    .limit(limit);
}