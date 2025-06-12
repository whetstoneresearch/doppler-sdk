import { ContractConfigMap } from "./types";
import { chainConfigs } from "../chains";
import { UniswapV2PairABI } from "../../abis";
import { UniswapV2FactoryABI } from "../../abis/UniswapV2Factory";
import { createAirlockMigrationFactory, createV2PairFactory } from "./factories";

export const generateV2Contracts = (): ContractConfigMap => {
  const contracts: ContractConfigMap = {};

  // V2 Pairs from Airlock migration
  const airlockChains = Object.entries(chainConfigs).filter(
    ([name, config]) => 
      name !== "unichain" && // Unichain uses different V2 setup
      config.addresses.shared.airlock !== "0x0000000000000000000000000000000000000000"
  );

  if (airlockChains.length > 0) {
    contracts.UniswapV2Pair = {
      abi: UniswapV2PairABI,
      chain: Object.fromEntries(
        airlockChains.map(([name, config]) => [
          name,
          {
            startBlock: config.startBlock,
            address: createAirlockMigrationFactory(config.addresses.shared.airlock),
          },
        ])
      ),
    };
  }

  // Unichain has its own V2 factory setup
  const unichainConfig = chainConfigs.unichain;
  if (unichainConfig.addresses.v2.factory !== "0x0000000000000000000000000000000000000000") {
    contracts.UniswapV2PairUnichain = {
      abi: UniswapV2PairABI,
      chain: {
        unichain: {
          startBlock: unichainConfig.startBlock,
          address: createV2PairFactory(unichainConfig.addresses.v2.factory),
        },
      },
    };
  }

  return contracts;
};