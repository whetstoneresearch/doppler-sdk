import { ponder } from "ponder:registry";
import { refreshActivePoolsBlob } from "./shared/scheduledJobs";
import { configs } from "addresses";
import { ChainlinkOracleABI } from "@app/abis/ChainlinkOracleABI";
import { ethPrice } from "ponder.schema";
import { refreshCheckpointBlob } from "./shared/entities/v4-entities/v4CheckpointBlob";
import { handlePendingTokenImages } from "./shared/process-pending-images";

/**
 * Block handlers that run periodically to ensure volume data and metrics are up-to-date
 * These are triggered by the block configuration in ponder.config.ts
 */

// // Handler for unichain network
ponder.on("MetricRefresherUnichain:block", async ({ event, context }) => {
  try {
    // Execute optimized combined refresh job
    await refreshActivePoolsBlob({
      context,
      timestamp: Number(event.block.timestamp),
    });

  } catch (error) {
    console.error(`Error in unichain refresh job: ${error}`);
    // Log error but don't throw to prevent handler from failing completely
  }
});

// Handler for baseSepolia network
ponder.on("MetricRefresherBaseSepolia:block", async ({ event, context }) => {
  try {
    // Execute optimized combined refresh job
    await refreshActivePoolsBlob({
      context,
      timestamp: Number(event.block.timestamp),
    });

  } catch (error) {
    console.error(`Error in baseSepolia refresh job: ${error}`);
    // Log error but don't throw to prevent handler from failing completely
  }
});

// // Handler for ink network
ponder.on("MetricRefresherInk:block", async ({ event, context }) => {

  try {
    // Execute optimized combined refresh job
    await refreshActivePoolsBlob({
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
    await refreshActivePoolsBlob({
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

ponder.on("BaseSepoliaV4PoolCheckpoints:block", async ({ event, context }) => {
  await refreshCheckpointBlob({
    context,
    timestamp: Number(event.block.timestamp),
  });
});

ponder.on("BaseV4PoolCheckpoints:block", async ({ event, context }) => {
  await refreshCheckpointBlob({
    context,
    timestamp: Number(event.block.timestamp),
  });
});

// Handler for processing pending token images on Base
ponder.on("PendingTokenImagesBase:block", async ({ event, context }) => {
  await handlePendingTokenImages({
    context,
    timestamp: Number(event.block.timestamp),
  });
});
