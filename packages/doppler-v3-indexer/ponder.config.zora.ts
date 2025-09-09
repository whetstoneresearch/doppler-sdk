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
  ZoraCreatorCoinABI,
} from "./src/abis";
import { BLOCK_INTERVALS } from "./src/config/chains/constants";
import {
  chainConfigs,
  CHAIN_IDS,
} from "./src/config/chains";
import { LockableUniswapV3InitializerABI } from "@app/abis/v3-abis/LockableUniswapV3InitializerABI";
import { UniswapV3MigratorAbi } from "@app/abis/v3-abis/UniswapV3Migrator";

const { base } = chainConfigs;

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
    // unichain: {
    //   id: CHAIN_IDS.unichain,
    //   rpc: http(process.env.PONDER_RPC_URL_130),
    // },
    // ink: {
    //   id: CHAIN_IDS.ink,
    //   rpc: http(process.env.PONDER_RPC_URL_130),
    // },
    base: {
      id: CHAIN_IDS.base,
      rpc: http(process.env.PONDER_RPC_URL_8453),
    },
  },
  blocks: {
    BaseChainlinkEthPriceFeed: {
      chain: "base",
      startBlock: base.startBlock,
      interval: BLOCK_INTERVALS.FIVE_MINUTES, // every 5 minutes
    },
    // UnichainChainlinkEthPriceFeed: {
    //   chain: "unichain",
    //   startBlock: unichain.startBlock,
    //   interval: BLOCK_INTERVALS.FIVE_MINUTES, // every 5 minutes
    // },
    // InkChainlinkEthPriceFeed: {
    //   chain: "ink",
    //   startBlock: ink.startBlock,
    //   interval: BLOCK_INTERVALS.FIVE_MINUTES, // every 5 minutes
    // },
    ZoraUsdcPrice: {
      chain: "base",
      startBlock: 31058549,
      interval: BLOCK_INTERVALS.FIVE_MINUTES, // every 5 minutes
    },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      chain: {
        // unichain: {
        //   startBlock: unichain.startBlock,
        //   address: unichain.addresses.shared.airlock,
        // },
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.addresses.shared.airlock,
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: ink.addresses.shared.airlock,
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
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.addresses.v3.v3Initializer,
        // },
        // ink: {
        //   startBlock: ink.startBlock,
        //   address: ink.addresses.v3.v3Initializer,
        // },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      chain: {
        // unichain: {
        //   startBlock: unichain.v4StartBlock,
        //   address: unichain.addresses.v4.v4Initializer,
        // },
        // base: {
        //   startBlock: base.v4StartBlock,
        //   address: base.addresses.v4.v4Initializer,
        // },
        // ink: {
        //   startBlock: ink.v4StartBlock,
        //   address: ink.addresses.v4.v4Initializer,
        // },
      },
    },
    UniswapV4Initializer2: {
      abi: UniswapV4InitializerABI,
      chain: {
        // base: {
        //   startBlock: base.v4StartBlock,
        //   address: base.addresses.v4.v4Initializer2,
        // },
        // unichain: {
        //   startBlock: unichain.v4StartBlock,
        //   address: unichain.addresses.v4.v4Initializer2,
        // },
        // ink: {
        //   startBlock: ink.v4StartBlock,
        //   address: ink.addresses.v4.v4Initializer2,
        // },
      },
    },
    UniswapV4InitializerSelfCorrecting: {
      abi: UniswapV4InitializerABI,
      chain: {
        // base: {
        //   startBlock: base.v4StartBlock,
        //   address: base.addresses.v4.v4InitializerSelfCorrecting,
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
        // base: {
        //   startBlock: base.startBlock,
        //   address: factory({
        //     address: base.addresses.shared.airlock,
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
        // base: {
        //   startBlock: base.startBlock,
        //   address: factory({
        //     address: base.addresses.v3.v3Initializer,
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
      },
    },
    LockableUniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {
        // base: {
        //   startBlock: base.startBlock,
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
        // base: {
        //   startBlock: base.v4StartBlock,
        //   address: base.addresses.v4.poolManager,
        // },
        // unichain: {
        //   startBlock: unichain.v4StartBlock,
        //   address: unichain.addresses.v4.poolManager,
        // },
        // ink: {
        //   startBlock: ink.v4StartBlock,
        //   address: ink.addresses.v4.poolManager,
        // },
      },
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      chain: {
        // base: {
        //   startBlock: base.v4StartBlock,
        //   address: factory({
        //     address: base.addresses.v4.v4Initializer,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // unichain: {
        //   startBlock: unichain.v4StartBlock,
        //   address: factory({
        //     address: unichain.addresses.v4.v4Initializer,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // ink: {
        //   startBlock: ink.v4StartBlock,
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
        //   startBlock: base.v4StartBlock,
        //   address: factory({
        //     address: base.addresses.v4.v4Initializer2,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // unichain: {
        //   startBlock: unichain.v4StartBlock,
        //   address: factory({
        //     address: unichain.addresses.v4.v4Initializer2,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
        // ink: {
        //   startBlock: ink.v4StartBlock,
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
        //   startBlock: base.v4StartBlock,
        //   address: factory({
        //     address: base.addresses.v4.v4InitializerSelfCorrecting,
        //     event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
        //     parameter: "poolOrHook",
        //   }),
        // },
      },
    },
    LockableUniswapV3Initializer: {
      abi: LockableUniswapV3InitializerABI,
      chain: {
        // base: {
        //   startBlock: base.startBlock,
        //   address: base.addresses.v3.lockableV3Initializer,
        // },
      },
    },
    ZoraFactory: {
      abi: ZoraFactoryABI,
      chain: {
        base: {
          startBlock: 31058549,
          address: base.addresses.zora.zoraFactory,
        },
      },
    },
    ZoraCoinV4: {
      abi: ZoraCoinABI,
      chain: {
        base: {
          startBlock: 31058549,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreatedV4" }),
            parameter: "coin",
          }),
        },
      },
    },
    ZoraCreatorCoinV4: {
      abi: ZoraCreatorCoinABI,
      chain: {
        base: {
          startBlock: 31058549,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CreatorCoinCreated" }),
            parameter: "coin",
          }),
        },
      },
    },
    ZoraV4Hook: {
      abi: ZoraV4HookABI,
      chain: {
        base: {
          startBlock: 31058549,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CoinCreatedV4" }),
            parameter: "poolKey.hooks",
          }),
        },
      },
    },
    ZoraV4CreatorCoinHook: {
      abi: ZoraV4HookABI,
      chain: {
        base: {
          startBlock: 31058549,
          address: factory({
            address: base.addresses.zora.zoraFactory,
            event: getAbiItem({ abi: ZoraFactoryABI, name: "CreatorCoinCreated" }),
            parameter: "poolKey.hooks",
          }),
        },
      },
    },
  },
});
