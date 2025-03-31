import { Context } from "ponder:registry";
import { Address } from "viem";
import {
  secondsInHour,
  secondsInDay,
  CHAINLINK_ETH_DECIMALS,
} from "@app/utils/constants";
import { pool, dailyVolume } from "ponder.schema";
import { and, eq, lt, sql, or, not } from "drizzle-orm";
import { updateAsset } from "./entities/asset";
import { updatePool } from "./entities/pool";
import { fetchEthPrice } from "./oracle";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertAssetIfNotExists } from "@app/indexer/shared/entities/asset";
import { update24HourPriceChange, updateDailyVolume } from "./timeseries";

/**
 * Executes a comprehensive refresh job that handles both volume and metrics updates
 * in a coordinated way to minimize database updates
 */
export const executeScheduledJobs = async ({
  context,
  currentTimestamp,
}: {
  context: Context;
  currentTimestamp: bigint;
}) => {
  const { network } = context;
  const chainId = BigInt(network.chainId);

  console.log(`[${network.name}] Running comprehensive refresh job...`);
  const startTime = Date.now();

  try {
    // Get ETH price once for all calculations
    const ethPrice = await fetchEthPrice(currentTimestamp, context);
    if (!ethPrice) {
      console.error(
        `[${network.name}] Failed to get ETH price, skipping refresh`
      );
      return;
    }

    // Find pools that need refreshing (either volume or metrics)
    // This finds pools that either have stale volume data or haven't been refreshed recently
    const staleThreshold = currentTimestamp - BigInt(secondsInHour);
    const stalePoolsWithVolume = await findStalePoolsWithVolume(
      context,
      staleThreshold,
      currentTimestamp,
      chainId
    );

    if (stalePoolsWithVolume.length === 0) {
      console.log(`[${network.name}] No pools need updating`);
      return;
    }

    console.log(
      `[${network.name}] Found ${stalePoolsWithVolume.length} pools to update`
    );

    // Process in parallel batches with larger batch size for better performance
    const BATCH_SIZE = 50; // Increased from 20 to 50 for better parallelism

    for (let i = 0; i < stalePoolsWithVolume.length; i += BATCH_SIZE) {
      const batch = stalePoolsWithVolume.slice(i, i + BATCH_SIZE);

      // Process batch in parallel with more concurrency
      await Promise.all(
        batch.map((poolInfo: any) =>
          refreshPoolComprehensive({
            poolInfo,
            ethPrice,
            currentTimestamp,
            context,
          })
        )
      );

      // Log progress for larger batches
      if (stalePoolsWithVolume.length > BATCH_SIZE) {
        console.log(
          `[${network.name}] Processed ${Math.min(
            i + BATCH_SIZE,
            stalePoolsWithVolume.length
          )}/${stalePoolsWithVolume.length} pools`
        );
      }
    }

    // Log performance metrics
    const duration = (Date.now() - startTime) / 1000; // in seconds
    console.log(
      `[${network.name}] Refreshed ${stalePoolsWithVolume.length
      } pools in ${duration.toFixed(2)}s (${(
        duration / stalePoolsWithVolume.length
      ).toFixed(3)}s per pool)`
    );
  } catch (error) {
    console.error(
      `Error in comprehensive refresh job for ${network.name}:`,
      error
    );
  }
};

/**
 * Helper function to find pools that need updating (either volume or metrics)
 * Joins pool and daily_volume data to identify all pools that need attention.
 * Uses lastSwapTimestamp field to only process pools with recent swap activity
 * that haven't been refreshed since their last swap.
 */
async function findStalePoolsWithVolume(
  context: Context,
  staleThreshold: bigint,
  currentTimestamp: bigint,
  chainId: bigint
) {
  const { db } = context;

  try {
    const results = await db.sql
      .select({
        // Pool fields
        address: pool.address,
        chain_id: pool.chainId,
        is_token0: pool.isToken0,
        base_token: pool.baseToken,
        price: pool.price,
        reserves0: pool.reserves0,
        reserves1: pool.reserves1,
        dollar_liquidity: pool.dollarLiquidity,
        asset: pool.asset,
        created_at: pool.createdAt,
        last_refreshed: pool.lastRefreshed,
        last_swap_timestamp: pool.lastSwapTimestamp,
        percent_day_change: pool.percentDayChange,
        // Volume fields
        volume_usd: dailyVolume.volumeUsd,
        checkpoints: dailyVolume.checkpoints,
        last_updated: dailyVolume.lastUpdated,
        inactive: dailyVolume.inactive,
      })
      .from(pool)
      .leftJoin(dailyVolume, eq(pool.address, dailyVolume.pool))
      .where(
        and(
          eq(pool.chainId, chainId),
          or(
            eq(dailyVolume.inactive, false),
            not(eq(dailyVolume.checkpoints, {}))
          ),
          lt(
            dailyVolume.earliestCheckpoint,
            currentTimestamp - BigInt(secondsInDay)
          )
        )
      )
      .orderBy(sql`COALESCE(${pool.lastRefreshed}, ${pool.createdAt})`)
      .limit(100);

    console.log(`Found ${results.length} pools needing refresh`);

    // Transform results into a useful format
    return results.map((row) => ({
      pool: {
        address: row.address,
        chainId: row.chain_id,
        isToken0: row.is_token0,
        baseToken: row.base_token,
        price: row.price,
        reserves0: row.reserves0,
        reserves1: row.reserves1,
        dollarLiquidity: row.dollar_liquidity,
        asset: row.asset,
        createdAt: row.created_at,
        percentDayChange: row.percent_day_change,
      },
      volume: {
        volumeUsd: row.volume_usd,
        checkpoints: row.checkpoints,
        lastUpdated: row.last_updated,
        inactive: row.inactive,
      },
    }));
  } catch (error) {
    console.error(`Error finding stale pools: ${error}`);
    return [];
  }
}

/**
 * Refreshes a single pool's data comprehensively:
 * - Updates volume data by cleaning old checkpoints
 * - Updates metrics like price change and dollar liquidity
 * - Makes a single DB update to minimize writes
 */
async function refreshPoolComprehensive({
  poolInfo,
  ethPrice,
  currentTimestamp,
  context,
}: {
  poolInfo: {
    pool: {
      address: string;
      chainId: bigint;
      isToken0: boolean;
      baseToken: string;
      price: bigint;
      reserves0: bigint;
      reserves1: bigint;
      dollarLiquidity: bigint;
      asset: string;
      createdAt: bigint;
      percentDayChange: number;
    };
    volume: {
      volumeUsd: bigint;
      checkpoints: Record<string, string>;
      lastUpdated: bigint;
    };
    needsVolumeUpdate: boolean;
    needsMetricsUpdate: boolean;
  };
  ethPrice: bigint;
  currentTimestamp: bigint;
  context: Context;
}) {
  const poolAddress = poolInfo.pool.address as Address;

  await updateDailyVolume({
    poolAddress,
    asset: poolInfo.pool.asset as Address,
    volumeData: poolInfo.volume,
    timestamp: currentTimestamp,
    context,
  });

  const asset = await insertAssetIfNotExists({ assetAddress: poolInfo.pool.asset as Address, timestamp: 0n, context });

  const isMigrated = asset.migrated;

  const assetBalance = poolInfo.pool.isToken0 ? poolInfo.pool.reserves0 : poolInfo.pool.reserves1;
  const quoteBalance = poolInfo.pool.isToken0 ? poolInfo.pool.reserves1 : poolInfo.pool.reserves0;

  const dollarLiquidity = await computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price: poolInfo.pool.price,
    ethPrice,
  });

  const priceChangeInfo = await update24HourPriceChange({
    poolAddress,
    assetAddress: asset.address,
    currentPrice: poolInfo.pool.price,
    currentTimestamp,
    ethPrice,
    createdAt: poolInfo.pool.createdAt,
    context,
  });

  const marketCap = await getAssetMarketCap({
    assetAddress: poolInfo.pool.asset as Address,
    price: poolInfo.pool.price,
    ethPrice,
    context,
  });

  const poolUpdate: any = {
    percentDayChange: priceChangeInfo,
  };

  if (dollarLiquidity) {
    poolUpdate.dollarLiquidity = dollarLiquidity;
  }

  await updatePool({
    poolAddress,
    context,
    update: poolUpdate,
  });

  const assetUpdate: any = {
    percentDayChange: priceChangeInfo,
  };

  if (dollarLiquidity) {
    assetUpdate.liquidityUsd = dollarLiquidity;
  }
  if (marketCap) {
    assetUpdate.marketCapUsd = marketCap;
  }

  await updateAsset({
    assetAddress: poolInfo.pool.asset as Address,
    context,
    update: assetUpdate,
  });
  // } catch (error) {
  //   console.error(`Failed to refresh pool ${poolAddress}: ${error}`);
  // }
}


/**
 * Computes the market cap for an asset
 * @returns The market cap in USD or null if it cannot be calculated
 */
export const getAssetMarketCap = async ({
  assetAddress,
  price,
  ethPrice,
  context,
}: {
  assetAddress: Address;
  price: bigint;
  ethPrice: bigint;
  context: Context;
}): Promise<bigint> => {
  // Return null if price is 0
  if (price === 0n) {
    return 0n;
  }

  const { client } = context;

  try {
    // Get total supply
    let totalSupply: bigint | null = null;
    // Read from contract
    const totalSupplyResult = await client
      .readContract({
        address: assetAddress,
        abi: [
          {
            name: "totalSupply",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint256" }],
          },
        ],
        functionName: "totalSupply",
      })
      .catch((err) => {
        return null;
      });

    if (totalSupplyResult) {
      totalSupply = totalSupplyResult as bigint;
    }

    if (totalSupply) {
      const marketCap = (price * totalSupply) / BigInt(10 ** 18);
      const marketCapUsd = (marketCap * ethPrice) / CHAINLINK_ETH_DECIMALS;
      return marketCapUsd;
    }

    return 0n;
  } catch (error) {
    // Less verbose error handling
    console.error(
      `Market cap calculation failed for ${assetAddress.slice(0, 8)}...`
    );
    return 0n;
  }
};
