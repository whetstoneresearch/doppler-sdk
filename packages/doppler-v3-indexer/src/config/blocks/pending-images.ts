import { BlockConfigMap } from "./types";
import { BLOCK_INTERVALS } from "./intervals";
import { chainConfigs } from "../chains";

// Generate pending token images block configurations
export const generatePendingImageBlocks = (): BlockConfigMap => {
  const configs: BlockConfigMap = {};
  
  // Only add for Base chain as requested
  configs["PendingTokenImagesBase"] = {
    chain: "base",
    startBlock: chainConfigs.base.startBlock,
    interval: BLOCK_INTERVALS.FIFTY_BLOCKS, // Check every 50 blocks
  };

  return configs;
};