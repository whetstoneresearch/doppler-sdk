import { Address } from 'viem';
import { DopplerV4Addresses } from './types';

export const DOPPLER_V4_ADDRESSES: { [chainId: number]: DopplerV4Addresses } = {
  //unichain
  130: {
    airlock: '0x77EbfBAE15AD200758E9E2E61597c0B07d731254' as Address,
    tokenFactory: '0x43d0D97EC9241A8F05A264f94B82A1d2E600f2B3' as Address,
    dopplerDeployer: '0x06FEFD02F0b6d9f57F52cfacFc113665Dfa20F0f' as Address,
    poolManager: '0x1f98400000000000000000000000000000000004' as Address,
    v3Initializer: '0x9F4e56be80f08ba1A2445645EFa6d231E27b43ec' as Address,
    v4Initializer: '0x2F2BAcd46d3F5c9EE052Ab392b73711dB89129DB' as Address,
    governanceFactory: '0x99C94B9Df930E1E21a4E4a2c105dBff21bF5c5aE' as Address,
    noOpGovernanceFactory: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    migrator: '0xf6023127f6E937091D5B605680056A6D27524bad' as Address,
    streamableFeesLocker: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    universalRouter: '0xef740bf23acae26f6492b10de645d6b98dc8eaf3' as Address,
    v4Quoter: '0x333e3c607b141b18ff6de9f258db6e77fe7491e0' as Address,
    stateView: '0x86e8631a016f9068c3f085faf484ee3f5fdee8f2' as Address,
  },
  // unichain sepolia
  1301: {
    poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
    airlock: '0x651ab94B4777e2e4cdf96082d90C65bd947b73A4' as Address,
    tokenFactory: '0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA' as Address,
    dopplerDeployer: '0x8350cAd81149A9944c2fb4276955FaAA7D61e836' as Address,
    v4Initializer: '0x992375478626E67F4e639d3298EbCAaE51C3dF0b' as Address,
    v3Initializer: '0x7Fb9a622186B4660A5988C223ebb9d3690dD5007' as Address,
    governanceFactory: '0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC' as Address,
    noOpGovernanceFactory: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    migrator: '0x44C448E38A2C3D206c9132E7f645510dFbBC946b' as Address,
    streamableFeesLocker: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    universalRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D' as Address,
    stateView: '0xc199F1072a74D4e905ABa1A84d9a45E2546B6222' as Address,
    v4Quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  },
  // base sepolia
  84532: {
    airlock: '0x3411306ce66c9469bff1535ba955503c4bde1c6e' as Address,
    tokenFactory: '0xc69ba223c617f7d936b3cf2012aa644815dbe9ff' as Address,
    governanceFactory: '0x9dbfaadc8c0cb2c34ba698dd9426555336992e20' as Address,
    noOpGovernanceFactory: '0x916b8987e4ad325c10d58ed8dc2036a6ff5eb228' as Address,
    migrator: '0xb2ec6559704467306d04322a5dc082b2af4562dd' as Address,
    streamableFeesLocker: '0x4da7d7a8034510c0ffd38a9252237ae8dba3cb61' as Address,
    dopplerDeployer: '0x60a039e4add40ca95e0475c11e8a4182d06c9aa0' as Address,
    v4Initializer: '0x8e891d249f1ecbffa6143c03eb1b12843aef09d3' as Address,
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as Address,
    v3Initializer: '0x4c3062b9ccfdbcb10353f57c1b59a29d4c5cfa47' as Address,
    universalRouter: '0x492e6456d9528771018deb9e87ef7750ef184104' as Address,
    v4Quoter: '0x4a8d81db741248a36d9eb3bc6ef648bf798b47a7' as Address,
    stateView: '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as Address,
  },
  // base
  8453: {
    poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b' as Address,
    dopplerDeployer: '0x2f2bacd46d3f5c9ee052ab392b73711db89129db' as Address,
    v4Initializer: '0x82ac010c67f70bacf7655cd8948a4ad92a173cac' as Address,
    airlock: '0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12' as Address,
    tokenFactory: '0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45' as Address,
    v3Initializer: '0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5' as Address,
    governanceFactory: '0xa82c66b6ddeb92089015c3565e05b5c9750b2d4b' as Address,
    noOpGovernanceFactory: '0xe7dfbd5b0a2c3b4464653a9becdc489229ef090e' as Address,
    migrator: '0x5328a67747c9db61457eb1a23be16bd73d1659c6' as Address,
    streamableFeesLocker: '0x0a00775d71a42cd33d62780003035e7f5b47bd3a' as Address,
    universalRouter: '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address,
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71' as Address,
    v4Quoter: '0x43d0d97ec9241a8f05a264f94b82a1d2e600f2b3' as Address,
  },
  // ink
  57073: {
    poolManager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32' as Address,
    airlock: '0x014E1c0bd34f3B10546E554CB33B3293fECDD056' as Address,
    dopplerDeployer: '0xa82c66b6ddEb92089015C3565E05B5c9750b2d4B' as Address,
    tokenFactory: '0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45' as Address,
    v3Initializer: '0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5' as Address,
    governanceFactory: '0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9' as Address,
    noOpGovernanceFactory: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    migrator: '0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731' as Address,
    streamableFeesLocker: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    v4Initializer: '0xC99b485499f78995C6F1640dbB1413c57f8BA684' as Address,
    v4Quoter: '0x3972c00f7ed4885e145823eb7c655375d275a1c5' as Address,
    stateView: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990' as Address,
    universalRouter: '0x112908dac86e20e7241b0927479ea3bf935d1fa0' as Address,
  },
};
