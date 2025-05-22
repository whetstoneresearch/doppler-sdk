import { Address, zeroAddress } from "viem";

export type Network =
  | "unichainSepolia"
  | "mainnet"
  | "unichain"
  | "baseSepolia"
  | "ink"
  | "base";

export const CHAIN_IDS = {
  unichainSepolia: 1301,
  unichain: 130,
  mainnet: 1,
  baseSepolia: 84532,
  ink: 57073,
  base: 8453,
} as const;

const mainnetStartBlock = 21781000;

const unichainSepoliaStartBlock = 11932039;

const unichainStartBlock = 8536880;

const baseSepoliaStartBlock = 22668126;
const v4BaseSepoliaStartBlock = 26008121;

const inkStartBlock = 9500879;

const baseStartBlock = 28415526;
const v4BaseStartBlock = 30520980;

export type IndexerConfigs = Record<Network, DopplerConfig>;

export const zoraFactoryBase = "0x777777751622c0d3258f214F9DF38E35BF45baF3";
export const zoraStartBlock = 29011355;

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
  v4Initializer: Address;
  stateView: Address;
  poolManager: Address;
  dopplerLens: Address;
};

export type V3Addresses = {
  v3Initializer: Address;
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
  unichainSepolia: {
    v2: {
      factory: "0x5C69bEe701ef814a2B6a3EDD4B165e154b09Fcd3" as Address,
    },
    v3: {
      v3Initializer: "0x7Fb9a622186B4660A5988C223ebb9d3690dD5007" as Address,
    },
    v4: {
      poolManager: "0x00B036B58a818B1BC34d502D3fE730Db729e62AC" as Address,
      dopplerDeployer: "0x8350cAd81149A9944c2fb4276955FaAA7D61e836" as Address,
      v4Initializer: "0x992375478626E67F4e639d3298EbCAaE51C3dF0b" as Address,
      stateView: "0xc199F1072a74D4e905ABa1A84d9a45E2546B6222" as Address,
      dopplerLens: zeroAddress,
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
    oracleStartBlock: mainnetStartBlock,
  },
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
      dopplerDeployer: zeroAddress as Address,
      v4Initializer: zeroAddress as Address,
      stateView: zeroAddress as Address,
      dopplerLens: zeroAddress,
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
  },
  baseSepolia: {
    v2: {
      factory: "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e" as Address,
    },
    v3: {
      v3Initializer: "0x9581Fd5De3ECe5675136b4f9091BEA1beD0Fc27C" as Address,
    },
    v4: {
      poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Address,
      dopplerDeployer: "0xd531fD0E8612e820e624C1B7CB11326bCe2b6C8B" as Address,
      v4Initializer: "0x7dC6ced696831EE721d8B400FBc633b1Fe8E63fC" as Address,
      dopplerLens: "0xf926f5fC0bFB95D831C064C268F556B1394b476E" as Address,
      stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4" as Address,
    },
    shared: {
      airlock: "0x5Be5B41Cf8Feeba9d8Bf08Fe957b8a5c68aaA155" as Address,
      tokenFactory: "0x820DC6BC3e8Fa2d60771EfE78E8fC276FE760223" as Address,
      universalRouter: "0x95273d871c8156636e114b63797d78D7E1720d81" as Address,
      governanceFactory:
        "0x2Ef4369695CA568fB0CC76605C430149Ca297629" as Address,
      migrator: "0x5069dbeBdc7ff55df3cBb2F9E82c4D8F64570589" as Address,
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
      poolManager: zeroAddress as Address,
      dopplerDeployer: zeroAddress as Address,
      v4Initializer: zeroAddress as Address,
      stateView: zeroAddress as Address,
      dopplerLens: zeroAddress,
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
      dopplerDeployer: "0x8b4C7DB9121FC885689C0A50D5a1429F15AEc2a0" as Address,
      v4Initializer: "0xC99b485499f78995C6F1640dbB1413c57f8BA684" as Address,
      stateView: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as Address,
      dopplerLens: "0xCe3099B2F07029b086E5e92a1573C5f5A3071783" as Address,
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
