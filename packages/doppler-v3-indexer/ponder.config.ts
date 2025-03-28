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
import { CHAIN_IDS, configs } from "./addresses";
import { UniswapV2FactoryABI } from "@app/abis/UniswapV2Factory";

const { unichainSepolia, unichain, mainnet, baseSepolia, ink } = configs;

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: "postgresql://postgres:postgres@localhost:5432/default",
    poolConfig: {
      max: 100,
    },
  },
  networks: {
    // unichainSepolia: {
    //   chainId: CHAIN_IDS.unichainSepolia,
    //   transport: http(process.env.PONDER_RPC_URL_1301),
    // },
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
    unichain: {
      chainId: CHAIN_IDS.unichain,
      transport: http(process.env.PONDER_RPC_URL_130),
    },
    // baseSepolia: {
    //   chainId: CHAIN_IDS.baseSepolia,
    //   transport: http(process.env.PONDER_RPC_URL_84532),
    // },
    ink: {
      chainId: CHAIN_IDS.ink,
      transport: http(process.env.PONDER_RPC_URL_57073),
    },
  },
  blocks: {
    ChainlinkEthPriceFeed: {
      network: "mainnet",
      startBlock: mainnet.oracleStartBlock,
      interval: (60 * 5) / 12, // every 5 minutes
    },
    // Volume refresh job that runs periodically to ensure volume data is up-to-date
    MetricRefresherUnichain: {
      network: "unichain",
      startBlock: unichain.startBlock,
      interval: 1000, // every 1000 blocks
    },
    MetricRefresherInk: {
      network: "ink",
      startBlock: ink.startBlock,
      interval: 1000, // every 1000 blocks
    },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.shared.airlock,
        },
        ink: {
          startBlock: ink.startBlock,
          address: ink.shared.airlock,
        },
      },
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.v3.v3Initializer,
        },
        ink: {
          startBlock: ink.startBlock,
          address: ink.v3.v3Initializer,
        },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.v4.v4Initializer,
        },
        ink: {
          startBlock: ink.startBlock,
          address: ink.v4.v4Initializer,
        },
      },
    },
    DERC20: {
      abi: DERC20ABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: factory({
            address: unichain.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        ink: {
          startBlock: ink.startBlock,
          address: factory({
            address: ink.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: factory({
            address: unichain.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
        ink: {
          startBlock: ink.startBlock,
          address: factory({
            address: ink.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: factory({
            address: unichain.v2.factory,
            event: getAbiItem({
              abi: UniswapV2FactoryABI,
              name: "PairCreated",
            }),
            parameter: "pair",
          }),
        },
        ink: {
          startBlock: ink.startBlock,
          address: factory({
            address: ink.v2.factory,
            event: getAbiItem({
              abi: UniswapV2FactoryABI,
              name: "PairCreated",
            }),
            parameter: "pair",
          }),
        },
      },
    },
    PoolManager: {
      abi: PoolManagerABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.v4.poolManager,
        },
      },
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      network: {
        unichain: {
          startBlock: unichain.startBlock,
          address: factory({
            address: unichain.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
  },
});
