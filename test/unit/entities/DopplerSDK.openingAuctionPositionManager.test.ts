import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import type { Address } from 'viem';
import * as addressesModule from '../../../src/addresses';
import { DopplerSDK } from '../../../src/DopplerSDK';
import { createMockPublicClient } from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';

const getAddressesSpy = vi.spyOn(addressesModule, 'getAddresses');
const mockPositionManagerAddress = '0x9999999999999999999999999999999999999999' as Address;

const chainId = addressesModule.CHAIN_IDS.BASE;

describe('DopplerSDK opening auction helpers', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    getAddressesSpy.mockReset();
  });

  afterAll(() => {
    getAddressesSpy.mockRestore();
  });

  it('resolves the configured position manager instance', async () => {
    const chainAddresses = {
      ...mockAddresses,
      openingAuctionPositionManager: mockPositionManagerAddress,
    };
    getAddressesSpy.mockReturnValue(chainAddresses);

    const sdk = new DopplerSDK({ publicClient, chainId });

    const manager = await sdk.getOpeningAuctionPositionManager();

    expect(manager.getAddress()).toBe(mockPositionManagerAddress);
    expect(getAddressesSpy).toHaveBeenCalledWith(chainId);
  });

  it('throws when the chain lacks a position manager address', async () => {
    getAddressesSpy.mockReturnValue(mockAddresses);
    const sdk = new DopplerSDK({ publicClient, chainId });

    await expect(sdk.getOpeningAuctionPositionManager()).rejects.toThrow(
      'OpeningAuctionPositionManager address is not configured on this chain. ' +
        'Pass positionManagerAddress to getOpeningAuctionPositionManager(), or resolve it from the initializer via OpeningAuctionLifecycle.getPositionManager().',
    );
  });

  it('accepts an explicit address override', async () => {
    getAddressesSpy.mockReturnValue(mockAddresses);
    const sdk = new DopplerSDK({ publicClient, chainId });

    const manager = await sdk.getOpeningAuctionPositionManager(
      mockPositionManagerAddress,
    );

    expect(manager.getAddress()).toBe(mockPositionManagerAddress);
  });
});
