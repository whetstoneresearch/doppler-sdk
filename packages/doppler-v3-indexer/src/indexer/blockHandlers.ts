import { ChainlinkOracleABI } from "@app/abis/ChainlinkOracleABI";
import { generateCheckpointBlocks, generateMetricBlocks } from "@app/config";
import { configs } from "addresses";
import { ethPrice } from "ponder.schema";
import { ponder } from "ponder:registry";
import { refreshCheckpointBlob } from "./shared/entities/v4-entities";
import { handlePendingTokenImages } from "./shared/process-pending-images";
import { refreshActivePoolsBlob } from "./shared/scheduledJobs";

/**
 * Block handlers that run periodically to ensure volume data and metrics are up-to-date
 * These are triggered by the block configuration in ponder.config.ts
 */

Object.keys(generateMetricBlocks()).forEach((chainMetricBlockName) => {
  ponder.on(`${chainMetricBlockName}:block`, async ({ event, context }) => {
    const startTime = Date.now();

    try {
      // Execute optimized combined refresh job
      await refreshActivePoolsBlob({
        context,
        timestamp: Number(event.block.timestamp),
      });

      const duration = (Date.now() - startTime) / 1000;
    } catch (error) {
      console.error(`Error in {} refresh job: ${error}`);
      // Log error but don't throw to prevent handler from failing completely
    }
  });
});

Object.keys(generateCheckpointBlocks()).forEach((chainCheckpointBlockName) => {
  ponder.on(`${chainCheckpointBlockName}:block`, async ({ event, context }) => {
    const startTime = Date.now();

    try {
      await refreshCheckpointBlob({
        context,
        timestamp: Number(event.block.timestamp),
      });
    } catch (error) {
      console.error(`Error in unichain refresh job: ${error}`);
      // Log error but don't throw to prevent handler from failing completely
    }
  });
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

// Special handler for processing pending token images on Base
if (process.env.ENABLED_CHAINS?.split(",").includes("base")) {
  ponder.on("PendingTokenImagesBase:block", async ({ event, context }) => {
    await handlePendingTokenImages({
      context,
      timestamp: Number(event.block.timestamp),
    });
  });
}
