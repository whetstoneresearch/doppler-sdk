import { ponder } from "ponder:registry";
import { refreshStaleVolumeData } from "./shared/volumeRefresher";
import { executeScheduledJobs } from "./shared/scheduledJobs";

/**
 * Block handlers that run periodically to ensure volume data and metrics are up-to-date
 * These are triggered by the block configuration in ponder.config.ts
 */

// Handler for unichainSepolia network
ponder.on(
  "MetricRefresherUnichainSepolia:block",
  async ({ event, context }) => {
    console.log(
      `Running scheduled jobs for unichainSepolia at block ${event.block.number}`
    );

    try {
      // Execute all scheduled jobs, including volume refresh
      await executeScheduledJobs({
        context,
        currentTimestamp: BigInt(event.block.timestamp),
      });
    } catch (error) {
      console.error(`Error in unichainSepolia scheduled jobs: ${error}`);
      // Log error but don't throw to prevent handler from failing completely
    }
  }
);

// Handler for unichain network
ponder.on("MetricRefresherUnichain:block", async ({ event, context }) => {
  console.log(
    `Running scheduled jobs for unichain at block ${event.block.number}`
  );

  try {
    // Execute all scheduled jobs, including volume refresh
    await executeScheduledJobs({
      context,
      currentTimestamp: BigInt(event.block.timestamp),
    });
  } catch (error) {
    console.error(`Error in unichain scheduled jobs: ${error}`);
    // Log error but don't throw to prevent handler from failing completely
  }
});
