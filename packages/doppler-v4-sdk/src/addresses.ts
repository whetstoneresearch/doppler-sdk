import { Address } from 'viem';
import { DopplerV4Addresses } from './types';

export const DOPPLER_V4_ADDRESSES: { [chainId: number]: DopplerV4Addresses } = {
  // unichain sepolia
  1301: {
    poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
    airlock: '0x651ab94B4777e2e4cdf96082d90C65bd947b73A4' as Address,
    tokenFactory: '0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA' as Address,
    dopplerDeployer: '0x8350cAd81149A9944c2fb4276955FaAA7D61e836' as Address,
    v4Initializer: '0x992375478626E67F4e639d3298EbCAaE51C3dF0b' as Address,
    v3Initializer: '0x7Fb9a622186B4660A5988C223ebb9d3690dD5007' as Address,
    governanceFactory: '0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC' as Address,
    migrator: '0x44C448E38A2C3D206c9132E7f645510dFbBC946b' as Address,
    universalRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D' as Address,
    stateView: '0xc199F1072a74D4e905ABa1A84d9a45E2546B6222' as Address,
    v4Quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  },
  84532: {
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as Address,
    airlock: '0x5Be5B41Cf8Feeba9d8Bf08Fe957b8a5c68aaA155' as Address,
    tokenFactory: '0x820DC6BC3e8Fa2d60771EfE78E8fC276FE760223' as Address,
    dopplerDeployer: '0xd531fD0E8612e820e624C1B7CB11326bCe2b6C8B' as Address,
    governanceFactory: '0x2Ef4369695CA568fB0CC76605C430149Ca297629' as Address,
    v4Initializer: '0x7dC6ced696831EE721d8B400FBc633b1Fe8E63fC' as Address,
    migrator: '0x5069dbeBdc7ff55df3cBb2F9E82c4D8F64570589' as Address,
    v3Initializer: '0x9581Fd5De3ECe5675136b4f9091BEA1beD0Fc27C' as Address,
    universalRouter: '0x492e6456d9528771018deb9e87ef7750ef184104' as Address,
    stateView: '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as Address,
    v4Quoter: '0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba' as Address,
  },
  8453: {
    poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b' as Address,
    dopplerDeployer: '0x8b4C7DB9121FC885689C0A50D5a1429F15AEc2a0' as Address,
    v4Initializer: '0xC99b485499f78995C6F1640dbB1413c57f8BA684' as Address,
    airlock: '0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12' as Address,
    tokenFactory: '0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45' as Address,
    v3Initializer: '0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5' as Address,
    governanceFactory: '0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9' as Address,
    migrator: '0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731' as Address,
    universalRouter: '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address,
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71' as Address,
    v4Quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d' as Address,
  },
};
