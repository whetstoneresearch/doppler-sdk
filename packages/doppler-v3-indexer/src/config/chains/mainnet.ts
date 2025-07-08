import { Address, zeroAddress } from "viem";
import { ChainConfig } from "./types";
import { CHAIN_IDS, START_BLOCKS, ORACLE_ADDRESSES, COMMON_ADDRESSES, RPC_ENV_VARS } from "./constants";

export const mainnetConfig: ChainConfig = {
  id: CHAIN_IDS.mainnet,
  name: "mainnet",
  startBlock: START_BLOCKS.mainnet,
  oracleStartBlock: START_BLOCKS.mainnet,
  rpcEnvVar: RPC_ENV_VARS.mainnet,
  addresses: {
    v2: {
      factory: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
    },
    v3: {
      v3Initializer: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      lockableV3Initializer: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
    },
    v4: {
      poolManager: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      dopplerDeployer: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      v4Initializer: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      stateView: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      dopplerLens: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4Initializer2: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4Migrator: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4MigratorHook: COMMON_ADDRESSES.ZERO_ADDRESS,
    },
    shared: {
      airlock: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      tokenFactory: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      universalRouter: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      governanceFactory: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      migrator: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      weth: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
    },
    oracle: ORACLE_ADDRESSES,
  },
};