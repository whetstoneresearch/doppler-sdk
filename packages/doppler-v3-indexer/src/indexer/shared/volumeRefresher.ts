import { Address } from "viem";
import { dailyVolume, pool } from "ponder.schema";
import { Context } from "ponder:registry";
import { secondsInDay, secondsInHour } from "@app/utils/constants";
import { updatePool } from "./entities/pool";
import { updateToken } from "./entities/token";
import { updateAsset } from "./entities/asset";

/**
 * Refreshes stale volume data by cleaning up old checkpoints
 * and updating volume metrics even without new swap events
 */
export const refreshStaleVolumeData = async ({
  context,
  currentTimestamp,
}: {
  context: Context;
  currentTimestamp: bigint;
}) => {
  const { db, network } = context;

  // Find pools with stale volume data (last update > 1 hour ago)
  const staleThreshold = currentTimestamp - BigInt(secondsInHour);

  const stalePools = await db.sql.query.dailyVolume.findMany({
      where: (fields, { lt }) => lt(fields.lastUpdated, staleThreshold),
      orderBy: (fields, { asc }) => [asc(fields.lastUpdated)],
      limit: 50, // Process in batches to avoid overloading
    });

  console.log(`Found ${stalePools.length} pools with stale volume data`);

  for (const stalePool of stalePools) {
    await refreshPoolVolume({
      poolAddress: stalePool.pool,
      currentTimestamp,
      context,
    });
  }
};

/**
 * Refreshes volume data for a specific pool by:
 * 1. Cleaning up expired checkpoints (older than 24h)
 * 2. Recalculating 24h volume based on remaining checkpoints
 * 3. Updating all related entity volume metrics
 */
export const refreshPoolVolume = async ({
  poolAddress,
  currentTimestamp,
  context,
}: {
  poolAddress: Address;
  currentTimestamp: bigint;
  context: Context;
}) => {
  const { db } = context;

  const volumeData = await db.sql.query.dailyVolume.findFirst({
    where: (fields, { eq }) => eq(fields.pool, poolAddress.toLowerCase() as `0x${string}`),
  });

  if (!volumeData) return;

  // Get related pool data to find the asset
  const poolData = await db.sql.query.pool.findFirst({
    where: (fields, { eq }) => eq(fields.address, poolAddress.toLowerCase() as `0x${string}`),
  });

  if (!poolData) return;

  // Filter out checkpoints older than 24 hours
  const checkpoints = volumeData.checkpoints as Record<string, string>;
  const cutoffTimestamp = currentTimestamp - BigInt(secondsInDay);

  const updatedCheckpoints = Object.fromEntries(
    Object.entries(checkpoints).filter(
      ([ts]) => BigInt(ts) >= cutoffTimestamp
    )
  );

  // Recalculate total volume based on remaining checkpoints
  const totalVolumeUsd = Object.values(updatedCheckpoints).reduce(
    (acc, vol) => acc + BigInt(vol),
    BigInt(0)
  );

  // Update the dailyVolume record
  await db
    .update(dailyVolume, {
      pool: poolAddress.toLowerCase() as `0x${string}`,
    })
    .set({
      volumeUsd: totalVolumeUsd,
      checkpoints: updatedCheckpoints,
      lastUpdated: currentTimestamp,
    });

  // Update related entities with the refreshed volume data
  await updatePool({
    poolAddress,
    context,
    update: {
      volumeUsd: totalVolumeUsd,
    },
  });

  if (poolData.asset) {
    await updateAsset({
      assetAddress: poolData.asset,
      context,
      update: {
        dayVolumeUsd: totalVolumeUsd,
      },
    });
  }

  // Update token volumes
  if (poolData.baseToken) {
    await updateToken({
      tokenAddress: poolData.baseToken,
      context,
      update: {
        volumeUsd: totalVolumeUsd,
      },
    });
  }
}