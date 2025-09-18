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
import { chainConfigs, CHAIN_IDS } from "./src/config/chains";
import { LockableUniswapV3InitializerABI } from "@app/abis/v3-abis/LockableUniswapV3InitializerABI";
import { UniswapV3MigratorAbi } from "@app/abis/v3-abis/UniswapV3Migrator";
import { UniswapV4MulticurveInitializerHookABI } from "@app/abis/multicurve-abis/UniswapV4MulticurveInitializerHookABI";
import { UniswapV4MulticurveInitializerABI } from "@app/abis/multicurve-abis/UniswapV4MulticurveInitializerABI";

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
    base: {
      id: CHAIN_IDS.base,
      rpc: http(process.env.PONDER_RPC_URL_8453),
    },
    unichain: {
      id: CHAIN_IDS.unichain,
      rpc: http(process.env.PONDER_RPC_URL_130),
    },
    ink: {
      id: CHAIN_IDS.ink,
      rpc: http(process.env.PONDER_RPC_URL_130),
    },
  },
  blocks: {
    BaseSepoliaChainlinkEthPriceFeed: {
      chain: "baseSepolia",
      startBlock: baseSepolia.startBlock,
      interval: BLOCK_INTERVALS.FIVE_MINUTES, // every 5 minutes
    },
    BaseChainlinkEthPriceFeed: {
      chain: "base",
      startBlock: base.startBlock,
      interval: 99999999999, // never run on testnet, just need this otherwise build fails...
    },
    UnichainChainlinkEthPriceFeed: {
      chain: "unichain",
      startBlock: unichain.startBlock,
      interval: 99999999999, // never run on testnet, just need this otherwise build fails...
    },
    InkChainlinkEthPriceFeed: {
      chain: "ink",
      startBlock: ink.startBlock,
      interval: 99999999999, // never run on testnet, just need this otherwise build fails...
    },
    ZoraUsdcPrice: {
      chain: "base",
      startBlock: 31058549,
      interval: 99999999999, // never run on testnet, just need this otherwise build fails...
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
      chain: {},
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      chain: {},
    },
    UniswapV4Initializer2: {
      abi: UniswapV4InitializerABI,
      chain: {},
    },
    UniswapV4InitializerSelfCorrecting: {
      abi: UniswapV4InitializerABI,
      chain: {},
    },
    DERC20: {
      abi: DERC20ABI,
      chain: {},
    },
    UniswapV3MigrationPool: {
      abi: UniswapV3PoolABI,
      chain: {},
    },
    UniswapV3Migrator: {
      abi: UniswapV3MigratorAbi,
      chain: {},
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {},
    },
    LockableUniswapV3Pool: {
      abi: UniswapV3PoolABI,
      chain: {},
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      chain: {},
    },
    UniswapV2PairUnichain: {
      abi: UniswapV2PairABI,
      chain: {},
    },
    PoolManager: {
      abi: PoolManagerABI,
      chain: {},
    },
    UniswapV4Pool: {
      abi: DopplerABI,
      chain: {},
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
      chain: {},
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
    UniswapV4MulticurveInitializer: {
      abi: UniswapV4MulticurveInitializerABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.v4.v4MulticurveInitializer,
        },
      },
    },
    UniswapV4MulticurveInitializerHook: {
      abi: UniswapV4MulticurveInitializerHookABI,
      chain: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.addresses.v4.v4MulticurveInitializerHook,
        },
      },
    },
  },
});
