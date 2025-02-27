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

const { unichainSepolia, unichain, mainnet } = configs;

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
      chainId: CHAIN_IDS.unichainSepolia,
      transport: http(process.env.PONDER_RPC_URL_1301),
    },
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
    unichain: {
      chainId: CHAIN_IDS.unichain,
      transport: http(process.env.PONDER_RPC_URL_130),
    },
  },
  blocks: {
    ChainlinkEthPriceFeed: {
      network: "mainnet",
      startBlock: mainnet.oracleStartBlock,
      interval: (60 * 5) / 12, // every 5 minutes
    },
    // Volume refresh job that runs periodically to ensure volume data is up-to-date
    MetricRefresherUnichainSepolia: {
      network: "unichainSepolia",
      startBlock: unichainSepolia.startBlock,
      interval: 60 * 15, // every 30 minutes (accounting for 250ms block time)
    },
    MetricRefresherUnichain: {
      network: "unichain",
      startBlock: unichain.startBlock,
      interval: 60 * 15, // every 15 minutes (accounting for 250ms block time)
    },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: unichainSepolia.shared.airlock,
        },
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.shared.airlock,
        },
      },
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: unichainSepolia.v3.v3Initializer,
        },
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.v3.v3Initializer,
        },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: unichainSepolia.v4.v4Initializer,
        },
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.v4.v4Initializer,
        },
      },
    },
    DERC20: {
      abi: DERC20ABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: factory({
            address: unichainSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        unichain: {
          startBlock: unichain.startBlock,
          address: factory({
            address: unichain.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: factory({
            address: unichainSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
        unichain: {
          startBlock: unichain.startBlock,
          address: factory({
            address: unichain.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: factory({
            address: unichainSepolia.v2.factory,
            event: getAbiItem({
              abi: UniswapV2FactoryABI,
              name: "PairCreated",
            }),
            parameter: "pair",
          }),
        },
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
      },
    },
    PoolManager: {
      abi: PoolManagerABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: unichainSepolia.v4.poolManager,
        },
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.v4.poolManager,
        },
      },
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      network: {
        unichainSepolia: {
          startBlock: unichainSepolia.startBlock,
          address: factory({
            address: unichainSepolia.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
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
