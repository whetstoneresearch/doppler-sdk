import { Context } from "ponder:registry";
import { activePoolsBlob, volumeBucket24h } from "ponder:schema";
import { Address } from "viem";
import {
  updateAsset,
  updatePool,
  updateToken,
} from "@app/indexer/shared/entities";
import { pool } from "ponder:schema";
import { get24HourVolumeAndPercentChange, getDayBucketTimestamp, DAY_IN_SECONDS } from "@app/utils/time-buckets";
import { MarketDataService } from "@app/core/market/MarketDataService";
import { and, eq, inArray } from "ponder";
interface ActivePools {
  [poolAddress: Address]: number;
}

export const insertActivePoolsBlobIfNotExists = async ({
  context,
}: {
  context: Context;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  const existingConfig = await db.find(activePoolsBlob, {
    chainId: BigInt(chainId),
  });

  if (existingConfig) {
    return existingConfig;
  }

  return await db.insert(activePoolsBlob).values({
    chainId: BigInt(chainId),
    activePools: {},
  });
};

export const updateActivePoolsBlob = async ({
  context,
  update,
}: {
  context: Context;
  update?: Partial<typeof activePoolsBlob.$inferInsert>;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  await db
    .update(activePoolsBlob, {
      chainId: BigInt(chainId),
    })
    .set({
      ...update,
    });
};

export const tryAddActivePool = async ({
  poolAddress,
  lastSwapTimestamp,
  context,
}: {
  poolAddress: Address;
  lastSwapTimestamp: number;
  context: Context;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  let existingData = await db.find(activePoolsBlob, {
    chainId: BigInt(chainId),
  });

  if (!existingData) {
    existingData = await insertActivePoolsBlobIfNotExists({
      context,
    });

  }

  if (!existingData) {
    throw new Error("Active pools blob not found");
  }

  const activePools = existingData.activePools as ActivePools;

  const data = {
    [poolAddress]: lastSwapTimestamp,
  };

  if (typeof activePools[poolAddress] === "number") {
    return;
  }

  await db
    .update(activePoolsBlob, {
      chainId: BigInt(chainId),
    })
    .set({
      activePools: {
        ...(existingData.activePools as ActivePools),
        ...data,
      },
    });
};


/**
 * Optimized batch refresh for active pools using pre-aggregated bucket data
 * Uses batch operations to minimize database round trips
 */
export const refreshActivePoolsBlobWithBucketsOptimized = async ({
  context,
  timestamp,
}: {
  context: Context;
  timestamp: number;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  const existingBlob = await db.find(activePoolsBlob, {
    chainId: BigInt(chainId),
  });

  if (!existingBlob) {
    return;
  }

  const activePools = existingBlob.activePools as ActivePools;
  const timestampMinusDay = timestamp - 86400;
  const currentDayTimestamp = getDayBucketTimestamp(BigInt(timestamp));
  const previousDayTimestamp = currentDayTimestamp - DAY_IN_SECONDS;

  // Filter pools that need updating (haven't been updated in last 24 hours)
  const poolsToRefresh = Object.entries(activePools)
    .filter(([_, lastSwapTimestamp]) => !lastSwapTimestamp || lastSwapTimestamp <= timestampMinusDay)
    .map(([poolAddress]) => poolAddress as Address);

  if (poolsToRefresh.length === 0) {
    return; // Nothing to update
  }

  // Batch fetch all current day buckets
  const currentBuckets = await db.sql
    .select()
    .from(volumeBucket24h)
    .where(
      and(
        eq(volumeBucket24h.chainId, BigInt(chainId)),
        eq(volumeBucket24h.timestamp, currentDayTimestamp),
        inArray(volumeBucket24h.poolAddress, poolsToRefresh)
      )
    );

  // Create a map for quick bucket lookup
  const bucketMap = new Map(
    currentBuckets.map(b => [b.poolAddress, b])
  );

  // Batch fetch all pool entities
  const poolEntities = await db.sql
    .select()
    .from(pool)
    .where(
      and(
        eq(pool.chainId, BigInt(chainId)),
        inArray(pool.address, poolsToRefresh)
      )
    );

  // Create a map for quick pool lookup
  const poolMap = new Map(
    poolEntities.map(p => [p.address, p])
  );

  // Prepare batch updates
  const poolUpdates: Array<{ address: Address; volumeUsd: bigint; percentDayChange: number; marketCapUsd: bigint | null }> = [];
  const assetUpdates: Map<Address, { dayVolumeUsd: bigint; percentDayChange: number; marketCapUsd: bigint | null }> = new Map();
  const tokenUpdates: Map<Address, { volumeUsd: bigint }> = new Map();
  const poolsToClear: Address[] = [];
  const poolTimestampUpdates: ActivePools = {};

  // Process all pools in one pass
  for (const poolAddress of poolsToRefresh) {
    const bucket = bucketMap.get(poolAddress);
    const poolEntity = poolMap.get(poolAddress);

    if (!bucket) {
      // No activity in last 24 hours
      poolsToClear.push(poolAddress);
      
      if (poolEntity) {
        // Zero out metrics
        poolUpdates.push({
          address: poolAddress,
          volumeUsd: 0n,
          percentDayChange: 0,
          marketCapUsd: null,
        });

        assetUpdates.set(poolEntity.asset, {
          dayVolumeUsd: 0n,
          percentDayChange: 0,
          marketCapUsd: null,
        });
      }
      continue;
    }

    if (!poolEntity) {
      continue;
    }

    // Calculate metrics from bucket
    const { volumeUsd, percentChange } = await get24HourVolumeAndPercentChange(
      context,
      poolAddress,
      BigInt(chainId),
      BigInt(timestamp)
    );

    // Add to batch updates
    poolUpdates.push({
      address: poolAddress,
      volumeUsd,
      percentDayChange: percentChange,
      marketCapUsd: bucket.marketCapUsd,
    });

    // Aggregate asset updates (in case multiple pools have same asset)
    const currentAssetUpdate = assetUpdates.get(poolEntity.asset);
    if (currentAssetUpdate) {
      assetUpdates.set(poolEntity.asset, {
        dayVolumeUsd: currentAssetUpdate.dayVolumeUsd + volumeUsd,
        percentDayChange: percentChange, // Use latest
        marketCapUsd: bucket.marketCapUsd || currentAssetUpdate.marketCapUsd,
      });
    } else {
      assetUpdates.set(poolEntity.asset, {
        dayVolumeUsd: volumeUsd,
        percentDayChange: percentChange,
        marketCapUsd: bucket.marketCapUsd,
      });
    }

    // Aggregate token updates
    const currentTokenUpdate = tokenUpdates.get(poolEntity.asset);
    if (currentTokenUpdate) {
      tokenUpdates.set(poolEntity.asset, {
        volumeUsd: currentTokenUpdate.volumeUsd + volumeUsd,
      });
    } else {
      tokenUpdates.set(poolEntity.asset, {
        volumeUsd,
      });
    }

    // Update timestamp
    poolTimestampUpdates[poolAddress] = Number(bucket.updatedAt);
  }

  // Execute batch updates in parallel
  await Promise.all([
    // Update pools
    ...poolUpdates.map(update =>
      updatePool({
        poolAddress: update.address,
        context,
        update: {
          volumeUsd: update.volumeUsd,
          percentDayChange: update.percentDayChange,
        },
      })
    ),
    // Update assets
    ...Array.from(assetUpdates.entries()).map(([assetAddress, update]) =>
      updateAsset({
        assetAddress,
        context,
        update: {
          dayVolumeUsd: update.dayVolumeUsd,
          percentDayChange: update.percentDayChange,
        },
      })
    ),
    // Update tokens
    ...Array.from(tokenUpdates.entries()).map(([tokenAddress, update]) =>
      updateToken({
        tokenAddress,
        context,
        update: {
          volumeUsd: update.volumeUsd,
        },
      })
    ),
  ]);

  // Update the active pools blob
  const updatedBlob = { ...activePools };
  
  // Remove inactive pools
  poolsToClear.forEach(poolAddress => {
    delete updatedBlob[poolAddress];
  });

  // Update timestamps
  Object.entries(poolTimestampUpdates).forEach(([poolAddress, timestamp]) => {
    updatedBlob[poolAddress as Address] = timestamp;
  });

  // Log stats
  const initialPoolCount = Object.keys(activePools).length;
  const finalPoolCount = Object.keys(updatedBlob).length;
  const skippedCount = initialPoolCount - poolsToRefresh.length;
  
  if (poolsToRefresh.length > 0) {
    console.log(`Batch refresh completed - Chain ${chainId}: 
      Initial pools: ${initialPoolCount}
      Final pools: ${finalPoolCount}
      Processed: ${poolsToRefresh.length}
      Removed: ${poolsToClear.length}
      Updated: ${poolUpdates.length}
      Skipped (recent): ${skippedCount}`);
  }

  await updateActivePoolsBlob({
    context,
    update: {
      activePools: updatedBlob,
    },
  });
};

/**
 * Refreshes active pools using the new bucket system
 * This is a more efficient version that uses pre-aggregated bucket data
 */
export const refreshActivePoolsBlobWithBuckets = async ({
  context,
  timestamp,
}: {
  context: Context;
  timestamp: number;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  const existingBlob = await db.find(activePoolsBlob, {
    chainId: BigInt(chainId),
  });

  if (!existingBlob) {
    return;
  }

  const poolsToProcess: Address[] = [];
  const timestampMinusDay = timestamp - 86400;

  // Process ALL pools in the active blob
  for (const [poolAddress, lastSwapTimestamp] of Object.entries(
    existingBlob.activePools as ActivePools
  )) {
    poolsToProcess.push(poolAddress as Address);
  }

  const poolsToClear: Address[] = [];
  const poolsToUpdate: ActivePools[] = [];
  let poolsSkipped = 0;

  await Promise.all(
    poolsToProcess.map(async (poolAddress) => {
      const lastSwapTimestamp = (existingBlob.activePools as ActivePools)[poolAddress];
      
      // Skip refresh if pool was recently updated
      if (lastSwapTimestamp && lastSwapTimestamp > timestampMinusDay) {
        poolsSkipped++;
        return;
      }

      // Get 24-hour volume from bucket
      const { volumeUsd, percentChange } = await get24HourVolumeAndPercentChange(
        context,
        poolAddress,
        BigInt(chainId),
        BigInt(timestamp)
      );

      // Get the current day's bucket for market cap data
      const currentDayTimestamp = getDayBucketTimestamp(BigInt(timestamp));
      const bucket = await db.find(volumeBucket24h, {
        poolAddress: poolAddress as `0x${string}`,
        timestamp: currentDayTimestamp,
        chainId: BigInt(chainId),
      });

      if (!bucket) {
        // No bucket data for today means no swaps in last 24 hours
        poolsToClear.push(poolAddress);
        
        const poolEntity = await db.find(pool, {
          address: poolAddress,
          chainId: BigInt(chainId),
        });
        
        if (poolEntity) {
          // Zero out daily metrics since there's no activity
          await Promise.all([
            updatePool({
              poolAddress,
              context,
              update: {
                volumeUsd: 0n,
                percentDayChange: 0,
              },
            }),
            updateAsset({
              assetAddress: poolEntity.asset,
              context,
              update: {
                dayVolumeUsd: 0n,
                percentDayChange: 0,
              },
            }),
          ]);
        }
        return;
      }

      // Get the previous day's bucket for % change calculation
      const previousDayTimestamp = currentDayTimestamp - BigInt(86400);
      const previousBucket = await db.find(volumeBucket24h, {
        poolAddress: poolAddress as `0x${string}`,
        timestamp: previousDayTimestamp,
        chainId: BigInt(chainId),
      });

      // Calculate percent change using market cap
      const percentDayChange = percentChange;

      // Update pool to refresh (using the bucket's last update time)
      poolsToUpdate.push({
        [poolAddress]: Number(bucket.updatedAt),
      });

      // Get pool entity to find associated asset
      const poolEntity = await db.find(pool, {
        address: poolAddress,
        chainId: BigInt(chainId),
      });

      if (!poolEntity) {
        return;
      }

      // Update all entities with bucket data
      await updatePool({
        poolAddress,
        context,
        update: {
          volumeUsd: volumeUsd,
          percentDayChange,
          marketCapUsd: bucket.marketCapUsd,
        },
      });

      await updateToken({
        tokenAddress: poolEntity.asset,
        context,
        update: {
          volumeUsd: volumeUsd,
        },
      });

      await updateAsset({
        assetAddress: poolEntity.asset,
        context,
        update: {
          dayVolumeUsd: volumeUsd,
          percentDayChange,
          marketCapUsd: bucket.marketCapUsd,
        },
      });
    })
  );

  // Update the active pools blob
  const blob = existingBlob.activePools as ActivePools;
  
  poolsToClear.forEach((poolAddress) => {
    delete blob[poolAddress];
  });

  poolsToUpdate.forEach((record) => {
    Object.entries(record).forEach(([poolAddress, lastSwapTimestamp]) => {
      blob[poolAddress as Address] = lastSwapTimestamp;
    });
  });

  // Log cleanup stats
  const initialPoolCount = Object.keys(existingBlob.activePools as ActivePools).length;
  const finalPoolCount = Object.keys(blob).length;
  
  if (poolsToClear.length > 0 || poolsToUpdate.length > 0 || initialPoolCount !== finalPoolCount) {
    console.log(`Active pools blob update - Chain ${chainId}: 
      Initial pools: ${initialPoolCount}
      Final pools: ${finalPoolCount}
      Removed (no 24h activity): ${poolsToClear.length}
      Updated with data: ${poolsToUpdate.length}
      Skipped (recent activity): ${poolsSkipped}`);
  }

  await updateActivePoolsBlob({
    context,
    update: {
      activePools: blob,
    },
  });
};
