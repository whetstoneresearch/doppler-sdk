import { ponder } from "ponder:registry";
import { refreshStaleVolumeData } from "./shared/volumeRefresher";

/**
 * Block handlers that run periodically to ensure volume data is up-to-date
 * These are triggered by the block configuration in ponder.config.ts
 */

// Handler for unichainSepolia network
ponder.on("VolumeRefresher:block", async ({ event, context }) => {
  console.log(
    `Running volume refresh job for unichainSepolia at block ${event.block.number}`
  );

  try {
    await refreshStaleVolumeData({
      context,
      currentTimestamp: BigInt(event.block.timestamp),
    });
  } catch (error) {
    console.error(`Error in unichainSepolia volume refresh job: ${error}`);
    // Log error but don't throw to prevent handler from failing completely
  }
});

// Handler for unichain network
ponder.on("VolumeRefresherUnichain:block", async ({ event, context }) => {
  console.log(
    `Running volume refresh job for unichain at block ${event.block.number}`
  );

  try {
    await refreshStaleVolumeData({
      context,
      currentTimestamp: BigInt(event.block.timestamp),
    });
  } catch (error) {
    console.error(`Error in unichain volume refresh job: ${error}`);
    // Log error but don't throw to prevent handler from failing completely
  }
});
