import { chainConfigs, Network } from "../chains";
import { BLOCK_INTERVALS } from "./intervals";
import { BlockConfigMap, MetricRefresherConfig } from "./types";

// Metric refresher configuration
export const METRIC_CONFIGS: MetricRefresherConfig[] = [
  {
    name: "MetricRefresher",
    chains: (process.env.ENABLED_CHAINS?.split(",") as Network[]) || [],
    interval: BLOCK_INTERVALS.THOUSAND_BLOCKS,
    getStartBlock: (chainConfig) => chainConfig.startBlock,
  },
];

// Generate metric refresher block configurations
export const generateMetricBlocks = (): BlockConfigMap => {
  const blocks: BlockConfigMap = {};

  METRIC_CONFIGS.forEach((config) => {
    config.chains.forEach((chainName) => {
      const chainConfig = chainConfigs[chainName];
      if (chainConfig) {
        const blockName = `${config.name}${
          chainName.charAt(0).toUpperCase() + chainName.slice(1)
        }`;
        blocks[blockName] = {
          chain: chainName,
          startBlock: config.getStartBlock(chainConfig),
          interval: config.interval,
        };
      }
    });
  });

  return blocks;
};
