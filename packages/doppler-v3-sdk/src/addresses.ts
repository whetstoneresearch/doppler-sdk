import { Address, zeroAddress } from "viem";
import { DopplerV3Addresses } from "./types";

export const DOPPLER_V3_ADDRESSES: { [chainId: number]: DopplerV3Addresses } = {
  // unichain sepolia
  1301: {
    airlock: "0x651ab94B4777e2e4cdf96082d90C65bd947b73A4" as Address,
    tokenFactory: "0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA" as Address,
    v3Initializer: "0x7Fb9a622186B4660A5988C223ebb9d3690dD5007" as Address,
    governanceFactory: "0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC" as Address,
    liquidityMigrator: "0x44C448E38A2C3D206c9132E7f645510dFbBC946b" as Address,
    universalRouter: "0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D" as Address,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    quoterV2: "0x6Dd37329A1A225a6Fca658265D460423DCafBF89" as Address,
    univ2Router02: "0x284f11109359a7e1306c3e447ef14d38400063ff" as Address,
  },
  // unichain
  130: {
    airlock: "0x77EbfBAE15AD200758E9E2E61597c0B07d731254" as Address,
    tokenFactory: "0x43d0D97EC9241A8F05A264f94B82A1d2E600f2B3" as Address,
    v3Initializer: "0x9F4e56be80f08ba1A2445645EFa6d231E27b43ec" as Address,
    governanceFactory: "0x99C94B9Df930E1E21a4E4a2c105dBff21bF5c5aE" as Address,
    liquidityMigrator: "0xf6023127f6E937091D5B605680056A6D27524bad" as Address,
    universalRouter: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3" as Address,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    quoterV2: "0x385A5cf5F83e99f7BB2852b6A19C3538b9FA7658" as Address,
    univ2Router02: "0x284f11109359a7e1306c3e447ef14d38400063ff" as Address,
  },
};
