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
  ZoraV4HookABI,
  ZoraCoinABI,
} from "./src/abis";
import { UniswapV2FactoryABI } from "@app/abis/UniswapV2Factory";
import { BLOCK_INTERVALS } from "@app/config/blocks/intervals";
import {
  chainConfigs,
  CHAIN_IDS,
  V4_START_BLOCKS,
  LOCKABLE_V3_INITIALIZER_START_BLOCKS,
  SELF_CORRECTING_V4_INITIALIZER_START_BLOCKS,
} from "./src/config/chains";
import { LockableUniswapV3InitializerABI } from "@app/abis/v3-abis/LockableUniswapV3InitializerABI";
import { UniswapV3MigratorAbi } from "@app/abis/v3-abis/UniswapV3Migrator";

const { unichain, mainnet, baseSepolia, ink, base } = chainConfigs;

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: "postgresql://postgres:postgres@localhost:5432/default",
    poolConfig: {
      max: 100,
    },
  },
  ordering: "omnichain",
  chains: {
    mainnet: {
      id: 1,
      rpc: http(process.env.PONDER_RPC_URL_1),
    },
    // unichain: {
    //   id: CHAIN_IDS.unichain,
    //   rpc: http(process.env.PONDER_RPC_URL_130),
    // },
    // baseSepolia: {
    //   id: CHAIN_IDS.baseSepolia,
    //   rpc: http(process.env.PONDER_RPC_URL_84532),
    // },
    // ink: {
    //   id: CHAIN_IDS.ink,
    //   rpc: http(process.env.PONDER_RPC_URL_57073),
    // },
    base: {
      id: CHAIN_IDS.base,
      rpc: http(process.env.PONDER_RPC_URL_8453),
    },
  },
  blocks: {
    ChainlinkEthPriceFeed: {
      chain: "mainnet",
      startBlock: mainnet.startBlock,
      interval: BLOCK_INTERVALS.FIVE_MINUTES, // every 5 minutes
    },
    // BaseSepoliaV4PoolCheckpoints: {
    //   chain: "baseSepolia",
    //   startBlock: baseSepolia.v4StartBlock,
    //   interval: BLOCK_INTERVALS.FIFTY_BLOCKS, // every 50 blocks
    // },
    // BaseV4PoolCheckpoints: {
    //   chain: "base",
    //   startBlock: base.v4StartBlock,
    //   interval: BLOCK_INTERVALS.FIFTY_BLOCKS, // every 50 blocks
    // },
    // UnichainV4PoolCheckpoints: {
    //   chain: "unichain",
    //   startBlock: unichain.v4StartBlock,
    //   interval: BLOCK_INTERVALS.FIFTY_BLOCKS, // every 50 blocks
    // },
    // InkV4PoolCheckpoints: {
    //   chain: "ink",
    //   startBlock: ink.v4StartBlock,
    //   interval: BLOCK_INTERVALS.FIFTY_BLOCKS, // every 50 blocks
    // },
    // MetricRefresherUnichain: {
    //   chain: "unichain",
    //   startBlock: unichain.startBlock,
    //   interval: BLOCK_INTERVALS.THOUSAND_BLOCKS, // every 1000 blocks
    // },
    // MetricRefresherInk: {
    //   chain: "ink",
    //   startBlock: ink.startBlock,
    //   interval: BLOCK_INTERVALS.THOUSAND_BLOCKS, // every 1000 blocks
    // },
    // MetricRefresherBase: {
    //   chain: "base",
    //   startBlock: base.zoraStartBlock,
    //   interval: BLOCK_INTERVALS.THOUSAND_BLOCKS, // every 1000 blocks
    // },
    // MetricRefresherBaseSepolia: {
    //   chain: "baseSepolia",
    //   startBlock: baseSepolia.startBlock,
    //   interval: BLOCK_INTERVALS.THOUSAND_BLOCKS, // every 1000 blocks
    // },
    // PendingTokenImagesBase: {
    //   chain: "base",
    //   startBlock: base.startBlock,
    //   interval: BLOCK_INTERVALS.THOUSAND_BLOCKS * 3, // Check every 3000 blocks
    // },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      chain: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: unichain.addresses.shared.airlock,
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: ink.addresses.shared.airlock,
        // },
        // baseSepolia: {
        //   startBlock: V4_START_BLOCKS.baseSepolia,
        //   address: baseSepolia.addresses.shared.airlock,
        // },
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.addresses.shared.airlock,
        // },
      },
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      chain: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: unichain.addresses.v3.v3Initializer,
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: ink.addresses.v3.v3Initializer,
        // },
        // baseSepolia: {
        //   startBlock: V4_START_BLOCKS.baseSepolia,
        //   address: baseSepolia.addresses.v3.v3Initializer,
        // },
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.addresses.v3.v3Initializer,
        // },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      chain: {
        // unichain: {
        //   startBlock: V4_START_BLOCKS.unichain,
        //   address: unichain.addresses.v4.v4Initializer,
        // },
        // ink: {
        //   startBlock: V4_START_BLOCKS.ink,
        //   address: ink.addresses.v4.v4Initializer,
        // },
        // baseSepolia: {
        //   startBlock: V4_START_BLOCKS.baseSepolia,
        //   address: baseSepolia.addresses.v4.v4Initializer,
        // },
        // base: {
        //   startBlock: V4_START_BLOCKS.base,
        //   address: base.addresses.v4.v4Initializer,
        // },
      },
    },
    UniswapV4Initializer2: {
      abi: UniswapV4InitializerABI,
      chain: {
        // base: {
        //   startBlock: V4_START_BLOCKS.base,
        //   address: base.addresses.v4.v4Initializer2,
        // },
        // unichain: {
        //   startBlock: V4_START_BLOCKS.unichain,
        //   address: unichain.addresses.v4.v4Initializer2,
        // },
        // ink: {
        //   startBlock: V4_START_BLOCKS.ink,
        //   address: ink.addresses.v4.v4Initializer2,
        // },
      },
    },
    UniswapV4InitializerSelfCorrecting: {
      abi: UniswapV4InitializerABI,
      chain: {
        // base: {
        //   startBlock: SELF_CORRECTING_V4_INITIALIZER_START_BLOCKS.base,
        //   address: base.addresses.v4.v4InitializerSelfCorrecting,
        // },
        // baseSepolia: {
        //   startBlock: SELF_CORRECTING_V4_INITIALIZER_START_BLOCKS.baseSepolia,
        //   address: baseSepolia.addresses.v4.v4InitializerSelfCorrecting,
        // },
      },
    },
    DERC20: {
      abi: DERC20ABI,
      chain: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: factory({
        //     address: unichain.addresses.shared.airlock,
        //     event: getAbiItem({ abi: AirlockABI, name: "Create" }),
        //     parameter: "asset",
        //   }),
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: factory({
        //     address: ink.addresses.shared.airlock,
        //     event: getAbiItem({ abi: AirlockABI, name: "Create" }),
        //     parameter: "asset",
        //   }),
        // },
        // baseSepolia: {
        //   startBlock: baseSepolia.startBlock,
        //   address: factory({
        //     address: baseSepolia.addresses.shared.airlock,
        //     event: getAbiItem({ abi: AirlockABI, name: "Create" }),
        //     parameter: "asset",
        //   }),
        // },
        // base: {
        //   startBlock: base.startBlock,
        //   address: factory({
        //     address: base.addresses.shared.airlock,
        //     event: getAbiItem({ abi: AirlockABI, name: "Create" }),
        //     parameter: "asset",
        //   }),
        // },
      },
    },
    UniswapV3MigrationPool: {
      abi: UniswapV3PoolABI,
      chain: {
        // baseSepolia: {
        //   startBlock: 28245945, // hardcoded for now
        //   address: factory({
        //     address: baseSepolia.addresses.v3.v3Migrator,
        //     event: getAbiItem({ abi: UniswapV3MigratorAbi, name: "Migrate" }),
        //     parameter: "pool",
        //   }),
        // },
      },
    },
    UniswapV3Migrator: {
      abi: UniswapV3MigratorAbi,
      chain: {
        // baseSepolia: {
        //   startBlock: 28245945, // hardcoded for now
        //   address: baseSepolia.addresses.v3.v3Migrator,
        // },
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: factory({
        //     address: unichain.addresses.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: factory({
        //     address: ink.addresses.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // baseSepolia: {
        //   startBlock: V4_START_BLOCKS.baseSepolia,
        //   address: factory({
        //     address: baseSepolia.addresses.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // base: {
        //   startBlock: base.startBlock,
        //   address: factory({
        //     address: base.addresses.v3.v3Initializer,
        //     event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
      },
    },
    LockableUniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {
        // baseSepolia: {
        //   startBlock: LOCKABLE_V3_INITIALIZER_START_BLOCKS.baseSepolia,
        //   address: factory({
        //     address: baseSepolia.addresses.v3.lockableV3Initializer,
        //     event: getAbiItem({
        //       abi: LockableUniswapV3InitializerABI,
        //       name: "Create",
        //     }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // base: {
        //   startBlock: LOCKABLE_V3_INITIALIZER_START_BLOCKS.base,
        //   address: factory({
        //     address: base.addresses.v3.lockableV3Initializer,
        //     event: getAbiItem({ abi: LockableUniswapV3InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      chain: {
        // baseSepolia: {
        //   startBlock: V4_START_BLOCKS.baseSepolia,
        //   address: factory({
        //     address: baseSepolia.addresses.shared.airlock,
        //     event: getAbiItem({
        //       abi: AirlockABI,
        //       name: "Migrate",
        //     }),
        //     parameter: "pool",
        //   }),
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: factory({
        //     address: ink.addresses.shared.airlock,
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
        //     address: base.addresses.shared.airlock,
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
      chain: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: factory({
        //     address: unichain.addresses.v2.factory,
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
      chain: {
        // baseSepolia: {
        //   startBlock: V4_START_BLOCKS.baseSepolia,
        //   address: baseSepolia.addresses.v4.poolManager,
        // },
        // base: {
        //   startBlock: V4_START_BLOCKS.base,
        //   address: base.addresses.v4.poolManager,
        // },
        // unichain: {
        //   startBlock: V4_START_BLOCKS.unichain,
        //   address: unichain.addresses.v4.poolManager,
        // },
        // ink: {
        //   startBlock: V4_START_BLOCKS.ink,
        //   address: ink.addresses.v4.poolManager,
        // },
      },
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      chain: {
        // baseSepolia: {
        //   startBlock: V4_START_BLOCKS.baseSepolia,
        //   address: factory({
        //     address: baseSepolia.addresses.v4.v4Initializer,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // base: {
        //   startBlock: V4_START_BLOCKS.base,
        //   address: factory({
        //     address: base.addresses.v4.v4Initializer,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // unichain: {
        //   startBlock: V4_START_BLOCKS.unichain,
        //   address: factory({
        //     address: unichain.addresses.v4.v4Initializer,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // ink: {
        //   startBlock: V4_START_BLOCKS.ink,
        //   address: factory({
        //     address: ink.addresses.v4.v4Initializer,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
      },
    },
    UniswapV4Pool2: {
      abi: DopplerABI,
      chain: {
        // base: {
        //   startBlock: V4_START_BLOCKS.base,
        //   address: factory({
        //     address: base.addresses.v4.v4Initializer2,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // unichain: {
        //   startBlock: V4_START_BLOCKS.unichain,
        //   address: factory({
        //     address: unichain.addresses.v4.v4Initializer2,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // ink: {
        //   startBlock: V4_START_BLOCKS.ink,
        //   address: factory({
        //     address: ink.addresses.v4.v4Initializer2,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
      },
    },
    UniswapV4PoolSelfCorrecting: {
      abi: DopplerABI,
      chain: {
        // base: {
        //   startBlock: SELF_CORRECTING_V4_INITIALIZER_START_BLOCKS.base,
        //   address: factory({
        //     address: base.addresses.v4.v4InitializerSelfCorrecting,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // baseSepolia: {
        //   startBlock: SELF_CORRECTING_V4_INITIALIZER_START_BLOCKS.baseSepolia,
        //   address: factory({
        //     address: baseSepolia.addresses.v4.v4InitializerSelfCorrecting,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
      },
    },
    LockableUniswapV3Initializer: {
      abi: LockableUniswapV3InitializerABI,
      chain: {
        // baseSepolia: {
        //   startBlock: LOCKABLE_V3_INITIALIZER_START_BLOCKS.baseSepolia,
        //   address: baseSepolia.addresses.v3.lockableV3Initializer,
        // },
        // base: {
        //   startBlock: LOCKABLE_V3_INITIALIZER_START_BLOCKS.base,
        //   address: base.addresses.v3.lockableV3Initializer,
        // },
      },
    },
    ZoraFactory: {
      abi: ZoraFactoryABI,
      chain: {
        base: {
          startBlock: base.zoraStartBlock,
          address: base.addresses.zora.zoraFactory,
        },
      },
    },
    ZoraCoin: {
      abi: ZoraCoinABI,
      chain: {
        base: {
          startBlock: base.zoraStartBlock,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreated" }),
            parameter: "coin",
          }),
        },
      },
    },
    ZoraCoinV4: {
      abi: ZoraCoinABI,
      chain: {
        base: {
          startBlock: base.zoraStartBlock,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreatedV4" }),
            parameter: "coin",
          }),
        },
      },
    },
    ZoraUniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {
        base: {
          startBlock: base.zoraStartBlock,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreated" }),
            parameter: "pool",
          }),
        },
      },
    },
    ZoraV4Hook: {
      abi: ZoraV4HookABI,
      chain: {
        base: {
          startBlock: base.zoraStartBlock,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreatedV4" }),
            parameter: "poolKey.hooks",
          }),
        },
      },
    },
  },
});
