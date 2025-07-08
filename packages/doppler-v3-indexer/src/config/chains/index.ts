import { IndexerConfigs } from "./types";
import { mainnetConfig } from "./mainnet";
import { unichainConfig } from "./unichain";
import { baseSepoliaConfig, baseConfig } from "./base";
import { inkConfig } from "./ink";

export * from "./types";
export * from "./constants";

// Combined configuration object
export const chainConfigs: IndexerConfigs = {
  mainnet: mainnetConfig,
  unichain: unichainConfig,
  baseSepolia: baseSepoliaConfig,
  base: baseConfig,
  ink: inkConfig,
};

// Utility functions
export const getChainConfig = (network: keyof IndexerConfigs) => chainConfigs[network];

export const getChainById = (chainId: number) =>
  Object.values(chainConfigs).find(config => config.id === chainId);

export const getAllChainIds = () =>
  Object.values(chainConfigs).map(config => config.id);

export const getActiveChains = () =>
  Object.values(chainConfigs).filter(config =>
    config.addresses.shared.airlock !== "0x0000000000000000000000000000000000000000"
  );