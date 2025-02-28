import { Address } from "viem";
import { dailyVolume, pool } from "ponder.schema";
import { Context } from "ponder:registry";
import { secondsInDay, secondsInHour } from "@app/utils/constants";
import { and, eq, lt } from "drizzle-orm";
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
  let staleVolumeRecords = [];

  try {
    // Use the sql.select approach for consistency
    staleVolumeRecords = await db.sql
      .select()
      .from(dailyVolume)
      .where(
        and(
          lt(dailyVolume.lastUpdated, staleThreshold),
          eq(dailyVolume.chainId, chainId)
        )
      )
      .orderBy(dailyVolume.lastUpdated)
      .limit(50); // Process in batches to avoid overloading
  } catch (error) {
    // Handle case where tables might not exist yet
    console.log(
      `Volume tables not ready yet on chain ${network.name}: ${error}`
    );
    return; // Exit early if tables aren't ready
  }

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

  let volumeData, poolData;

  try {
    volumeData = await db.sql.query.dailyVolume.findFirst({
      where: (fields, { eq }) =>
        eq(fields.pool, poolAddress.toLowerCase() as `0x${string}`),
    });

    if (!volumeData) return;

    // Get related pool data to find the asset
    poolData = await db.sql.query.pool.findFirst({
      where: (fields, { eq }) =>
        eq(fields.address, poolAddress.toLowerCase() as `0x${string}`),
    });

    if (!poolData) return;
  } catch (error) {
    console.log(`Tables not ready yet for pool ${poolAddress}: ${error}`);
    return; // Exit early if tables aren't ready
  }

  try {
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

    // Check if anything has changed before updating
    const checkpointsChanged =
      JSON.stringify(checkpoints) !== JSON.stringify(updatedCheckpoints);
    const volumeChanged = volumeData.volumeUsd !== totalVolumeUsd;

    // Always update the lastUpdated timestamp regardless of changes
    // This ensures that stale pools are processed only once per cycle

    if (checkpointsChanged || volumeChanged) {
      // Update data only if something has actually changed
      console.log(
        `Updating volume for pool ${poolAddress} (${volumeData.volumeUsd} → ${totalVolumeUsd})`
      );

      try {
        await db
          .update(dailyVolume, {
            pool: poolAddress.toLowerCase() as `0x${string}`,
          })
          .set({
            volumeUsd: totalVolumeUsd,
            checkpoints: updatedCheckpoints,
            lastUpdated: currentTimestamp,
          });
      } catch (error) {
        console.error(
          `Failed to update dailyVolume for ${poolAddress}: ${error}`
        );
        // Even if this update fails, we'll try to update the timestamp separately
      }
    } else {
      console.log(
        `No volume changes for pool ${poolAddress}, skipping volume update`
      );
    }

    try {
      // ALWAYS update the lastUpdated timestamp to prevent repeated processing of the same pools
      await db
        .update(dailyVolume, {
          pool: poolAddress.toLowerCase() as `0x${string}`,
        })
        .set({
          lastUpdated: currentTimestamp,
        });
    } catch (error) {
      console.error(
        `Failed to update lastUpdated timestamp for ${poolAddress}: ${error}`
      );
    }

    // If no volume changes, skip updating related entities
    if (!volumeChanged) {
      return;
    }

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
  } catch (error) {
    console.error(`Error refreshing volume for pool ${poolAddress}: ${error}`);
  }
};
