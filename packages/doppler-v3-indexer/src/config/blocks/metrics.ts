import { BlockConfigMap, MetricRefresherConfig } from "./types";
import { IndexerConfigs, Network } from "../chains";
import { BLOCK_INTERVALS } from "./intervals";

// Metric refresher configuration
export const METRIC_CONFIGS: MetricRefresherConfig[] = [
  {
    name: "MetricRefresher",
    chains: ["unichain", "ink", "base", "baseSepolia"] as Network[],
    interval: BLOCK_INTERVALS.THOUSAND_BLOCKS,
    getStartBlock: (chainConfig) => chainConfig.startBlock,
  },
];

const getMetricsConfigs = (chainConfigs: IndexerConfigs): MetricRefresherConfig[] => {
  return Object.entries(chainConfigs).map(([name, config]) => ({
    name: "MetricRefresher",
    chains: [name as Network],
    interval: BLOCK_INTERVALS.THOUSAND_BLOCKS,
    getStartBlock: (chainConfig) => chainConfig.startBlock,
  }));
}

// Generate metric refresher block configurations
export const generateMetricBlocks = (chainConfigs: IndexerConfigs): BlockConfigMap => {
  const blocks: BlockConfigMap = {};


  getMetricsConfigs(chainConfigs).forEach(config => {
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