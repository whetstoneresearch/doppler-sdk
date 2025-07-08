import { ContractConfigMap } from "./types";
import { chainConfigs } from "../chains";
import { UniswapV3InitializerABI, DERC20ABI, UniswapV3PoolABI } from "../../abis";
import { createV3AssetFactory, createV3PoolFactory } from "./factories";

export const generateV3Contracts = (): ContractConfigMap => {
  const contracts: ContractConfigMap = {};

  // Get chains with V3 initializers
  const v3Chains = Object.entries(chainConfigs).filter(
    ([_, config]) => config.addresses.v3.v3Initializer !== "0x0000000000000000000000000000000000000000"
  );

  if (v3Chains.length === 0) return contracts;

  // UniswapV3Initializer contract
  contracts.UniswapV3Initializer = {
    abi: UniswapV3InitializerABI,
    chain: Object.fromEntries(
      v3Chains.map(([name, config]) => [
        name,
        {
          startBlock: config.startBlock,
          address: config.addresses.v3.v3Initializer,
        },
      ])
    ),
  };

  // DERC20 tokens created by V3 initializer
  contracts.DERC20 = {
    abi: DERC20ABI,
    chain: Object.fromEntries(
      v3Chains.map(([name, config]) => [
        name,
        {
          startBlock: config.startBlock,
          address: createV3AssetFactory(config.addresses.v3.v3Initializer),
        },
      ])
    ),
  };

  // UniswapV3Pool contracts created by V3 initializer
  contracts.UniswapV3Pool = {
    abi: UniswapV3PoolABI,
    chain: Object.fromEntries(
      v3Chains.map(([name, config]) => [
        name,
        {
          startBlock: config.startBlock,
          address: createV3PoolFactory(config.addresses.v3.v3Initializer),
        },
      ])
    ),
  };

  return contracts;
};