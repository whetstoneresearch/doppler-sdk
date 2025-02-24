import { createConfig, factory } from "ponder";
import { getAbiItem, http } from "viem";
import {
  UniswapV3InitializerABI,
  UniswapV4InitializerABI,
  UniswapV3PoolABI,
  AirlockABI,
  DERC20ABI,
  DopplerABI,
  PoolManagerABI,
  UniswapV2PairABI,
} from "./src/abis";
import { CHAIN_IDS, configs, Network } from "./addresses";
import { UniswapV2FactoryABI } from "@app/abis/UniswapV2Factory";

// have this read from environment variable
const network: Network = "unichain";
const { v2, v3, v4, shared, oracleStartBlock, startBlock } = configs[network];

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: "postgresql://postgres:postgres@localhost:5432/default",
    poolConfig: {
      max: 100,
    },
  },
  networks: {
    unichainSepolia: {
      chainId: CHAIN_IDS[network],
      transport: http(process.env.PONDER_RPC_URL_1301),
    },
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
    unichain: {
      chainId: CHAIN_IDS[network],
      transport: http(process.env.PONDER_RPC_URL_130),
    },
  },
  blocks: {
    ChainlinkEthPriceFeed: {
      network: "mainnet",
      startBlock: oracleStartBlock,
      interval: (60 * 5) / 12, // every 5 minutes
    },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      network,
      address: shared.airlock,
      startBlock,
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      network,
      address: v3.v3Initializer,
      startBlock,
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      network,
      address: v4.v4Initializer,
      startBlock,
    },
    DERC20: {
      abi: DERC20ABI,
      network,
      address: factory({
        address: v3.v3Initializer,
        event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        parameter: "asset",
      }),
      startBlock,
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      network,
      address: factory({
        address: v3.v3Initializer,
        event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        parameter: "poolOrHook",
      }),
      startBlock,
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      network,
      address: factory({
        address: v2.factory,
        event: getAbiItem({ abi: UniswapV2FactoryABI, name: "PairCreated" }),
        parameter: "pair",
      }),
      startBlock,
    },
    PoolManager: {
      abi: PoolManagerABI,
      network,
      address: v4.poolManager,
      startBlock,
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      network,
      address: factory({
        address: v4.v4Initializer,
        event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        parameter: "poolOrHook",
      }),
      startBlock,
    },
  },
});
