import { BlockConfigMap, CheckpointConfig } from "./types";
import { chainConfigs } from "../chains";
import { BLOCK_INTERVALS } from "./intervals";

// Checkpoint configuration templates
export const CHECKPOINT_CONFIGS: CheckpointConfig[] = [
  {
    name: "V4PoolCheckpoints",
    chains: ["baseSepolia", "base", "unichain", "ink"],
    interval: BLOCK_INTERVALS.FIFTY_BLOCKS,
    getStartBlock: (chainConfig) => chainConfig.v4StartBlock || chainConfig.startBlock,
  },
];

// Generate checkpoint block configurations
export const generateCheckpointBlocks = (): BlockConfigMap => {
  const blocks: BlockConfigMap = {};

  CHECKPOINT_CONFIGS.forEach(config => {
    config.chains.forEach(chainName => {
      const chainConfig = chainConfigs[chainName];
      if (chainConfig) {
        const blockName = `${chainName.charAt(0).toUpperCase() + chainName.slice(1)}${config.name}`;
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