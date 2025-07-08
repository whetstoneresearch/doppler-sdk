import { Context } from "ponder:registry";
import { activePoolsBlob, dailyVolume } from "ponder:schema";
import { Address, formatEther } from "viem";
import {
  updateAsset,
  updatePool,
  updateToken,
} from "@app/indexer/shared/entities";
import { pool } from "ponder:schema";
import { secondsInDay } from "@app/utils/constants";
import { compute24HourPriceChange, updateDailyVolume } from "./timeseries";
import { DayMetrics } from "./timeseries";
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

export const refreshActivePoolsBlob = async ({
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

  for (const [poolAddress, lastSwapTimestamp] of Object.entries(
    existingBlob.activePools as ActivePools
  )) {
    // ignore pools that dont have an earliest timestamp that is greater than the timestamp minus 24 hours
    if (lastSwapTimestamp > timestampMinusDay) {
      continue;
    }

    poolsToRefresh.push(poolAddress as Address);
  }

  const poolsToClear: Address[] = [];
  const poolsToUpdate: ActivePools[] = [];

  await Promise.all(
    poolsToRefresh.map(async (poolAddress) => {
      const volumeEntity = await db.find(dailyVolume, {
        pool: poolAddress,
      });

      if (!volumeEntity) {
        return null;
      }
      const { checkpoints } = volumeEntity;

      const volumeCheckpoints = checkpoints as Record<string, DayMetrics>;

      const updatedCheckpoints = Object.fromEntries(
        Object.entries(volumeCheckpoints).filter(
          ([ts]) => BigInt(ts) >= BigInt(timestamp) - BigInt(secondsInDay)
        )
      );

      const oldestCheckpointTime =
        Object.keys(updatedCheckpoints).length > 0
          ? BigInt(Math.min(...Object.keys(updatedCheckpoints).map(Number)))
          : undefined;

      const newestCheckpointTime =
        Object.keys(updatedCheckpoints).length > 0
          ? BigInt(Math.max(...Object.keys(updatedCheckpoints).map(Number)))
          : undefined;

      const totalVolumeUsd = oldestCheckpointTime
        ? Object.values(updatedCheckpoints).reduce((acc, vol) => {
          return acc + BigInt(vol.volumeUsd);
        }, BigInt(0))
        : 0n;

      if (!oldestCheckpointTime) {
        poolsToClear.push(poolAddress);
      } else {
        poolsToUpdate.push({
          [poolAddress]: Number(oldestCheckpointTime),
        });
      }

      const newestMarketCapUsd = newestCheckpointTime
        ? BigInt(
          volumeCheckpoints[newestCheckpointTime!.toString()]?.marketCapUsd ||
          "0"
        )
        : 0n;

      const percentDayChange = await compute24HourPriceChange({
        poolAddress,
        marketCapUsd: newestMarketCapUsd,
        context,
      });

      if (newestCheckpointTime) {
        poolsToUpdate.push({
          [poolAddress]: Number(newestCheckpointTime),
        });
      }

      const volumeEntityUpdate = {
        poolAddress,
        volumeUsd: totalVolumeUsd,
        checkpoints: updatedCheckpoints,
        lastUpdated: BigInt(timestamp),
      };

      await updateDailyVolume({
        poolAddress,
        volumeData: volumeEntityUpdate,
        context,
      });

      const poolEntity = await db.find(pool, {
        address: poolAddress,
        chainId: BigInt(chainId),
      });

      if (!poolEntity) {
        return;
      }

      await updatePool({
        poolAddress,
        context,
        update: {
          volumeUsd: totalVolumeUsd,
          percentDayChange: Number(percentDayChange),
        },
      });

      await updateToken({
        tokenAddress: poolEntity.asset,
        context,
        update: {
          volumeUsd: totalVolumeUsd,
        },
      });

      await updateAsset({
        assetAddress: poolEntity.asset,
        context,
        update: {
          dayVolumeUsd: totalVolumeUsd,
          percentDayChange: Number(percentDayChange),
        },
      });
    })
  );

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
