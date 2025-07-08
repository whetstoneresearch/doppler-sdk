import { getAbiItem } from "viem";
import { FactoryConfig } from "./types";
import {
  UniswapV3InitializerABI,
  UniswapV4InitializerABI,
  AirlockABI,
} from "../../abis";
import { UniswapV2FactoryABI } from "../../abis/UniswapV2Factory";

// Factory configuration helpers
export const createV3AssetFactory = (initializerAddress: string): FactoryConfig => ({
  address: initializerAddress as `0x${string}`,
  event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
  parameter: "asset",
});

export const createV3PoolFactory = (initializerAddress: string): FactoryConfig => ({
  address: initializerAddress as `0x${string}`,
  event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
  parameter: "poolOrHook",
});

export const createV4AssetFactory = (initializerAddress: string): FactoryConfig => ({
  address: initializerAddress as `0x${string}`,
  event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
  parameter: "asset",
});

export const createV4PoolFactory = (initializerAddress: string): FactoryConfig => ({
  address: initializerAddress as `0x${string}`,
  event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
  parameter: "poolOrHook",
});

export const createAirlockMigrationFactory = (airlockAddress: string): FactoryConfig => ({
  address: airlockAddress as `0x${string}`,
  event: getAbiItem({ abi: AirlockABI, name: "Migrate" }),
  parameter: "pool",
});

export const createV2PairFactory = (factoryAddress: string): FactoryConfig => ({
  address: factoryAddress as `0x${string}`,
  event: getAbiItem({ abi: UniswapV2FactoryABI, name: "PairCreated" }),
  parameter: "pair",
});
