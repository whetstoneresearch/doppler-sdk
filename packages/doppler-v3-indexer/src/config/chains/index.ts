import { baseConfig, baseSepoliaConfig } from "./base";
import { inkConfig } from "./ink";
import { mainnetConfig } from "./mainnet";
import { IndexerConfigs } from "./types";
import { unichainConfig } from "./unichain";

export * from "./constants";
export * from "./types";

// All available chain configurations
const allChainConfigs: IndexerConfigs = {
  mainnet: mainnetConfig,
  unichain: unichainConfig,
  baseSepolia: baseSepoliaConfig,
  base: baseConfig,
  ink: inkConfig,
};

// Environment-based chain filtering
const getEnabledChains = (): IndexerConfigs => {
  const enabledChains = process.env.ENABLED_CHAINS;

  if (!enabledChains) {
    // If no environment variable is set, return all chains (default behavior)
    return allChainConfigs;
  }

  const chainNames = enabledChains.split(",").map((name) => name.trim());
  const filteredConfigs: IndexerConfigs = {};

  for (const chainName of chainNames) {
    if (chainName in allChainConfigs) {
      filteredConfigs[chainName as keyof IndexerConfigs] =
        allChainConfigs[chainName as keyof IndexerConfigs];
    }
  }
  return filteredConfigs;
};

// Combined configuration object (filtered based on environment)
export const chainConfigs: IndexerConfigs = getEnabledChains();
console.log("chainConfigs", chainConfigs);
// Utility functions
export const getChainConfig = (network: keyof IndexerConfigs) =>
  chainConfigs[network];

export const getChainById = (chainId: number) =>
  Object.values(chainConfigs).find((config) => config.id === chainId);

export const getAllChainIds = () =>
  Object.values(chainConfigs).map((config) => config.id);

export const getActiveChains = () =>
  Object.values(chainConfigs).filter(
    (config) =>
      config.addresses.shared.airlock !==
      "0x0000000000000000000000000000000000000000"
  );
