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
    airlock: '0x0d2f38d807bfAd5C18e430516e10ab560D300caF' as Address,
    tokenFactory: '0x4B0EC16Eb40318Ca5A4346f20F04A2285C19675B' as Address,
    dopplerDeployer: '0x40Bcb4dDA3BcF7dba30C5d10c31EE2791ed9ddCa' as Address,
    v4Initializer: '0xA36715dA46Ddf4A769f3290f49AF58bF8132ED8E' as Address,
    v3Initializer: '0x1b8F12484422583FED5694469f94C7839a823980' as Address,
    governanceFactory: '0x65dE470Da664A5be139A5D812bE5FDa0d76CC951' as Address,
    noOpGovernanceFactory: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    migrator: '0xC541FBddfEEf798E50d257495D08efe00329109A' as Address,
    streamableFeesLocker: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    universalRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D' as Address,
    stateView: '0xc199F1072a74D4e905ABa1A84d9a45E2546B6222' as Address,
    v4Quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
    bundler: '0x7E5D336A6E9e453c9f02E5102CC039E015Fd8fb8' as Address,
    lens: '0x31703C016F32aC47aB71B3160b3579EcE05a5E5d' as Address,
  },
  // base sepolia
  84532: {
    airlock: '0x3411306Ce66c9469BFF1535BA955503c4Bde1C6e' as Address,
    tokenFactory: '0xc69Ba223c617F7D936B3cf2012aa644815dBE9Ff' as Address,
    governanceFactory: '0x9dBFaaDC8c0cB2c34bA698DD9426555336992e20' as Address,
    noOpGovernanceFactory: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    migrator: '0x04a898f3722c38F9Def707bD17DC78920EFA977C' as Address,
    streamableFeesLocker: '0x4dA7d7a8034510c0FFd38a9252237AE8DbA3Cb61' as Address,
    dopplerDeployer: '0x4Bf819DfA4066Bd7c9f21eA3dB911Bd8C10Cb3ca' as Address,
    v4Initializer: '0xca2079706A4c2a4a1aA637dFB47d7f27Fe58653F' as Address,
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as Address,
    v3Initializer: '0x4C3062B9ccFdbCB10353F57C1B59a29d4c5CFa47' as Address,
    universalRouter: '0x492e6456d9528771018deb9e87ef7750ef184104' as Address,
    v4Quoter: '0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba' as Address,
    stateView: '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as Address,
    bundler: '0xab7BACB0d5C2C10152f92D34e07F530EB3CB0Fb1' as Address,
    lens: '0x4a8d81Db741248a36D9eb3bc6eF648Bf798B47a7' as Address,
    v4MigratorHook: '0x189ef4D1f328b5D76Df78c5409A72e1e8d1C2000' as Address,
    v4Migrator: '0x03430453206Ab11F78C2D5F8aa2c18cb6cF1DDe7' as Address,
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
    streamableFeesLocker: '0x0000000000000000000000000000000000000000' as Address, // TODO: Deploy and update
    universalRouter: '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address,
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71' as Address,
    v4Quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d' as Address,
    bundler: '0x136191B46478cAB023cbC01a36160C4Aad81677a' as Address,
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
