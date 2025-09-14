import { Address } from "viem";
import { ChainConfig } from "./types";
import {
  CHAIN_IDS,
  START_BLOCKS,
  V4_START_BLOCKS,
  ORACLE_ADDRESSES,
  COMMON_ADDRESSES,
  RPC_ENV_VARS,
} from "./constants";

export const inkConfig: ChainConfig = {
  id: CHAIN_IDS.ink,
  name: "ink",
  startBlock: START_BLOCKS.ink,
  v4StartBlock: V4_START_BLOCKS.ink,
  oracleStartBlock: START_BLOCKS.mainnet,
  rpcEnvVar: RPC_ENV_VARS.ink,
  addresses: {
    v2: {
      factory: "0xfe57A6BA1951F69aE2Ed4abe23e0f095DF500C04" as Address,
      v2Migrator: "0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731" as Address,
    },
    v3: {
      v3Initializer: "0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5" as Address,
      lockableV3Initializer: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      v3Migrator: COMMON_ADDRESSES.ZERO_ADDRESS,
    },
    v4: {
      poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32" as Address,
      dopplerDeployer: "0x8b4C7DB9121FC885689C0A50D5a1429F15AEc2a0" as Address,
      v4Initializer: "0xC99b485499f78995C6F1640dbB1413c57f8BA684" as Address,
      v4Initializer2: "0x014E1c0bd34f3B10546E554CB33B3293fECDD056" as Address,
      stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990" as Address,
      dopplerLens: "0xCe3099B2F07029b086E5e92a1573C5f5A3071783" as Address,
      v4Migrator: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4MigratorHook: COMMON_ADDRESSES.ZERO_ADDRESS,
      v4InitializerSelfCorrecting: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      v4InitializerLatest: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      v4MulticurveInitializer: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
      v4MulticurveInitializerHook: COMMON_ADDRESSES.ZERO_ADDRESS as Address,
    },
    shared: {
      airlock: "0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12" as Address,
      tokenFactory: "0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45" as Address,
      universalRouter: "0x112908dac86e20e7241b0927479ea3bf935d1fa0" as Address,
      governanceFactory:
        "0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9" as Address,
      weth: COMMON_ADDRESSES.WETH_BASE,
      chainlinkEthOracle:
        "0xe5867B1d421f0b52697F16e2ac437e87d66D5fbF" as Address,
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
