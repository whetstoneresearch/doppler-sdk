import { ponder } from "ponder:registry";
import { refreshActivePoolsBlobWithBucketsOptimized } from "./shared/scheduledJobs";
import { configs } from "addresses";
import { ChainlinkOracleABI } from "@app/abis/ChainlinkOracleABI";
import { ethPrice, zoraUsdcPrice } from "ponder.schema";
import { UniswapV3PoolABI } from "@app/abis/v3-abis/UniswapV3PoolABI";
import { computeV3Price } from "@app/utils/v3-utils";
import { chainConfigs } from "@app/config";
import { refreshCheckpointBlob } from "./shared/entities/v4-entities";

// /**
//  * Block handlers that run periodically to ensure volume data and metrics are up-to-date
//  * These are triggered by the block configuration in ponder.config.ts
//  */

// // // Handler for unichain network
ponder.on("MetricRefresherUnichain:block", async ({ event, context }) => {
  try {
    // Execute optimized batch refresh job
    await refreshActivePoolsBlobWithBucketsOptimized({
      context,
      timestamp: Number(event.block.timestamp),
    });
  } catch (error) {
    console.error(`Error in unichain refresh job: ${error}`);
    // Log error but don't throw to prevent handler from failing completely
  }
});

// // Handler for baseSepolia network
ponder.on("MetricRefresherBaseSepolia:block", async ({ event, context }) => {
  try {
    // Execute optimized batch refresh job
    await refreshActivePoolsBlobWithBucketsOptimized({
      context,
      timestamp: Number(event.block.timestamp),
    });
  } catch (error) {
    console.error(`Error in baseSepolia refresh job: ${error}`);
    // Log error but don't throw to prevent handler from failing completely
  }
});

// // // Handler for ink network
ponder.on("MetricRefresherInk:block", async ({ event, context }) => {
  try {
    // Execute optimized batch refresh job
    await refreshActivePoolsBlobWithBucketsOptimized({
      context,
      timestamp: Number(event.block.timestamp),
    });
  } catch (error) {
    console.error(`Error in ink refresh job: ${error}`);
  }
});

// Handler for base network
ponder.on("MetricRefresherBase:block", async ({ event, context }) => {
  try {
    await refreshActivePoolsBlobWithBucketsOptimized({
      context,
      timestamp: Number(event.block.timestamp),
    });
  } catch (error) {
    console.error(`Error in base refresh job: ${error}`);
  }
});

ponder.on("ChainlinkEthPriceFeed:block", async ({ event, context }) => {
  const { db, client, chain } = context;
  const { timestamp } = event.block;

  const latestAnswer = await client.readContract({
    abi: ChainlinkOracleABI,
    address: configs[chain.name].oracle.chainlinkEth,
    functionName: "latestAnswer",
  });

  const price = latestAnswer;

  const roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);
  const adjustedTimestamp = roundedTimestamp + 300n;

  await db
    .insert(ethPrice)
    .values({
      timestamp: adjustedTimestamp,
      price,
    })
    .onConflictDoNothing();
});

ponder.on("ZoraUsdcPrice:block", async ({ event, context }) => {
  const { db, client, chain } = context;
  const { timestamp } = event.block;

  const slot0 = await client.readContract({
    abi: UniswapV3PoolABI,
    address: chainConfigs[chain.name].addresses.zora.zoraTokenPool,
    functionName: "slot0",
  });

  const sqrtPriceX96 = slot0[0] as bigint;

  const price = computeV3Price({
    sqrtPriceX96,
    isToken0: true,
    decimals: 18,
    quoteDecimals: 6,
  });

  const roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);
  const adjustedTimestamp = roundedTimestamp + 300n;

  await db.insert(zoraUsdcPrice).values({
    timestamp: adjustedTimestamp,
    price,
  }).onConflictDoNothing();
});

// ponder.on("BaseSepoliaV4PoolCheckpoints:block", async ({ event, context }) => {
//   await refreshCheckpointBlob({
//     context,
//     timestamp: Number(event.block.timestamp),
//   });
// });

// ponder.on("BaseV4PoolCheckpoints:block", async ({ event, context }) => {
//   await refreshCheckpointBlob({
//     context,
//     timestamp: Number(event.block.timestamp),
//   });
// });
