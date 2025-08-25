import { Address } from "viem";
import { ChainConfig } from "./types";
import {
  CHAIN_IDS,
  START_BLOCKS,
  V4_START_BLOCKS,
  ORACLE_ADDRESSES,
  COMMON_ADDRESSES,
  RPC_ENV_VARS
} from "./constants";

export const unichainConfig: ChainConfig = {
  id: CHAIN_IDS.unichain,
  name: "unichain",
  startBlock: START_BLOCKS.unichain,
  v4StartBlock: V4_START_BLOCKS.unichain,
  oracleStartBlock: START_BLOCKS.mainnet,
  rpcEnvVar: RPC_ENV_VARS.unichain,
  addresses: {
    v2: {
      factory: "0x1f98400000000000000000000000000000000002" as Address,
      v2Migrator: "0xf6023127f6E937091D5B605680056A6D27524bad" as Address,
    },
    v3: {
      v3Initializer: "0x9F4e56be80f08ba1A2445645EFa6d231E27b43ec" as Address,
      lockableV3Initializer: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      v3Migrator: COMMON_ADDRESSES.ZERO_ADDRESS,
    },
    v4: {
      poolManager: "0x1F98400000000000000000000000000000000004" as Address,
      dopplerDeployer: "0xBEd386a1Fc62B6598c9b8d2BF634471B6Fe75EB7" as Address,
      v4Initializer: "0xA7A28cB18F73CDd591fa81ead6ffadf749c0d0a2" as Address,
      stateView: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2" as Address,
      dopplerLens: "0x166109C4EE7fE69164631Caa937dAA5F5cEbFef0" as Address,
      v4Initializer2: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4Migrator: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4MigratorHook: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4InitializerSelfCorrecting: COMMON_ADDRESSES.ZERO_ADDRESS,
    },
    shared: {
      airlock: "0x77EbfBAE15AD200758E9E2E61597c0B07d731254" as Address,
      tokenFactory: "0x43d0D97EC9241A8F05A264f94B82A1d2E600f2B3" as Address,
      universalRouter: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3" as Address,
      governanceFactory: "0x99C94B9Df930E1E21a4E4a2c105dBff21bF5c5aE" as Address,
      weth: COMMON_ADDRESSES.WETH_BASE,
    },
    zora: {
      zoraFactory: COMMON_ADDRESSES.ZERO_ADDRESS,
      zoraTokenPool: COMMON_ADDRESSES.ZERO_ADDRESS,
      zoraToken: COMMON_ADDRESSES.ZERO_ADDRESS,
      creatorCoinHook: COMMON_ADDRESSES.ZERO_ADDRESS,
      contentCoinHook: COMMON_ADDRESSES.ZERO_ADDRESS,
    },
    oracle: ORACLE_ADDRESSES,
  },
};