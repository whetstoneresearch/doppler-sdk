import { BlockConfigMap, MetricRefresherConfig } from "./types";
import { chainConfigs } from "../chains";
import { BLOCK_INTERVALS } from "./intervals";

// Metric refresher configuration
export const METRIC_CONFIGS: MetricRefresherConfig[] = [
  {
    name: "MetricRefresher",
    chains: ["unichain", "ink", "base", "baseSepolia"],
    interval: BLOCK_INTERVALS.THOUSAND_BLOCKS,
    getStartBlock: (chainConfig) => chainConfig.startBlock,
  },
];

// Generate metric refresher block configurations
export const generateMetricBlocks = (): BlockConfigMap => {
  const blocks: BlockConfigMap = {};

  METRIC_CONFIGS.forEach(config => {
    config.chains.forEach(chainName => {
      const chainConfig = chainConfigs[chainName];
      if (chainConfig) {
        const blockName = `${config.name}${chainName.charAt(0).toUpperCase() + chainName.slice(1)}`;
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