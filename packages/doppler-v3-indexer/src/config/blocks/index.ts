import { chainConfigs, Network } from "../chains";
import { generateCheckpointBlocks } from "./checkpoints";
import { BLOCK_INTERVALS } from "./intervals";
import { generateMetricBlocks } from "./metrics";
import { generatePendingImageBlocks } from "./pending-images";
import { BlockConfigMap } from "./types";

export * from "./checkpoints";
export * from "./intervals";
export * from "./metrics";
export * from "./pending-images";
export * from "./types";

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
  ...(((process.env.ENABLED_CHAINS?.split(",") as Network[]) || []).includes(
    "base"
  )
    ? generatePendingImageBlocks()
    : {}),
});
