import { ponder } from "ponder:registry";
import { refreshStaleVolumeData } from "./shared/volumeRefresher";

/**
 * Block handlers that run periodically to ensure volume data is up-to-date
 * These are triggered by the block configuration in ponder.config.ts
 */

// Handler for unichainSepolia network
ponder.on("VolumeRefresher:Block", async ({ block, context }) => {
  console.log(`Running volume refresh job for unichainSepolia at block ${block.number}`);
  
  await refreshStaleVolumeData({
    context,
    currentTimestamp: BigInt(block.timestamp),
  });
});

// Handler for unichain network
ponder.on("VolumeRefresherUnichain:Block", async ({ block, context }) => {
  console.log(`Running volume refresh job for unichain at block ${block.number}`);
  
  await refreshStaleVolumeData({
    context,
    currentTimestamp: BigInt(block.timestamp),
  });
});