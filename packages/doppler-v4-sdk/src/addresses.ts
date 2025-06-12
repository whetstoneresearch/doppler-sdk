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
    universalRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D' as Address,
    stateView: '0xc199F1072a74D4e905ABa1A84d9a45E2546B6222' as Address,
    v4Quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  },
  // base sepolia
  84532: {
    airlock: '0xBE5ad4efe4085AF00FD4a9E30b754cDcEFE9C6Ad' as Address,
    tokenFactory: '0xF140987E88208b1ef48Cf5D39448Cc82EdF1f51e' as Address,
    governanceFactory: '0x482055c3a704610b22e77ACc29863F92bcFd4298' as Address,
    noOpGovernanceFactory: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    migrator: '0xD797E6af3211aE124B8EDff69db21FFe6C659104' as Address,
    dopplerDeployer: '0xbC6352F1FE2f5790A4a16ff79C9cB5caD238b258' as Address,
    v4Initializer: '0x29D70863ee13542241ab4263A272289FD6E5F625' as Address,
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as Address,
    v3Initializer: '0xEB6E6Cd5858a87908B2914AE9CC7bbBE91e70067' as Address,
    universalRouter: '0x492e6456d9528771018deb9e87ef7750ef184104' as Address,
    v4Quoter: '0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba' as Address,
    stateView: '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as Address,
  },
  // base
  8453: {
    poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b' as Address,
    dopplerDeployer: '0x5CadB034267751a364dDD4d321C99E07A307f915' as Address,
    v4Initializer: '0x77EbfBAE15AD200758E9E2E61597c0B07d731254' as Address,
    airlock: '0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12' as Address,
    tokenFactory: '0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45' as Address,
    v3Initializer: '0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5' as Address,
    governanceFactory: '0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9' as Address,
    noOpGovernanceFactory: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    migrator: '0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731' as Address,
    universalRouter: '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address,
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71' as Address,
    v4Quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d' as Address,
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
    v4Initializer: '0xC99b485499f78995C6F1640dbB1413c57f8BA684' as Address,
    v4Quoter: '0x3972c00f7ed4885e145823eb7c655375d275a1c5' as Address,
    stateView: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990' as Address,
    universalRouter: '0x112908dac86e20e7241b0927479ea3bf935d1fa0' as Address,
  },
};
