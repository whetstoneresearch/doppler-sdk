import { BlockConfigMap } from "./types";
import { generateCheckpointBlocks } from "./checkpoints";
import { generateMetricBlocks } from "./metrics";
import { generatePendingImageBlocks } from "./pending-images";
import { BLOCK_INTERVALS } from "./intervals";
import { chainConfigs } from "../chains";

export * from "./types";
export * from "./intervals";
export * from "./checkpoints";
export * from "./metrics";
export * from "./pending-images";

// Special oracle block configuration
export const generateOracleBlocks = (): BlockConfigMap => ({
  ChainlinkEthPriceFeed: {
    chain: "mainnet",
    startBlock: chainConfigs.mainnet.startBlock,
    interval: BLOCK_INTERVALS.FIVE_MINUTES,
  },
});

// Combine all block configurations
export const generateAllBlockConfigs = (): BlockConfigMap => ({
  ...generateOracleBlocks(),
  ...generateCheckpointBlocks(), 
  ...generateMetricBlocks(),
  ...generatePendingImageBlocks(),
});