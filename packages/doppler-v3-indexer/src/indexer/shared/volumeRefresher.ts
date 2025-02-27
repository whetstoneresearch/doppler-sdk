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
  const chainId = BigInt(network.chainId);

  // Find pools with stale volume data (last update > 1 hour ago)
  // that belong to the current chain
  const staleThreshold = currentTimestamp - BigInt(secondsInHour);

  // Get stale volume records for this specific chain
  const staleVolumeRecords = await db.sql.query.dailyVolume.findMany({
    where: (fields, { lt, eq }) =>
      lt(fields.lastUpdated, staleThreshold) && eq(fields.chainId, chainId),
    orderBy: (fields, { asc }) => [asc(fields.lastUpdated)],
    limit: 50, // Process in batches to avoid overloading
  });

  console.log(
    `Found ${staleVolumeRecords.length} pools with stale volume data on chain ${network.name}`
  );

  for (const staleRecord of staleVolumeRecords) {
    await refreshPoolVolume({
      poolAddress: staleRecord.pool,
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
  const { db, network } = context;

  const volumeData = await db.sql.query.dailyVolume.findFirst({
    where: (fields, { eq }) =>
      eq(fields.pool, poolAddress.toLowerCase() as `0x${string}`),
  });

  if (!volumeData) return;

  // Get related pool data to find the asset
  const poolData = await db.sql.query.pool.findFirst({
    where: (fields, { eq }) =>
      eq(fields.address, poolAddress.toLowerCase() as `0x${string}`),
  });

  if (!poolData) return;

  // Filter out checkpoints older than 24 hours
  const checkpoints = volumeData.checkpoints as Record<string, string>;
  const cutoffTimestamp = currentTimestamp - BigInt(secondsInDay);

  const updatedCheckpoints = Object.fromEntries(
    Object.entries(checkpoints).filter(([ts]) => BigInt(ts) >= cutoffTimestamp)
  );

  // Recalculate total volume based on remaining checkpoints
  const totalVolumeUsd = Object.values(updatedCheckpoints).reduce(
    (acc, vol) => acc + BigInt(vol),
    BigInt(0)
  );

  // Check if anything has changed before updating
  const checkpointsChanged = 
    JSON.stringify(checkpoints) !== JSON.stringify(updatedCheckpoints);
  const volumeChanged = volumeData.volumeUsd !== totalVolumeUsd;
  
  // Only update if there's an actual change (checkpoints removed or volume changed)
  if (checkpointsChanged || volumeChanged) {
    console.log(`Updating volume for pool ${poolAddress} (${volumeData.volumeUsd} → ${totalVolumeUsd})`);
    
    await db
      .update(dailyVolume, {
        pool: poolAddress.toLowerCase() as `0x${string}`,
      })
      .set({
        volumeUsd: totalVolumeUsd,
        checkpoints: updatedCheckpoints,
        lastUpdated: currentTimestamp,
      });
  } else {
    // Just update the lastUpdated timestamp to prevent repeated processing
    await db
      .update(dailyVolume, {
        pool: poolAddress.toLowerCase() as `0x${string}`,
      })
      .set({
        lastUpdated: currentTimestamp,
      });
    
    // Skip further updates if volume hasn't changed
    return;
  }

  // Only update related entities if the volume actually changed
  // Avoids unnecessary database updates
  if (volumeChanged) {
    // Update related entities with the refreshed volume data
    try {
      await updatePool({
        poolAddress,
        context,
        update: {
          volumeUsd: totalVolumeUsd,
        },
      });
    } catch (error) {
      console.error(`Failed to update pool ${poolAddress}: ${error}`);
      // Continue with other updates rather than failing the whole job
    }

    if (poolData.asset) {
      try {
        await updateAsset({
          assetAddress: poolData.asset,
          context,
          update: {
            dayVolumeUsd: totalVolumeUsd,
          },
        });
      } catch (error) {
        console.error(`Failed to update asset ${poolData.asset}: ${error}`);
      }
    }

    // Update token volumes
    if (poolData.baseToken) {
      try {
        await updateToken({
          tokenAddress: poolData.baseToken,
          context,
          update: {
            volumeUsd: totalVolumeUsd,
          },
        });
      } catch (error) {
        console.error(`Failed to update token ${poolData.baseToken}: ${error}`);
      }
    }
  }
};
