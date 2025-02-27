import { Context } from "ponder:registry";
import { secondsInHour } from "@app/utils/constants";
import { refreshStaleVolumeData } from "./volumeRefresher";

// Track the last time jobs were executed
const lastExecutionTimes: Record<string, bigint> = {
  volumeRefresher: 0n,
};

// Job execution intervals
const VOLUME_REFRESH_INTERVAL = BigInt(secondsInHour / 4); // Run every 15 minutes

/**
 * Executes scheduled jobs based on their defined intervals
 * This function should be called from event handlers that trigger frequently
 */
export const executeScheduledJobs = async ({
  context,
  currentTimestamp,
}: {
  context: Context;
  currentTimestamp: bigint;
}) => {
  // Execute volume refresher job if interval has elapsed
  const lastRefreshTime = lastExecutionTimes.volumeRefresher ?? 0n;
  if (currentTimestamp - lastRefreshTime >= VOLUME_REFRESH_INTERVAL) {
    await refreshStaleVolumeData({ context, currentTimestamp });
    lastExecutionTimes.volumeRefresher = currentTimestamp;
  }
  
  // Add more scheduled jobs here as needed
};