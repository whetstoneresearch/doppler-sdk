import { Address, zeroAddress } from "viem";

export type Network =
  | "mainnet"
  | "unichain"
  | "baseSepolia"
  | "ink"
  | "base";

export const CHAIN_IDS = {
  unichain: 130,
  mainnet: 1,
  baseSepolia: 84532,
  ink: 57073,
  base: 8453,
} as const;

const mainnetStartBlock = 21781000;


const unichainStartBlock = 8536880;
const v4UnichainStartBlock = 17686805;

const baseSepoliaStartBlock = 22668126;
const v4BaseSepoliaStartBlock = 26638492;

const inkStartBlock = 9500879;
const v4InkStartBlock = 14937170;

const baseStartBlock = 28415520;
const v4BaseStartBlock = 30822164;

export type IndexerConfigs = Record<Network, DopplerConfig>;

export type DopplerConfig = {
  v2: V2Addresses;
  v3: V3Addresses;
  v4: V4Addresses;
  shared: SharedAddresses;
  oracle: OracleAddresses;
  startBlock: number;
  v4StartBlock?: number;
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
  stateView: Address;
  poolManager: Address;
  dopplerLens: Address;
  v4Initializer: Address;
  v4Initializer2: Address;
};

export type V3Addresses = {
  v3Initializer: Address;
  lockableV3Initializer: Address;
};

export type V2Addresses = {
  factory: Address;
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
  mainnet: {
    v2: {
      factory: zeroAddress as Address,
    },
    v3: {
      v3Initializer: zeroAddress as Address,
    },
    v4: {
      poolManager: zeroAddress as Address,
      dopplerDeployer: zeroAddress as Address,
      v4Initializer: zeroAddress as Address,
      stateView: zeroAddress as Address,
      dopplerLens: zeroAddress,
      v4Initializer2: zeroAddress,
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
    startBlock: mainnetStartBlock,
    oracleStartBlock: mainnetStartBlock,
  },
  unichain: {
    v2: {
      factory: "0x1f98400000000000000000000000000000000002" as Address,
    },
    v3: {
      v3Initializer: "0x9F4e56be80f08ba1A2445645EFa6d231E27b43ec" as Address,
    },
    v4: {
      poolManager: "0x1F98400000000000000000000000000000000004" as Address,
      dopplerDeployer: "0xBEd386a1Fc62B6598c9b8d2BF634471B6Fe75EB7" as Address,
      v4Initializer: "0xA7A28cB18F73CDd591fa81ead6ffadf749c0d0a2" as Address,
      stateView: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2" as Address,
      dopplerLens: "0x166109C4EE7fE69164631Caa937dAA5F5cEbFef0" as Address,
      v4Initializer2: zeroAddress,
    },
    shared: {
      airlock: "0x77EbfBAE15AD200758E9E2E61597c0B07d731254" as Address,
      tokenFactory: "0x43d0D97EC9241A8F05A264f94B82A1d2E600f2B3" as Address,
      universalRouter: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3" as Address,
      governanceFactory:
        "0x99C94B9Df930E1E21a4E4a2c105dBff21bF5c5aE" as Address,
      migrator: "0xf6023127f6E937091D5B605680056A6D27524bad" as Address,
      weth: "0x4200000000000000000000000000000000000006" as Address,
    },
    oracle: oracleAddresses,
    startBlock: unichainStartBlock,
    oracleStartBlock: mainnetStartBlock,
    v4StartBlock: v4UnichainStartBlock,
  },
  baseSepolia: {
    v2: {
      factory: "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e" as Address,
    },
    v3: {
      v3Initializer: "0x4c3062b9ccfdbcb10353f57c1b59a29d4c5cfa47" as Address,
    },
    v4: {
      poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Address,
      dopplerDeployer: "0x4bf819dfa4066bd7c9f21ea3db911bd8c10cb3ca" as Address,
      v4Initializer: "0xca2079706a4c2a4a1aa637dfb47d7f27fe58653f" as Address,
      dopplerLens: "0x4a8d81db741248a36d9eb3bc6ef648bf798b47a7" as Address,
      stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4" as Address,
      v4Initializer2: zeroAddress,
    },
    shared: {
      airlock: "0x3411306ce66c9469bff1535ba955503c4bde1c6e" as Address,
      tokenFactory: "0xc69ba223c617f7d936b3cf2012aa644815dbe9ff" as Address,
      universalRouter: "0x492e6456d9528771018deb9e87ef7750ef184104" as Address,
      governanceFactory:
        "0x9dbfaadc8c0cb2c34ba698dd9426555336992e20" as Address,
      migrator: "0xb2ec6559704467306d04322a5dc082b2af4562dd" as Address,
      weth: "0x4200000000000000000000000000000000000006" as Address,
    },
    oracle: oracleAddresses,
    startBlock: baseSepoliaStartBlock,
    v4StartBlock: v4BaseSepoliaStartBlock,
    oracleStartBlock: mainnetStartBlock,
  },
  ink: {
    v2: {
      factory: "0xfe57A6BA1951F69aE2Ed4abe23e0f095DF500C04" as Address,
    },
    v3: {
      v3Initializer: "0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5" as Address,
    },
    v4: {
      poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32" as Address,
      dopplerDeployer: "0x8b4C7DB9121FC885689C0A50D5a1429F15AEc2a0" as Address,
      v4Initializer: "0xC99b485499f78995C6F1640dbB1413c57f8BA684" as Address,
      v4Initializer2: "0x014E1c0bd34f3B10546E554CB33B3293fECDD056" as Address,
      stateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990" as Address,
      dopplerLens: "0xCe3099B2F07029b086E5e92a1573C5f5A3071783" as Address,
    },
    shared: {
      airlock: "0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12" as Address,
      tokenFactory: "0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45" as Address,
      universalRouter: "0x112908dac86e20e7241b0927479ea3bf935d1fa0" as Address,
      governanceFactory:
        "0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9" as Address,
      migrator: "0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731" as Address,
      weth: "0x4200000000000000000000000000000000000006" as Address,
    },
    oracle: oracleAddresses,
    startBlock: inkStartBlock,
    oracleStartBlock: mainnetStartBlock,
    v4StartBlock: v4InkStartBlock,
  },
  base: {
    v2: {
      factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6" as Address,
    },
    v3: {
      v3Initializer: "0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5" as Address,
    },
    v4: {
      poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b" as Address,
      dopplerDeployer: "0x014E1c0bd34f3B10546E554CB33B3293fECDD056" as Address,
      v4Initializer: "0x8AF018e28c273826e6b2d5a99e81c8fB63729b07" as Address,
      v4Initializer2: "0x77EbfBAE15AD200758E9E2E61597c0B07d731254" as Address,
      stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as Address,
      dopplerLens: "0x094d926a969b3024ca46d2186bf13fd5cdba9ce2" as Address,
    },
    shared: {
      airlock: "0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12" as Address,
      tokenFactory: "0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45" as Address,
      universalRouter: "0x6ff5693b99212da76ad316178a184ab56d299b43" as Address,
      governanceFactory:
        "0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9" as Address,
      migrator: "0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731" as Address,
      weth: "0x4200000000000000000000000000000000000006" as Address,
    },
    oracle: oracleAddresses,
    startBlock: baseStartBlock,
    v4StartBlock: v4BaseStartBlock,
    oracleStartBlock: mainnetStartBlock,
  },
};
