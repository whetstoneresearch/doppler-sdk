import { ContractConfigMap } from "./types";
import { IndexerConfigs } from "../chains";
import {
  UniswapV4InitializerABI,
  DERC20ABI,
  PoolManagerABI,
  DopplerABI,
  V4MigratorABI
} from "../../abis";
import { createV4AssetFactory, createV4PoolFactory } from "./factories";
import { zeroAddress } from "viem";

export const generateV4Contracts = (chainConfigs: IndexerConfigs): ContractConfigMap => {
  const contracts: ContractConfigMap = {};

  // Get chains with V4 contracts
  const v4Chains = Object.entries(chainConfigs).filter(
    ([_, config]) =>
      config.v4StartBlock &&
      config.addresses.v4.poolManager !== zeroAddress
  );

  if (v4Chains.length === 0) return contracts;


  // UniswapV4Initializer contract
  const v4InitializerChains = v4Chains.filter(
    ([_, config]) => config.addresses.v4.v4Initializer !== zeroAddress
  );

  if (v4InitializerChains.length > 0) {
    contracts.UniswapV4Initializer = {
      abi: UniswapV4InitializerABI,
      chain: Object.fromEntries(
        v4InitializerChains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4StartBlock!,
            address: config.addresses.v4.v4Initializer,
          },
        ])
      ),
    };

    // V4 DERC20 tokens
    contracts.V4DERC20 = {
      abi: DERC20ABI,
      chain: Object.fromEntries(
        v4InitializerChains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4StartBlock!,
            address: createV4AssetFactory(config.addresses.v4.v4Initializer),
          },
        ])
      ),
    };

    contracts.V4DERC20_2 = {
      abi: DERC20ABI,
      chain: Object.fromEntries(
        v4InitializerChains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4StartBlock!,
            address: createV4AssetFactory(config.addresses.v4.v4Initializer2),
          },
        ])
      ),
    }

    // V4 Pool contracts
    contracts.UniswapV4Pool = {
      abi: DopplerABI,
      chain: Object.fromEntries(
        v4InitializerChains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4StartBlock!,
            address: createV4PoolFactory(config.addresses.v4.v4Initializer),
          },
        ])
      ),
    };
  }

  // V4 Initializer2 contracts (for chains that have them)
  const v4Initializer2Chains = v4Chains.filter(
    ([_, config]) => config.addresses.v4.v4Initializer2 !== zeroAddress
  );

  if (v4Initializer2Chains.length > 0) {
    contracts.UniswapV4Initializer2 = {
      abi: UniswapV4InitializerABI,
      chain: Object.fromEntries(
        v4Initializer2Chains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4StartBlock!,
            address: config.addresses.v4.v4Initializer2,
          },
        ])
      ),
    };

    // DERC20 from second initializer
    contracts.V4DERC20_2 = {
      abi: DERC20ABI,
      chain: Object.fromEntries(
        v4Initializer2Chains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4StartBlock!,
            address: createV4AssetFactory(config.addresses.v4.v4Initializer2),
          },
        ])
      ),
    };

    // Second pool contract
    contracts.UniswapV4Pool2 = {
      abi: DopplerABI,
      chain: Object.fromEntries(
        v4Initializer2Chains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4StartBlock!,
            address: config.addresses.v4.v4Initializer2,
          },
        ])
      ),
    };
  }

  // V4 Migrator contract
  const v4MigratorChains = v4Chains.filter(
    ([_, config]) => config.addresses.v4.v4Migrator !== zeroAddress
  );

  if (v4MigratorChains.length > 0) {
    contracts.V4Migrator = {
      abi: V4MigratorABI,
      chain: Object.fromEntries(
        v4MigratorChains.map(([name, config]) => [
          name,
          {
            startBlock: config.v4MigratorStartBlock!,
            address: config.addresses.v4.v4Migrator,
          },
        ])
      ),
    };
  }

  // PoolManager contract
  contracts.PoolManager = {
    abi: PoolManagerABI,
    chain: Object.fromEntries(
      v4Chains.map(([name, config]) => [
        name,
        {
          startBlock: config.v4MigratorStartBlock!,
          address: config.addresses.v4.poolManager,
        },
      ])
    ),
  };


  return contracts;
};