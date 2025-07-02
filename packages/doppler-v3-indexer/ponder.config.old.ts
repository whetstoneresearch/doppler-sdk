import { UniswapV2FactoryABI } from "@app/abis/UniswapV2Factory";
import { createConfig, factory } from "ponder";
import { getAbiItem, http } from "viem";
import { CHAIN_IDS, configs } from "./addresses";
import {
  AirlockABI,
  DERC20ABI,
  DopplerABI,
  PoolManagerABI,
  UniswapV2PairABI,
  UniswapV3InitializerABI,
  UniswapV3PoolABI,
  UniswapV4InitializerABI,
} from "./src/abis";

const { unichain, mainnet, baseSepolia, ink, base } = configs;

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: "postgresql://postgres:postgres@localhost:5432/default",
    poolConfig: {
      max: 100,
    },
  },
  ordering: "multichain",
  chains: {
    mainnet: {
      id: 1,
      rpc: http(process.env.PONDER_RPC_URL_1),
    },
    unichain: {
      id: CHAIN_IDS.unichain,
      rpc: http(process.env.PONDER_RPC_URL_130),
    },
    baseSepolia: {
      id: CHAIN_IDS.baseSepolia,
      rpc: http(process.env.PONDER_RPC_URL_84532),
    },
    ink: {
      id: CHAIN_IDS.ink,
      rpc: http(process.env.PONDER_RPC_URL_57073),
    },
    base: {
      id: CHAIN_IDS.base,
      rpc: http(process.env.PONDER_RPC_URL_8453),
    },
  },
  blocks: {
    ChainlinkEthPriceFeed: {
      chain: "mainnet",
      startBlock: mainnet.startBlock,
      interval: (60 * 5) / 12, // every 5 minutes
    },
    BaseSepoliaV4PoolCheckpoints: {
      chain: "baseSepolia",
      startBlock: baseSepolia.v4StartBlock,
      interval: 50, // every 50 blocks
    },
    BaseV4PoolCheckpoints: {
      chain: "base",
      startBlock: base.v4StartBlock,
      interval: 50, // every 50 blocks
    },
    UnichainV4PoolCheckpoints: {
      chain: "unichain",
      startBlock: unichain.v4StartBlock,
      interval: 50, // every 50 blocks
    },
    InkV4PoolCheckpoints: {
      chain: "ink",
      startBlock: ink.v4StartBlock,
      interval: 50, // every 50 blocks
    },
    MetricRefresherUnichain: {
      chain: "unichain",
      startBlock: unichain.startBlock,
      interval: 1000, // every 1000 blocks
    },
    MetricRefresherInk: {
      chain: "ink",
      startBlock: ink.startBlock,
      interval: 1000, // every 1000 blocks
    },
    MetricRefresherBase: {
      chain: "base",
      startBlock: base.startBlock,
      interval: 1000, // every 1000 blocks
    },
    MetricRefresherBaseSepolia: {
      chain: "baseSepolia",
      startBlock: baseSepolia.startBlock,
      interval: 1000, // every 1000 blocks
    },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      chain: {
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.shared.airlock,
        },
        ink: {
          startBlock: ink.startBlock,
          address: ink.shared.airlock,
        },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.shared.airlock,
        },
        base: {
          startBlock: base.startBlock,
          address: base.shared.airlock,
        },
      },
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      chain: {
        unichain: {
          startBlock: unichain.startBlock,
          address: unichain.v3.v3Initializer,
        },
        ink: {
          startBlock: ink.startBlock,
          address: ink.v3.v3Initializer,
        },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.v3.v3Initializer,
        },
        base: {
          startBlock: base.startBlock,
          address: base.v3.v3Initializer,
        },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      chain: {
        unichain: {
          startBlock: unichain.v4StartBlock,
          address: unichain.v4.v4Initializer,
        },
        ink: {
          startBlock: ink.v4StartBlock,
          address: ink.v4.v4Initializer,
        },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.v4.v4Initializer,
        },
        base: {
          startBlock: base.v4StartBlock,
          address: base.v4.v4Initializer,
        },
      },
    },
    UniswapV4Initializer2: {
      abi: UniswapV4InitializerABI,
      chain: {
        base: {
          startBlock: base.v4StartBlock,
          address: base.v4.v4Initializer2,
        },
        unichain: {
          startBlock: unichain.v4StartBlock,
          address: unichain.v4.v4Initializer2,
        },
        ink: {
          startBlock: ink.v4StartBlock,
          address: ink.v4.v4Initializer2,
        },
      },
    },
    DERC20: {
      abi: DERC20ABI,
      chain: {
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
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        base: {
          startBlock: base.startBlock,
          address: factory({
            address: base.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
      },
    },
    V4DERC20: {
      abi: DERC20ABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        base: {
          startBlock: base.v4StartBlock,
          address: factory({
            address: base.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        unichain: {
          startBlock: unichain.v4StartBlock,
          address: factory({
            address: unichain.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        ink: {
          startBlock: ink.v4StartBlock,
          address: factory({
            address: ink.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
      },
    },
    V4DERC20_2: {
      abi: DERC20ABI,
      chain: {
        base: {
          startBlock: base.v4StartBlock,
          address: factory({
            address: base.v4.v4Initializer2,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        unichain: {
          startBlock: unichain.v4StartBlock,
          address: factory({
            address: unichain.v4.v4Initializer2,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        ink: {
          startBlock: ink.v4StartBlock,
          address: factory({
            address: ink.v4.v4Initializer2,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {
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
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
        base: {
          startBlock: base.startBlock,
          address: factory({
            address: base.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.shared.airlock,
            event: getAbiItem({
              abi: AirlockABI,
              name: "Migrate",
            }),
            parameter: "pool",
          }),
        },
        ink: {
          startBlock: ink.startBlock,
          address: factory({
            address: ink.shared.airlock,
            event: getAbiItem({
              abi: AirlockABI,
              name: "Migrate",
            }),
            parameter: "pool",
          }),
        },
        base: {
          startBlock: base.startBlock,
          address: factory({
            address: base.shared.airlock,
            event: getAbiItem({
              abi: AirlockABI,
              name: "Migrate",
            }),
            parameter: "pool",
          }),
        },
      },
    },
    UniswapV2PairUnichain: {
      abi: UniswapV2PairABI,
      chain: {
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
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.v4.poolManager,
        },
        base: {
          startBlock: base.v4StartBlock,
          address: base.v4.poolManager,
        },
        unichain: {
          startBlock: unichain.v4StartBlock,
          address: unichain.v4.poolManager,
        },
        ink: {
          startBlock: ink.v4StartBlock,
          address: ink.v4.poolManager,
        },
      },
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
        base: {
          startBlock: base.v4StartBlock,
          address: factory({
            address: base.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
        unichain: {
          startBlock: unichain.v4StartBlock,
          address: factory({
            address: unichain.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
        ink: {
          startBlock: ink.v4StartBlock,
          address: factory({
            address: ink.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    UniswapV4Pool2: {
      abi: DopplerABI,
      chain: {
        base: {
          startBlock: base.v4StartBlock,
          address: base.v4.v4Initializer2,
        },
        unichain: {
          startBlock: unichain.v4StartBlock,
          address: unichain.v4.v4Initializer2,
        },
        ink: {
          startBlock: ink.v4StartBlock,
          address: ink.v4.v4Initializer2,
        },
      },
    },
  },
});
