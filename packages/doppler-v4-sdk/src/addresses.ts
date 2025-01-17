import { Address } from 'viem';
import { DopplerV4Addresses } from './types';

export const DOPPLER_V4_ADDRESSES: { [chainId: number]: DopplerV4Addresses } = {
  // unichain sepolia
  1301: {
    poolManager: '0xC81462Fec8B23319F288047f8A03A57682a35C1A' as Address,
    airlock: '0x3d067F7091c9743De932CcD808Ee3D01C51F881F' as Address,
    tokenFactory: '0x8993Cbb0b951ca1472DC09112B9a726aC088b50f' as Address,
    dopplerDeployer: '0xDf5273653c0e9799226d6a2D890d79754A4D36AB' as Address,
    v4Initializer: '0x8aB8D2d0648Bf1DFeD438540F46eaD7542820BeB' as Address,
    v3Initializer: '0x5Cf5D175bC74319d4AF42f3026aF6446901559a7' as Address,
    governanceFactory: '0xD7Bd7A6C5847536486C262c9a47C2903ec41d978' as Address,
    migrator: '0x106dA038525f8D5DA14e8E9094CF2235221659fB' as Address,
    stateView: '0xdE04C804dc75E90D8a64e5589092a1D6692EFA45' as Address,
    quoter: '0xfe6Cf50c4cfe801dd2AEf9c1B3ce24f551944df8' as Address,
    customRouter: '0x41B9bd894A2e2C0B10832E5Af0f9cEafe444fc0e' as Address,
    uniRouter: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C' as Address,
  },
};
