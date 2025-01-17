import { Address } from 'viem';
import { DopplerV3Addresses } from './types';

export const DOPPLER_V3_ADDRESSES: { [chainId: number]: DopplerV3Addresses } = {
  // unichain sepolia
  1301: {
    airlock: '0x3d067F7091c9743De932CcD808Ee3D01C51F881F' as Address,
    tokenFactory: '0x8993Cbb0b951ca1472DC09112B9a726aC088b50f' as Address,
    v3Initializer: '0x5Cf5D175bC74319d4AF42f3026aF6446901559a7' as Address,
    governanceFactory: '0xD7Bd7A6C5847536486C262c9a47C2903ec41d978' as Address,
    liquidityMigrator: '0x106dA038525f8D5DA14e8E9094CF2235221659fB' as Address,
    onchainRouter: '0x9Ec3227C59D3a9052930c9C310f65EC2D42fFbd2' as Address,
  },
};
