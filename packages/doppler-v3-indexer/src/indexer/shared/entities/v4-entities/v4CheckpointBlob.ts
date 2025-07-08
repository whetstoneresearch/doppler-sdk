import { Context } from "ponder:registry";
import { v4CheckpointBlob } from "ponder:schema";
import { Address, parseEther } from "viem";
import { getLatestSqrtPrice } from "@app/utils/v4-utils/getV4PoolData";
import { PoolKey } from "@app/types/v4-types";
import { PriceService } from "@app/core";
import { computeMarketCap, fetchEthPrice } from "../../oracle";
import { insertAssetIfNotExists, updateAsset, updatePool } from "..";
import { pool } from "ponder:schema";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { addAndUpdateV4PoolPriceHistory } from "./v4PoolPriceHistory";

interface V4PoolCheckpoint {
  [poolAddress: Address]: Checkpoint;
}

interface Checkpoint {
  poolKey: PoolKey;
  asset: Address;
  isToken0: boolean;
  totalSupply: string;
  startingTime: string;
  endingTime: string;
  epochLength: string;
  lastUpdated: string;
}

export const insertCheckpointBlobIfNotExist = async ({
  context,
}: {
  context: Context;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  const existingConfig = await db.find(v4CheckpointBlob, {
    chainId,
  });

  if (existingConfig) {
    return existingConfig;
  }

  return await db.insert(v4CheckpointBlob).values({
    chainId,
    checkpoints: {},
  });
};

export const updateCheckpointBlob = async ({
  context,
  update,
}: {
  context: Context;
  update?: Partial<typeof v4CheckpointBlob.$inferInsert>;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  await db
    .update(v4CheckpointBlob, {
      chainId,
    })
    .set({
      ...update,
    });
};

export const addCheckpoint = async ({
  poolAddress,
  asset,
  totalSupply,
  startingTime,
  endingTime,
  epochLength,
  isToken0,
  poolKey,
  context,
}: {
  poolAddress: Address;
  asset: Address;
  totalSupply: bigint;
  startingTime: bigint;
  endingTime: bigint;
  epochLength: bigint;
  isToken0: boolean;
  poolKey: PoolKey;
  context: Context;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  const checkpointWithoutBigInts = {
    poolKey,
    asset,
    isToken0,
    totalSupply: totalSupply.toString(),
    startingTime: startingTime.toString(),
    endingTime: endingTime.toString(),
    epochLength: epochLength.toString(),
    lastUpdated: startingTime.toString(),
  };

  const existingData = await db.find(v4CheckpointBlob, {
    chainId,
  });

  if (!existingData) {
    throw new Error("V4 pool checkpoints not found");
  }

  // Ensure existingCheckpoints is an object, not the string "{}"
  let existingCheckpoints: V4PoolCheckpoint = {};
  if (
    typeof existingData.checkpoints === "string" &&
    existingData.checkpoints === "{}"
  ) {
    existingCheckpoints = {};
  } else if (existingData.checkpoints) {
    existingCheckpoints = existingData.checkpoints as V4PoolCheckpoint;
  }

  const data: V4PoolCheckpoint = {
    [poolAddress]: {
      ...checkpointWithoutBigInts,
    },
  };

  await db
    .update(v4CheckpointBlob, {
      chainId,
    })
    .set({
      checkpoints: {
        ...existingCheckpoints, // Use the safely parsed/initialized object
        ...data,
      },
    });
};

export const refreshCheckpointBlob = async ({
  context,
  timestamp,
}: {
  context: Context;
  timestamp: number;
}) => {
  const { db, chain } = context;
  const chainId = chain.id;

  const existingData = await db.find(v4CheckpointBlob, {
    chainId,
  });

  if (!existingData) {
    return;
  }

  // Ensure checkpoints is an object, not the string "{}"
  let checkpoints: V4PoolCheckpoint = {};
  if (
    typeof existingData.checkpoints === "string" &&
    existingData.checkpoints === "{}"
  ) {
    checkpoints = {};
  } else if (existingData.checkpoints) {
    checkpoints = existingData.checkpoints as V4PoolCheckpoint;
  }

  const poolsToRefresh: Address[] = [];
  const updatedCheckpoints: V4PoolCheckpoint = {};

  for (const [poolAddress, checkpoint] of Object.entries(checkpoints)) {
    // remove pools that have ended
    if (checkpoint.endingTime <= timestamp) {
      continue;
    }

    // skip pools that havent started yet
    if (timestamp < checkpoint.startingTime) {
      updatedCheckpoints[poolAddress as Address] = checkpoint;
      continue;
    }

    // calculate current epoch and last updated epoch
    const currentEpoch = Math.floor(
      (timestamp - checkpoint.startingTime) / checkpoint.epochLength
    );
    const lastUpdatedEpoch = Math.floor(
      (checkpoint.lastUpdated - checkpoint.startingTime) /
      checkpoint.epochLength
    );

    if (currentEpoch > lastUpdatedEpoch) {
      checkpoint.lastUpdated = timestamp;
      poolsToRefresh.push(poolAddress as Address);
    }

    updatedCheckpoints[poolAddress as Address] = checkpoint;
  }

  const ethPrice = await fetchEthPrice(BigInt(timestamp), context);

  const updates = await Promise.all(
    poolsToRefresh.map(async (poolAddress) => {
      const checkpoint = checkpoints[poolAddress as Address];

      if (!checkpoint) {
        throw new Error("Checkpoint not found");
      }

      let sqrtPriceX96: bigint;
      let tick: number;
      let amount0: bigint;
      let amount1: bigint;
      try {
        const result = await getLatestSqrtPrice({
          isToken0: checkpoint.isToken0,
          poolKey: checkpoint.poolKey,
          context,
        });

        sqrtPriceX96 = result.sqrtPriceX96;
        tick = result.tick;
        amount0 = result.amount0;
        amount1 = result.amount1;
      } catch (error) {
        // remove it from the list of pools to refresh
        delete updatedCheckpoints[poolAddress as Address];
        console.info(
          `Error getting latest sqrt price, removing pool ${poolAddress} from refresh list`
        );
        return null;
      }

      return {
        poolAddress,
        isToken0: checkpoint.isToken0,
        sqrtPriceX96,
        tick,
        totalSupply: checkpoint.totalSupply,
        asset: checkpoint.asset,
        amount0,
        amount1,
      };
    })
  );

  for (const update of updates) {
    if (!update) {
      continue;
    }

    const {
      poolAddress,
      sqrtPriceX96,
      tick,
      totalSupply,
      asset: assetAddress,
      isToken0,
      amount0,
      amount1,
    } = update;

    const poolEntity = await db.find(pool, {
      address: poolAddress,
      chainId: BigInt(chainId),
    });

    if (!poolEntity) {
      console.error("Pool not found");
      continue;
    }

    const price = PriceService.computePriceFromSqrtPriceX96({
      sqrtPriceX96,
      isToken0,
      decimals: 18,
    });

    const marketCapUsd = computeMarketCap({
      price,
      ethPrice,
      totalSupply: BigInt(totalSupply),
    });

    const liquidityUsd = computeDollarLiquidity({
      assetBalance: isToken0 ? amount0 : amount1,
      quoteBalance: isToken0 ? amount1 : amount0,
      price,
      ethPrice,
    });

    await Promise.all([
      updatePool({
        poolAddress,
        context,
        update: {
          price,
          tick,
          sqrtPrice: sqrtPriceX96,
          dollarLiquidity: liquidityUsd,
          marketCapUsd,
        },
      }),
      updateAsset({
        assetAddress,
        context,
        update: {
          marketCapUsd,
          liquidityUsd,
        },
      }),
      addAndUpdateV4PoolPriceHistory({
        pool: poolAddress,
        timestamp,
        marketCapUsd,
        context,
      }),
    ]);
  }

  await db
    .update(v4CheckpointBlob, {
      chainId,
    })
    .set({
      checkpoints: updatedCheckpoints,
    });

  return poolsToRefresh;
};
