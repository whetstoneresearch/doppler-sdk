import { describe, expect, it } from 'vitest';
import { isAddress, type Address, zeroAddress } from 'viem';
import { ADDRESSES, CHAIN_IDS, getAddresses } from '../../../src/evm/addresses';
import { GENERATED_DOPPLER_DEPLOYMENTS } from '../../../src/evm/deployments.generated';

const dopplerERC20V1TargetChains = [
  { name: 'mainnet', chainId: CHAIN_IDS.MAINNET },
  { name: 'base', chainId: CHAIN_IDS.BASE },
  { name: 'base-sepolia', chainId: CHAIN_IDS.BASE_SEPOLIA },
  { name: 'temp', chainId: CHAIN_IDS.TEMP },
  { name: 'monad-mainnet', chainId: CHAIN_IDS.MONAD_MAINNET },
] as const;

function expectConfiguredAddress(address: Address | undefined): Address {
  expect(address).toBeDefined();
  if (!address) {
    throw new Error('Expected address to be configured');
  }
  expect(address).not.toBe(zeroAddress);
  expect(isAddress(address)).toBe(true);
  return address;
}

describe('address configuration', () => {
  it.each(dopplerERC20V1TargetChains)(
    'returns generated DopplerERC20V1 addresses for $name',
    ({ chainId }) => {
      const addresses = getAddresses(chainId);
      const generated = GENERATED_DOPPLER_DEPLOYMENTS[chainId];

      const factory = expectConfiguredAddress(addresses.dopplerERC20V1Factory);
      const implementation = expectConfiguredAddress(
        addresses.dopplerERC20V1Implementation,
      );

      expect(factory).toBe(generated.DopplerERC20V1Factory);
      expect(implementation).toBe(generated.DopplerERC20V1);
      expect(ADDRESSES[chainId].dopplerERC20V1Factory).toBe(factory);
      expect(ADDRESSES[chainId].dopplerERC20V1Implementation).toBe(
        implementation,
      );
    },
  );
});
