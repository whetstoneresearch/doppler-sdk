import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';
import * as addressesModule from '../../../../src/evm/addresses';
import { DopplerSDK } from '../../../../src/evm/DopplerSDK';
import { ZERO_ADDRESS } from '../../../../src/evm/constants';
import { createMockPublicClient } from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';

const getAddressesSpy = vi.spyOn(addressesModule, 'getAddresses');
const chainId = addressesModule.CHAIN_IDS.BASE;
const overrideTopUpDistributor =
  '0x9999999999999999999999999999999999999999' as Address;

describe('DopplerSDK TopUpDistributor helpers', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    getAddressesSpy.mockReset();
  });

  afterAll(() => {
    getAddressesSpy.mockRestore();
  });

  it('caches the configured distributor instance', () => {
    getAddressesSpy.mockReturnValue(mockAddresses);
    const sdk = new DopplerSDK({ publicClient, chainId });

    const first = sdk.topUpDistributor;
    const second = sdk.topUpDistributor;

    expect(first).toBe(second);
    expect(first.getAddress()).toBe(mockAddresses.topUpDistributor);
    expect(getAddressesSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts an explicit distributor address override', () => {
    getAddressesSpy.mockReturnValue(mockAddresses);
    const sdk = new DopplerSDK({ publicClient, chainId });

    const topUpDistributor = sdk.getTopUpDistributor(overrideTopUpDistributor);

    expect(topUpDistributor.getAddress()).toBe(overrideTopUpDistributor);
  });

  it('throws when no distributor address is configured', () => {
    getAddressesSpy.mockReturnValue({
      ...mockAddresses,
      topUpDistributor: undefined,
    });
    const sdk = new DopplerSDK({ publicClient, chainId });

    expect(() => sdk.getTopUpDistributor()).toThrow(
      'TopUpDistributor address is not configured on this chain. ' +
        'Pass topUpDistributorAddress to getTopUpDistributor().',
    );
  });

  it('throws when the configured distributor address is zero', () => {
    getAddressesSpy.mockReturnValue({
      ...mockAddresses,
      topUpDistributor: ZERO_ADDRESS,
    });
    const sdk = new DopplerSDK({ publicClient, chainId });

    expect(() => sdk.getTopUpDistributor()).toThrow(
      'TopUpDistributor address is not configured on this chain. ' +
        'Pass topUpDistributorAddress to getTopUpDistributor().',
    );
  });
});
