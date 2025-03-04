import { Context } from "ponder:registry";
import { Address } from "viem";
import {
  secondsInHour,
  secondsInDay,
  CHAINLINK_ETH_DECIMALS,
} from "@app/utils/constants";
import { pool, asset, hourBucketUsd, dailyVolume } from "ponder.schema";
import {
  and,
  eq,
  or,
  isNull,
  isNotNull,
  lt,
  gt,
  sql,
  between,
} from "drizzle-orm";
import { updatePool } from "./entities/pool";
import { updateAsset } from "./entities/asset";
import { fetchEthPrice } from "./oracle";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { calculatePriceChange } from "./timeseries";

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
  const { network, db } = context;
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
          }).catch((error) => {
            console.error(
              `Error refreshing pool ${poolInfo.pool.address}: ${error}`
            );
          })
        )
      );

      // Log progress for larger batches
      if (stalePoolsWithVolume.length > BATCH_SIZE) {
        console.log(
          `[${network.name}] Processed ${Math.min(i + BATCH_SIZE, stalePoolsWithVolume.length)}/${stalePoolsWithVolume.length} pools`
        );
      }
    }

    // Log performance metrics
    const duration = (Date.now() - startTime) / 1000; // in seconds
    console.log(
      `[${network.name}] Refreshed ${stalePoolsWithVolume.length} pools in ${duration.toFixed(2)}s (${(duration / stalePoolsWithVolume.length).toFixed(3)}s per pool)`
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
  chainId: bigint
) {
  const { db } = context;

  try {
    // Find pools with either:
    // 1. No previous refresh (new pools)
    // 2. Pools that have swaps more recent than their last refresh
    // 3. Pools with stale volume data that need updating
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
      })
      .from(pool)
      .leftJoin(dailyVolume, eq(pool.address, dailyVolume.pool))
      .where(
        and(
          eq(pool.chainId, chainId),
          or(
            // 1. Never refreshed before (new pools that missed handlers)
            isNull(pool.lastRefreshed),

            // 2. Pools with metrics that haven't been refreshed in a while
            // but still have trading volume or price changes
            and(
              lt(pool.lastRefreshed, staleThreshold),
              or(gt(pool.volumeUsd, 0n), gt(pool.percentDayChange, 0), lt(pool.percentDayChange, 0))
            ),

            // 3. Pools with stale volume data that needs regular cleanup
            // Only consider pools with actual volume
            and(
              isNotNull(dailyVolume.lastUpdated),
              lt(dailyVolume.lastUpdated, staleThreshold),
              gt(dailyVolume.volumeUsd, 0n)
            )
          )
        )
      )
      .orderBy(sql`COALESCE(${pool.lastRefreshed}, ${pool.createdAt})`)
      .limit(50);

    console.log(
      `Found ${results.length} pools needing refresh (using lastSwapTimestamp field)`
    );

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
      },
      needsVolumeUpdate: row.last_updated
        ? row.last_updated < staleThreshold
        : false,
      needsMetricsUpdate: row.last_refreshed
        ? row.last_refreshed < staleThreshold
        : true,
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
  const { db } = context;
  const poolAddress = poolInfo.pool.address as Address;

  // Keep track of all updates we'll make
  const poolUpdates: Record<string, any> = {
    lastRefreshed: currentTimestamp,
  };
  const assetUpdates: Record<string, any> = {};

  // Update volume if needed and if we have any checkpoints
  if (poolInfo.needsVolumeUpdate && poolInfo.volume.checkpoints && Object.keys(poolInfo.volume.checkpoints).length > 0) {
    // Process volume data
    const checkpoints = poolInfo.volume.checkpoints;
    const cutoffTimestamp = currentTimestamp - BigInt(secondsInDay);

    // Remove old checkpoints
    const updatedCheckpoints = Object.fromEntries(
      Object.entries(checkpoints).filter(
        ([ts]) => BigInt(ts) >= cutoffTimestamp
      )
    );

    // Skip unnecessary processing if no checkpoints remain
    if (Object.keys(updatedCheckpoints).length === 0) {
      // Just update the timestamp if no relevant checkpoints
      try {
        await db
          .update(dailyVolume, {
            pool: poolAddress.toLowerCase() as `0x${string}`,
          })
          .set({
            lastUpdated: currentTimestamp,
          });
      } catch (error) {
        console.error(`Failed to update volume timestamp for ${poolAddress}: ${error}`);
      }
    } else {
      // Recalculate total volume
      const totalVolumeUsd = Object.values(updatedCheckpoints).reduce(
        (acc, vol) => acc + BigInt(vol),
        BigInt(0)
      );

      // Check if volume changed
      const volumeChanged = poolInfo.volume.volumeUsd !== totalVolumeUsd;

      if (volumeChanged) {
        poolUpdates.volumeUsd = totalVolumeUsd;
        assetUpdates.dayVolumeUsd = totalVolumeUsd;
      }

      // Update the daily volume record
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
        console.error(`Failed to update volume for ${poolAddress}: ${error}`);
      }
    }
  }

  // Calculate price change if metrics update is needed
  if (poolInfo.needsMetricsUpdate) {
    // Get price change percent
    try {
      const priceChangeInfo = await calculatePriceChangePercent({
        poolAddress,
        currentPrice: poolInfo.pool.price,
        currentTimestamp,
        ethPrice,
        createdAt: poolInfo.pool.createdAt,
        context,
      });

      poolUpdates.percentDayChange = priceChangeInfo;
      assetUpdates.percentDayChange = priceChangeInfo;
    } catch (error) {
      console.error(
        `Failed to calculate price change for ${poolAddress}: ${error}`
      );
    }

    // Calculate dollar liquidity
    try {
      const dollarLiquidity = await computeDollarLiquidity({
        assetBalance: poolInfo.pool.isToken0
          ? poolInfo.pool.reserves0
          : poolInfo.pool.reserves1,
        quoteBalance: poolInfo.pool.isToken0
          ? poolInfo.pool.reserves1
          : poolInfo.pool.reserves0,
        price: poolInfo.pool.price,
        ethPrice,
      });

      if (
        dollarLiquidity &&
        Math.abs(
          Number(dollarLiquidity - poolInfo.pool.dollarLiquidity) /
          Number(poolInfo.pool.dollarLiquidity || 1n)
        ) > 0.01
      ) {
        poolUpdates.dollarLiquidity = dollarLiquidity;
        assetUpdates.liquidityUsd = dollarLiquidity;
      }
    } catch (error) {
      console.error(
        `Failed to calculate dollar liquidity for ${poolAddress}: ${error}`
      );
    }
  }

  // Only update pool if we have changes to make beyond lastRefreshed
  if (Object.keys(poolUpdates).length > 1) {
    try {
      await updatePool({
        poolAddress,
        context,
        update: poolUpdates,
      });
    } catch (error) {
      console.error(`Failed to update pool ${poolAddress}: ${error}`);
    }
  }

  // Only update asset if we have changes to make
  if (Object.keys(assetUpdates).length > 0 && poolInfo.pool.asset) {
    try {
      await updateAsset({
        assetAddress: poolInfo.pool.asset as Address,
        context,
        update: assetUpdates,
      });
    } catch (error) {
      console.error(`Failed to update asset ${poolInfo.pool.asset}: ${error}`);
    }
  }

  // Optionally update market cap in the background, but only if there's been a significant price change
  // This avoids unnecessary contract calls and database updates
  if (poolInfo.needsMetricsUpdate && poolInfo.pool.baseToken &&
    (Math.abs(poolInfo.pool.percentDayChange) > 1 || // Only refresh if price changed by more than 1%
      (poolUpdates.percentDayChange !== undefined && Math.abs(poolUpdates.percentDayChange as number) > 1))) {
    refreshAssetMarketCap({
      assetAddress: poolInfo.pool.baseToken as Address,
      price: poolInfo.pool.price,
      ethPrice,
      context,
    }).catch((error) => {
      // Just log error but don't fail the whole update
      console.error(
        `Failed to update market cap for ${poolInfo.pool.baseToken}: ${error}`
      );
    });
  }
}

/**
 * Helper function to calculate price change percentage
 * Use the shared implementation in timeseries.ts
 */
async function calculatePriceChangePercent({
  poolAddress,
  currentPrice,
  currentTimestamp,
  ethPrice,
  createdAt,
  context,
}: {
  poolAddress: Address;
  currentPrice: bigint;
  currentTimestamp: bigint;
  ethPrice: bigint;
  createdAt: bigint;
  context: Context;
}): Promise<number> {
  // Use the shared implementation from timeseries.ts
  return calculatePriceChange({
    poolAddress,
    currentPrice,
    currentTimestamp,
    ethPrice,
    createdAt,
    context,
  });
}

/**
 * Original refreshPoolMetrics function - now obsolete but kept for reference
 * Will be removed in a future update
 */
export const refreshPoolMetrics = async ({
  context,
  currentTimestamp,
}: {
  context: Context;
  currentTimestamp: bigint;
}) => {
  const { db, network } = context;
  const chainId = BigInt(network.chainId);

  // Find pools that haven't been refreshed in the last hour
  const staleThreshold = currentTimestamp - BigInt(secondsInHour * 2);

  // Use db.sql.select with Drizzle helpers
  let stalePools = [];
  try {
    stalePools = await db.sql
      .select()
      .from(pool)
      .where(
        and(
          eq(pool.chainId, chainId),
          or(isNull(pool.lastRefreshed), lt(pool.lastRefreshed, staleThreshold))
        )
      )
      .orderBy(sql`COALESCE(${pool.lastRefreshed}, ${pool.createdAt})`)
      .limit(20);
  } catch (error) {
    console.error(`Error fetching stale pools: ${error}`);
    return; // Exit early if the query fails
  }

  // Exit early if no pools need refreshing
  if (stalePools.length === 0) {
    return;
  }

  const ethPrice = await fetchEthPrice(currentTimestamp, context);
  if (!ethPrice) {
    console.error("Failed to get ETH price, skipping metrics refresh");
    return;
  }

  const BATCH_SIZE = 20;

  for (let i = 0; i < stalePools.length; i += BATCH_SIZE) {
    const batch = stalePools.slice(i, i + BATCH_SIZE);

    // Process this batch in parallel
    await Promise.all(
      batch.map((poolData) =>
        refreshPoolData({
          poolData,
          ethPrice,
          currentTimestamp,
          context,
        }).catch((error) => {
          // Log but don't fail the whole batch
          console.error(`Error refreshing pool ${poolData.address}: ${error}`);
        })
      )
    );

    // Log progress for larger batches
    if (stalePools.length > BATCH_SIZE) {
      console.log(
        `[${network.name}] Processed ${Math.min(i + BATCH_SIZE, stalePools.length)}/${stalePools.length} pools`
      );
    }
  }
};

/**
 * Refreshes data for a specific pool including:
 * - Price change percentage (24h)
 * - Dollar liquidity amounts
 */
export const refreshPoolData = async ({
  poolData,
  ethPrice,
  currentTimestamp,
  context,
}: {
  poolData: typeof pool.$inferSelect;
  ethPrice: bigint;
  currentTimestamp: bigint;
  context: Context;
}) => {
  const { db } = context;
  const poolAddress = poolData.address as Address;
  const assetAddress = poolData.asset as Address;

  try {
    // 1. Update price change percentage
    await refreshPriceChangePercent({
      poolAddress,
      assetAddress,
      currentPrice: poolData.price,
      currentTimestamp,
      ethPrice,
      createdAt: poolData.createdAt,
      context,
    });

    // 2. Update dollar liquidity for pool
    // We're using the stored reserves for calculation
    const dollarLiquidity = await computeDollarLiquidity({
      assetBalance: poolData.isToken0 ? poolData.reserves0 : poolData.reserves1,
      quoteBalance: poolData.isToken0 ? poolData.reserves1 : poolData.reserves0,
      price: poolData.price,
      ethPrice,
    });

    // Only update if the value has changed significantly (>1%)
    let shouldUpdateLiquidity = false;
    if (poolData.dollarLiquidity === 0n) {
      shouldUpdateLiquidity = dollarLiquidity > 0n;
    } else if (dollarLiquidity === 0n) {
      shouldUpdateLiquidity = true;
    } else {
      const percentChange =
        Math.abs(
          Number(dollarLiquidity - poolData.dollarLiquidity) /
          Number(poolData.dollarLiquidity)
        ) * 100;
      shouldUpdateLiquidity = percentChange > 1;
    }

    if (shouldUpdateLiquidity) {
      await updatePool({
        poolAddress,
        context,
        update: {
          dollarLiquidity: dollarLiquidity ?? 0n,
          lastRefreshed: currentTimestamp,
        },
      });

      // 3. Update liquidityUsd for the asset
      await updateAsset({
        assetAddress,
        context,
        update: {
          liquidityUsd: dollarLiquidity ?? 0n,
        },
      });
    } else {
      // Just update the last refreshed timestamp
      await updatePool({
        poolAddress,
        context,
        update: {
          lastRefreshed: currentTimestamp,
        },
      });
    }

    // 4. Update market cap for the asset if needed
    await refreshAssetMarketCap({
      assetAddress,
      price: poolData.price,
      ethPrice,
      context,
    });
  } catch (error) {
    console.error(`Failed to refresh metrics for pool ${poolAddress}:`, error);
  }
};

/**
 * Calculates and updates the 24-hour price change percentage
 */
export const refreshPriceChangePercent = async ({
  poolAddress,
  assetAddress,
  currentPrice,
  currentTimestamp,
  ethPrice,
  createdAt,
  context,
}: {
  poolAddress: Address;
  assetAddress: Address;
  currentPrice: bigint;
  currentTimestamp: bigint;
  ethPrice: bigint;
  createdAt: bigint;
  context: Context;
}) => {
  const { db, network } = context;

  const timestampFrom = currentTimestamp - BigInt(secondsInDay);
  const usdPrice = (currentPrice * ethPrice) / CHAINLINK_ETH_DECIMALS;

  // Skip expensive calculations if price is 0
  if (currentPrice === 0n || usdPrice === 0n) {
    return null;
  }

  const searchDelta =
    currentTimestamp - createdAt > BigInt(secondsInDay)
      ? secondsInHour
      : secondsInDay;

  // Use sql.select for better performance
  const hourBucketResults = await db.sql
    .select()
    .from(hourBucketUsd)
    .where(
      and(
        eq(hourBucketUsd.pool, poolAddress.toLowerCase() as `0x${string}`),
        between(
          hourBucketUsd.hourId,
          Number(timestampFrom) - searchDelta,
          Number(timestampFrom) + searchDelta
        )
      )
    )
    .orderBy(hourBucketUsd.hourId)
    .limit(1);

  const priceFrom = hourBucketResults[0];
  if (!priceFrom || priceFrom.open === 0n) {
    // If no historical price, set 0% change instead of null
    return 0;
  }

  // Calculate price change percentage
  let priceChangePercent =
    (Number(usdPrice - priceFrom.open) / Number(priceFrom.open)) * 100;

  // Ensure we're not sending null values to the database
  if (isNaN(priceChangePercent) || !isFinite(priceChangePercent)) {
    priceChangePercent = 0;
  }

  const updates = [];

  updates.push(
    updateAsset({
      assetAddress,
      context,
      update: {
        percentDayChange: priceChangePercent,
      },
    })
  );

  updates.push(
    updatePool({
      poolAddress,
      context,
      update: {
        percentDayChange: priceChangePercent,
      },
    })
  );

  // Execute updates in parallel if there are any
  if (updates.length > 0) {
    await Promise.all(updates);
  }
};

/**
 * Updates the market cap for an asset
 */
// Cache for total supply values to avoid repeated contract calls
export const refreshAssetMarketCap = async ({
  assetAddress,
  price,
  ethPrice,
  context,
}: {
  assetAddress: Address;
  price: bigint;
  ethPrice: bigint;
  context: Context;
}) => {
  // Skip immediately if price is 0
  if (price === 0n) {
    return;
  }

  const { client, db } = context;

  try {
    // Get total supply (from cache if available)
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

      // Get current asset value
      const currentAsset = await db.find(asset, { address: assetAddress });
      if (!currentAsset) return;

      await updateAsset({
        assetAddress,
        context,
        update: {
          marketCapUsd,
        },
      });
    }
  } catch (error) {
    // Less verbose error handling
    console.error(
      `Market cap update failed for ${assetAddress.slice(0, 8)}...`
    );
  }
};
