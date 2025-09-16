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
import { UniswapV2FactoryABI } from "@app/abis/UniswapV2Factory";

const { base, unichain, ink, baseSepolia } = chainConfigs;

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
    baseSepolia: {
      id: CHAIN_IDS.baseSepolia,
      rpc: http(process.env.PONDER_RPC_URL_84532),
    },
  },
  blocks: {
    BaseSepoliaChainlinkEthPriceFeed: {
      chain: "baseSepolia",
      startBlock: baseSepolia.startBlock,
      interval: BLOCK_INTERVALS.FIVE_MINUTES, // every 5 minutes
    },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.shared.airlock,
        },
      },
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.v3.v3Initializer,
        },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.addresses.v4.v4Initializer,
        },
      },
    },
    UniswapV4Initializer2: {
      abi: UniswapV4InitializerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.addresses.v4.v4Initializer2,
        }
      },
    },
    UniswapV4InitializerSelfCorrecting: {
      abi: UniswapV4InitializerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.addresses.v4.v4InitializerSelfCorrecting,
        }
      },
    },
    DERC20: {
      abi: DERC20ABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.v3.v3Initializer,
        },
      },
    },
    UniswapV3MigrationPool: {
      abi: UniswapV3PoolABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.v3.v3Migrator,
        },
      },
    },
    UniswapV3Migrator: {
      abi: UniswapV3MigratorAbi,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.v3.v3Migrator,
        },
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: factory({
            address: baseSepolia.addresses.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    LockableUniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: factory({
            address: baseSepolia.addresses.v3.lockableV3Initializer,
            event: getAbiItem({ abi: LockableUniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: factory({
            address: baseSepolia.addresses.v2.factory,
            event: getAbiItem({ abi: UniswapV2FactoryABI, name: "PairCreated" }),
            parameter: "pair",
          }),
        },
      },
    },
    UniswapV2PairUnichain: {
      abi: UniswapV2PairABI,
      chain: {},
    },
    PoolManager: {
      abi: PoolManagerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: baseSepolia.addresses.v4.poolManager,
        },
      },
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.v4StartBlock,
          address: factory({
            address: baseSepolia.addresses.v4.v4Initializer,
            event: getAbiItem({ abi: UniswapV4InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    UniswapV4Pool2: {
      abi: DopplerABI,
      chain: {},
    },
    UniswapV4PoolSelfCorrecting: {
      abi: DopplerABI,
      chain: {},
    },
    LockableUniswapV3Initializer: {
      abi: LockableUniswapV3InitializerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.zora.zoraFactory,
        },
      },
    },
    ZoraFactory: {
      abi: ZoraFactoryABI,
      chain: {},
    },
    ZoraCoinV4: {
      abi: ZoraCoinABI,
      chain: {},
    },
    ZoraCreatorCoinV4: {
      abi: ZoraCreatorCoinABI,
      chain: {},
    },
    ZoraV4Hook: {
      abi: ZoraV4HookABI,
      chain: {},
    },
    ZoraV4CreatorCoinHook: {
      abi: ZoraV4HookABI,
      chain: {},
    },
  },
});
