import { ponder } from "ponder:registry";
import { executeScheduledJobs } from "./shared/scheduledJobs";
import { configs } from "addresses";
import { ChainlinkOracleABI } from "@app/abis/ChainlinkOracleABI";
import { ethPrice } from "ponder.schema";
import { refreshCheckpointBlob } from "./shared/entities/v4-entities/v4CheckpointBlob";

/**
 * Block handlers that run periodically to ensure volume data and metrics are up-to-date
 * These are triggered by the block configuration in ponder.config.ts
 */

// // Handler for unichain network
// ponder.on("MetricRefresherUnichain:block", async ({ event, context }) => {
//   console.log(
//     `Running comprehensive refresh for unichain at block ${event.block.number}`
//   );

//   const startTime = Date.now();

//   try {
//     // Execute optimized combined refresh job
//     await executeScheduledJobs({
//       context,
//       currentTimestamp: BigInt(event.block.timestamp),
//     });

//     const duration = (Date.now() - startTime) / 1000;
//     console.log(`Unichain refresh completed in ${duration.toFixed(2)}s`);
//   } catch (error) {
//     console.error(`Error in unichain refresh job: ${error}`);
//     // Log error but don't throw to prevent handler from failing completely
//   }
// });

// Handler for baseSepolia network
// ponder.on("MetricRefresherBaseSepolia:block", async ({ event, context }) => {
//   console.log(
//     `Running comprehensive refresh for baseSepolia at block ${event.block.number}`
//   );

//   const startTime = Date.now();

//   try {
//     // Execute optimized combined refresh job
//     await executeScheduledJobs({
//       context,
//       currentTimestamp: BigInt(event.block.timestamp),
//     });

//     const duration = (Date.now() - startTime) / 1000;
//     console.log(`BaseSepolia refresh completed in ${duration.toFixed(2)}s`);
//   } catch (error) {
//     console.error(`Error in baseSepolia refresh job: ${error}`);
//     // Log error but don't throw to prevent handler from failing completely
//   }
// });

// // Handler for ink network
// ponder.on("MetricRefresherInk:block", async ({ event, context }) => {
//   console.log(
//     `Running comprehensive refresh for ink at block ${event.block.number}`
//   );

//   const startTime = Date.now();

//   try {
//     // Execute optimized combined refresh job
//     await executeScheduledJobs({
//       context,
//       currentTimestamp: BigInt(event.block.timestamp),
//     });

//     const duration = (Date.now() - startTime) / 1000;
//     console.log(`Ink refresh completed in ${duration.toFixed(2)}s`);
//   } catch (error) {
//     console.error(`Error in ink refresh job: ${error}`);
//     // Log error but don't throw to prevent handler from failing completely
//   }
// });

// // // Handler for base network
// ponder.on("MetricRefresherBase:block", async ({ event, context }) => {
//   console.log(
//     `Running comprehensive refresh for base at block ${event.block.number}`
//   );

//   const startTime = Date.now();

//   try {
//     // Execute optimized combined refresh job
//     await executeScheduledJobs({
//       context,
//       currentTimestamp: BigInt(event.block.timestamp),
//     });

//     const duration = (Date.now() - startTime) / 1000;
//     console.log(`Ink refresh completed in ${duration.toFixed(2)}s`);
//   } catch (error) {
//     console.error(`Error in ink refresh job: ${error}`);
//     // Log error but don't throw to prevent handler from failing completely
//   }
// });

ponder.on("ChainlinkEthPriceFeed:block", async ({ event, context }) => {
  const { db, client, network } = context;
  const { timestamp } = event.block;

  const latestAnswer = await client.readContract({
    abi: ChainlinkOracleABI,
    address: configs[network.name].oracle.chainlinkEth,
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
