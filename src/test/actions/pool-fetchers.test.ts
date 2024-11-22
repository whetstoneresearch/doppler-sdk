import { parseEther } from 'viem';
import { beforeAll, describe, expect, it } from 'vitest';
import { DopplerConfigBuilder } from '../../actions/deploy/configBuilder';
import {
  deployDoppler,
  DopplerConfigParams,
} from '../../actions/deploy/deployDoppler';
import { DopplerAddressProvider } from '../../AddressProvider';
import { Clients } from '../../DopplerSDK';
import { Doppler } from '../../entities/Doppler/Doppler';
import { setupTestEnvironment } from '../utils/setupTestEnv';
import { fetchDopplerState } from '../../fetch/doppler/DopplerState';

describe('Doppler Pool Deployment', () => {
  let clients: Clients;
  let addressProvider: DopplerAddressProvider;
  let doppler: Doppler;

  beforeAll(async () => {
    const {
      clients: testClients,
      addressProvider: testAddressProvider,
    } = await setupTestEnvironment();
    clients = testClients;
    addressProvider = testAddressProvider;
    if (
      !clients.testClient ||
      !clients.walletClient ||
      !clients.walletClient.chain
    ) {
      throw new Error('Test client not found');
    }

    const { timestamp } = await clients.publicClient.getBlock();
    const configParams: DopplerConfigParams = {
      name: 'Gud Coin',
      symbol: 'GUD',
      totalSupply: parseEther('1000'),
      numTokensToSell: parseEther('1000'),
      blockTimestamp: Number(timestamp),
      startTimeOffset: 1,
      duration: 3,
      epochLength: 1600,
      priceRange: {
        startPrice: 0.1,
        endPrice: 0.0001,
      },
      tickSpacing: 8,
      fee: 300,
      minProceeds: parseEther('100'),
      maxProceeds: parseEther('600'),
    };

    const config = DopplerConfigBuilder.buildConfig(
      configParams,
      clients.walletClient.chain.id,
      addressProvider
    );
    doppler = await deployDoppler(clients, addressProvider, config);
  });

  describe('Doppler Pool Fetchers', () => {
    describe('fetch values from newly initialized doppler pool', () => {
      it('distance from maxProceeds should equal maxProceeds', async () => {
        const { totalProceeds } = await fetchDopplerState(
          doppler.address,
          clients.publicClient
        );
        const maxProceeds = doppler.getProceedsDistanceFromMaximum();
        expect(maxProceeds - totalProceeds).toEqual(maxProceeds);
      });

      it('distance from minProceeds should equal minProceeds', async () => {
        const { totalProceeds } = await fetchDopplerState(
          doppler.address,
          clients.publicClient
        );
        const minProceeds = doppler.getProceedsDistanceFromMinimum();
        expect(minProceeds - totalProceeds).toEqual(minProceeds);
      });

      it('time remaining', async () => {
        const timeRemaining = doppler.getTimeRemaining();
        expect(timeRemaining).toBeGreaterThanOrEqual(0);
      });

      it('epochs remaining', async () => {
        const epochsRemaining = doppler.getEpochsRemaining();
        expect(epochsRemaining).toBeGreaterThanOrEqual(0);
      });
    });

    describe('doppler pool with asset tokens purchased', () => {
      it('distance from maxProceeds should be less than maxProceeds', async () => {
        const { totalProceeds } = await fetchDopplerState(
          doppler.address,
          clients.publicClient
        );
        const maxProceeds = doppler.getProceedsDistanceFromMaximum();
        expect(maxProceeds - totalProceeds).toEqual(maxProceeds);
      });

      it('distance from minProceeds should equal minProceeds', async () => {
        const { totalProceeds } = await fetchDopplerState(
          doppler.address,
          clients.publicClient
        );
        const minProceeds = doppler.getProceedsDistanceFromMinimum();
        expect(minProceeds - totalProceeds).toEqual(minProceeds);
      });
    });
  });
});
