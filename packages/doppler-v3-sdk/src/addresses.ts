import { Address } from 'viem';
import { DopplerAddresses } from './types';

export const DOPPLER_ADDRESSES: { [chainId: number]: DopplerAddresses } = {
  // unichain sepolia
  1301: {
    airlock: '0x2f29F5B6BCFDda207682b632711Df8614AA08e43' as Address,
    tokenFactory: '0x958cbF326758561F87F7e722DE8A95E20420eC1f' as Address,
    v3Initializer: '0x506CA58dF7b744F0ee8Ee5621ebc9e882b933184' as Address,
    governanceFactory: '0x409017562C626C0eD51d41E2931C34190934A689' as Address,
    liquidityMigrator: '0xa2EAf97FB9EF2A0dA09d4531B4725b0C388B043d' as Address,
  },
};
