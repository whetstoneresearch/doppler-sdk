import { Address, zeroAddress } from "viem";

export type Network = "unichainSepolia" | "mainnet" | "unichain";

export const CHAIN_IDS = {
  unichainSepolia: 1301,
  unichain: 130,
  mainnet: 1,
} as const;

const unichainSepoliaStartBlock = 11932039;
const mainnetStartBlockUnichainSepolia = 21782000;

const unichainStartBlock = 8536880;
const mainnetStartBlockUnichain = 21823900;

export type IndexerConfigs = Record<Network, DopplerConfig>;

export type DopplerConfig = {
  v3: V3Addresses;
  v4: V4Addresses;
  shared: SharedAddresses;
  oracle: OracleAddresses;
  startBlock: number;
  oracleStartBlock: number;
};

export type SharedAddresses = {
  airlock: Address;
  tokenFactory: Address;
  universalRouter: Address;
  governanceFactory: Address;
  migrator: Address;
  weth: Address;
};

export type V4Addresses = {
  dopplerDeployer: Address;
  v4Initializer: Address;
  stateView: Address;
  poolManager: Address;
};

export type V3Addresses = {
  v3Initializer: Address;
};

export type OracleAddresses = {
  mainnetEthUsdc: Address;
  weth: Address;
  usdc: Address;
  chainlinkEth: Address;
};

export const oracleAddresses: OracleAddresses = {
  mainnetEthUsdc: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" as Address,
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
  chainlinkEth: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as Address,
};

export const configs: IndexerConfigs = {
  unichainSepolia: {
    v3: {
      v3Initializer: "0x7Fb9a622186B4660A5988C223ebb9d3690dD5007" as Address,
    },
    v4: {
      poolManager: "0x00B036B58a818B1BC34d502D3fE730Db729e62AC" as Address,
      dopplerDeployer: "0x8350cAd81149A9944c2fb4276955FaAA7D61e836" as Address,
      v4Initializer: "0x992375478626E67F4e639d3298EbCAaE51C3dF0b" as Address,
      stateView: "0xc199F1072a74D4e905ABa1A84d9a45E2546B6222" as Address,
    },
    shared: {
      airlock: "0x651ab94B4777e2e4cdf96082d90C65bd947b73A4" as Address,
      tokenFactory: "0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA" as Address,
      universalRouter: "0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D" as Address,
      governanceFactory:
        "0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC" as Address,
      migrator: "0x44C448E38A2C3D206c9132E7f645510dFbBC946b" as Address,
      weth: "0x4200000000000000000000000000000000000006" as Address,
    },
    oracle: oracleAddresses,
    startBlock: unichainSepoliaStartBlock,
    oracleStartBlock: mainnetStartBlockUnichainSepolia,
  },
  mainnet: {
    v3: {
      v3Initializer: zeroAddress as Address,
    },
    v4: {
      poolManager: zeroAddress as Address,
      dopplerDeployer: zeroAddress as Address,
      v4Initializer: zeroAddress as Address,
      stateView: zeroAddress as Address,
    },
    shared: {
      airlock: zeroAddress as Address,
      tokenFactory: zeroAddress as Address,
      universalRouter: zeroAddress as Address,
      governanceFactory: zeroAddress as Address,
      migrator: zeroAddress as Address,
      weth: zeroAddress as Address,
    },
    oracle: oracleAddresses,
    startBlock: mainnetStartBlockUnichain,
    oracleStartBlock: mainnetStartBlockUnichainSepolia,
  },
  unichain: {
    v3: {
      v3Initializer: "0xCe3099B2F07029b086E5e92a1573C5f5A3071783" as Address,
    },
    v4: {
      poolManager: "0x1F98400000000000000000000000000000000004" as Address,
      dopplerDeployer: zeroAddress as Address,
      v4Initializer: zeroAddress as Address,
      stateView: zeroAddress as Address,
    },
    shared: {
      airlock: "0x8b4C7DB9121FC885689C0A50D5a1429F15AEc2a0" as Address,
      tokenFactory: "0xC99b485499f78995C6F1640dbB1413c57f8BA684" as Address,
      universalRouter: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3" as Address,
      governanceFactory:
        "0xa82c66b6ddEb92089015C3565E05B5c9750b2d4B" as Address,
      migrator: "0x014E1c0bd34f3B10546E554CB33B3293fECDD056" as Address,
      weth: "0x4200000000000000000000000000000000000006" as Address,
    },
    oracle: oracleAddresses,
    startBlock: unichainStartBlock,
    oracleStartBlock: mainnetStartBlockUnichain,
  },
};
