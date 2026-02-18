import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import type { Address } from 'viem';
import * as addressesModule from '../../../src/addresses';
import { DopplerSDK } from '../../../src/DopplerSDK';
import { createMockPublicClient } from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';

const getAddressesSpy = vi.spyOn(addressesModule, 'getAddresses');
const mockInitializerAddress =
  '0x8888888888888888888888888888888888888888' as Address;

const chainId = addressesModule.CHAIN_IDS.BASE;

describe('DopplerSDK opening auction lifecycle helpers', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    getAddressesSpy.mockReset();
  });

  afterAll(() => {
    getAddressesSpy.mockRestore();
  });

  it('resolves the configured initializer instance', async () => {
    const chainAddresses = {
      ...mockAddresses,
      openingAuctionInitializer: mockInitializerAddress,
    };
    getAddressesSpy.mockReturnValue(chainAddresses);

    const sdk = new DopplerSDK({ publicClient, chainId });

    const lifecycle = await sdk.getOpeningAuctionLifecycle();

    expect(lifecycle.getAddress()).toBe(mockInitializerAddress);
    expect(getAddressesSpy).toHaveBeenCalledWith(chainId);
  });

  it('throws when the chain lacks an initializer address', async () => {
    getAddressesSpy.mockReturnValue(mockAddresses);
    const sdk = new DopplerSDK({ publicClient, chainId });

    await expect(sdk.getOpeningAuctionLifecycle()).rejects.toThrow(
      'OpeningAuctionInitializer address is not configured on this chain. ' +
        'Pass initializerAddress to getOpeningAuctionLifecycle(), or override it via builder.withOpeningAuctionInitializer().',
    );
  });

  it('accepts an explicit address override', async () => {
    getAddressesSpy.mockReturnValue(mockAddresses);
    const sdk = new DopplerSDK({ publicClient, chainId });

    const lifecycle = await sdk.getOpeningAuctionLifecycle(mockInitializerAddress);

    expect(lifecycle.getAddress()).toBe(mockInitializerAddress);
  });
});

