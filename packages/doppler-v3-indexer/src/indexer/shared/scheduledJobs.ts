import { Context } from "ponder:registry";
import { activePoolsBlob, volumeBucket24h } from "ponder:schema";
import { Address, formatEther } from "viem";
import {
  updateAsset,
  updatePool,
  updateToken,
} from "@app/indexer/shared/entities";
import { pool } from "ponder:schema";
import { get24HourVolume, getDayBucketTimestamp } from "@app/utils/time-buckets";
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

  const poolsToRefresh: Address[] = [];
  const timestampMinusDay = timestamp - 86400;

  // Find pools that haven't been refreshed in the last 24 hours
  for (const [poolAddress, lastSwapTimestamp] of Object.entries(
    existingBlob.activePools as ActivePools
  )) {
    if (lastSwapTimestamp > timestampMinusDay) {
      continue;
    }
    poolsToRefresh.push(poolAddress as Address);
  }

  const poolsToClear: Address[] = [];
  const poolsToUpdate: ActivePools[] = [];

  await Promise.all(
    poolsToRefresh.map(async (poolAddress) => {
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
        poolsToClear.push(poolAddress);
        return;
      }

      // Get the previous day's bucket for % change calculation
      const previousDayTimestamp = currentDayTimestamp - BigInt(86400);
      const previousBucket = await db.find(volumeBucket24h, {
        poolAddress: poolAddress as `0x${string}`,
        timestamp: previousDayTimestamp,
        chainId: BigInt(chainId),
      });

      // Calculate percent change
      let percentDayChange = 0;
      if (previousBucket && previousBucket.marketCapUsd > 0n) {
        const currentMarketCap = bucket.marketCapUsd;
        const previousMarketCap = previousBucket.marketCapUsd;
        percentDayChange = Number(
          formatEther(
            ((currentMarketCap - previousMarketCap) * BigInt(1e18)) / previousMarketCap
          )
        ) * 100;
      }

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

  await updateActivePoolsBlob({
    context,
    update: {
      activePools: blob,
    },
  });
};
