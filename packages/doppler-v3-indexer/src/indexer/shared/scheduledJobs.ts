import { Context } from "ponder:registry";
import { activePoolsBlob, volumeBucket24h } from "ponder:schema";
import { Address } from "viem";
import {
  updateAsset,
  updatePool,
  updateToken,
} from "@app/indexer/shared/entities";
import { pool } from "ponder:schema";
import { get24HourVolume, getDayBucketTimestamp } from "@app/utils/time-buckets";
import { MarketDataService } from "@app/core/market/MarketDataService";
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
      if (lastSwapTimestamp > timestampMinusDay) {
        poolsSkipped++;
        return;
      }

      // Get 24-hour volume from bucket
      const volume24h = await get24HourVolume(
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
      const percentDayChange = previousBucket 
        ? MarketDataService.calculatePriceChange(
            bucket.marketCapUsd,
            previousBucket.marketCapUsd
          )
        : 0;

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
          volumeUsd: volume24h,
          percentDayChange,
          marketCapUsd: bucket.marketCapUsd,
        },
      });

      await updateToken({
        tokenAddress: poolEntity.asset,
        context,
        update: {
          volumeUsd: volume24h,
        },
      });

      await updateAsset({
        assetAddress: poolEntity.asset,
        context,
        update: {
          dayVolumeUsd: volume24h,
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
