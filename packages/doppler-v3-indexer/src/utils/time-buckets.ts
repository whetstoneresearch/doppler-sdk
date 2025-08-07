import { and, desc, eq, gte, lt } from "ponder";
import { Context } from "ponder:registry";
import { volumeBucket24h } from "ponder:schema";
import { formatEther, parseEther } from "viem";

// 24 hours in seconds
export const DAY_IN_SECONDS = 86400n;

/**
 * Rounds a timestamp down to the start of the day (00:00:00 UTC)
 */
export function getDayBucketTimestamp(timestamp: bigint): bigint {
  return (BigInt(timestamp) / DAY_IN_SECONDS) * DAY_IN_SECONDS;
}

/**
 * Bucket update parameters
 */
export interface BucketUpdateParams {
  poolAddress: string;
  assetAddress: string;
  chainId: bigint;
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
  chainId: bigint,
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
  
  return {
    volumeUsd: bucket?.volumeUsd || 0n,
    percentChange: percentChange24h,
  };
}

/**
 * Gets volume for the last N days
 */
export async function getVolumeForLastNDays(
  context: Context,
  poolAddress: string,
  chainId: bigint,
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
  chainId: bigint,
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
  chainId: bigint,
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
  chainId: bigint,
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