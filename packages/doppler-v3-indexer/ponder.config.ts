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
  ZoraFactoryABI,
  ZoraCoinABI,
} from "./src/abis";
import {
  CHAIN_IDS,
  configs,
  zoraFactoryBase,
  zoraStartBlock,
} from "./addresses";
import { UniswapV2FactoryABI } from "@app/abis/UniswapV2Factory";

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
  networks: {
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
    unichain: {
      chainId: CHAIN_IDS.unichain,
      transport: http(process.env.PONDER_RPC_URL_130),
    },
    baseSepolia: {
      chainId: CHAIN_IDS.baseSepolia,
      transport: http(process.env.PONDER_RPC_URL_84532),
    },
    ink: {
      chainId: CHAIN_IDS.ink,
      transport: http(process.env.PONDER_RPC_URL_57073),
    },
    base: {
      chainId: CHAIN_IDS.base,
      transport: http(process.env.PONDER_RPC_URL_8453),
    },
  },
  blocks: {
    ChainlinkEthPriceFeed: {
      network: "mainnet",
      startBlock: 22375000,
      interval: (60 * 5) / 12, // every 5 minutes
    },
    BaseSepoliaV4PoolCheckpoints: {
      network: "baseSepolia",
      startBlock: baseSepolia.v4StartBlock,
      interval: 50, // every 50 blocks
    },
    // MetricRefresherUnichain: {
    //   network: "unichain",
    //   startBlock: unichain.startBlock,
    //   interval: 1000, // every 1000 blocks
    // },
    // MetricRefresherInk: {
    //   network: "ink",
    //   startBlock: ink.startBlock,
    //   interval: 1000, // every 1000 blocks
    // },
    // MetricRefresherBase: {
    //   network: "base",
    //   startBlock: base.startBlock,
    //   interval: 1000, // every 1000 blocks
    // },
    // MetricRefresherBaseSepolia: {
    //   network: "baseSepolia",
    //   startBlock: baseSepolia.startBlock,
    //   interval: 1000, // every 1000 blocks
    // },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: unichain.shared.airlock,
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: ink.shared.airlock,
        // },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.shared.airlock,
        },
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.shared.airlock,
        // },
      },
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: unichain.v3.v3Initializer,
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: ink.v3.v3Initializer,
        // },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.v3.v3Initializer,
        },
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.v3.v3Initializer,
        // },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: unichain.v4.v4Initializer,
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: ink.v4.v4Initializer,
        // },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.v4.v4Initializer,
        },
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.v4.v4Initializer,
        // },
      },
    },
    DERC20: {
      abi: DERC20ABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: factory({
        //     address: unichain.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "asset",
        //   }),
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: factory({
        //     address: ink.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "asset",
        //   }),
        // },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
        // base: {
        //   startBlock: base.startBlock,
        //   address: factory({
        //     address: base.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "asset",
        //   }),
        // },
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: factory({
        //     address: unichain.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: factory({
        //     address: ink.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
        // base: {
        //   startBlock: base.startBlock,
        //   address: factory({
        //     address: base.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
      },
    },
    ZoraFactory: {
      abi: ZoraFactoryABI,
      network: {
        base: {
          startBlock: zoraStartBlock,
          address: zoraFactoryBase,
        },
      },
    },
    ZoraCoin: {
      abi: ZoraCoinABI,
      network: {
        base: {
          startBlock: zoraStartBlock,
          address: factory({
            address: zoraFactoryBase,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreated" }),
            parameter: "coin",
          }),
        },
      },
    },
    ZoraUniswapV3Pool: {
      abi: UniswapV3PoolABI,
      network: {
        base: {
          startBlock: zoraStartBlock,
          address: factory({
            address: zoraFactoryBase,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreated" }),
            parameter: "pool",
          }),
        },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      network: {
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
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: factory({
        //     address: ink.shared.airlock,
        //     event: getAbiItem({
        //       abi: AirlockABI,
        //       name: "Migrate",
        //     }),
        //     parameter: "pool",
        //   }),
        // },
        // base: {
        //   startBlock: base.startBlock,
        //   address: factory({
        //     address: base.shared.airlock,
        //     event: getAbiItem({
        //       abi: AirlockABI,
        //       name: "Migrate",
        //     }),
        //     parameter: "pool",
        //   }),
        // },
      },
    },
    UniswapV2PairUnichain: {
      abi: UniswapV2PairABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: factory({
        //     address: unichain.v2.factory,
        //     event: getAbiItem({
        //       abi: UniswapV2FactoryABI,
        //       name: "PairCreated",
        //     }),
        //     parameter: "pair",
        //   }),
        // },
      },
    },
    PoolManager: {
      abi: PoolManagerABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: unichain.v4.poolManager,
        // },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.v4.poolManager,
        },
      },
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      network: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: factory({
        //     address: unichain.v4.v4Initializer,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
  },
});
