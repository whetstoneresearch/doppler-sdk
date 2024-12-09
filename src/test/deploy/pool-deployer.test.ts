import { Hex, parseEther } from 'viem';
import { beforeAll, describe, expect, it } from 'vitest';
import { setupTestEnvironment } from './setup';
import { Drift } from '@delvtech/drift';
import { viemAdapter, ViemReadWriteAdapter } from '@delvtech/drift-viem';
import { ReadDoppler } from '@/entities/doppler';
import { buildConfig, ReadWriteFactory } from '@/entities/factory';
import { DopplerPreDeploymentConfig } from '@/types';

describe('Doppler Pool Deployment', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment();
  });

  it('should deploy a new Doppler pool', async () => {
    const {
      clients: { publicClient, walletClient },
      addresses,
    } = testEnv;
    if (!publicClient || !walletClient || !walletClient.account) {
      throw new Error('Test client not found');
    }

    const drift = new Drift({
      adapter: viemAdapter({
        publicClient,
        walletClient,
      }),
    });

    const { timestamp } = await publicClient.getBlock();
    const configParams: DopplerPreDeploymentConfig = {
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

    const readWriteFactory = new ReadWriteFactory(addresses.airlock, drift);
    const config = buildConfig(configParams, addresses);
    const tx = await readWriteFactory.airlock.simulateWrite('create', config, {
      account: walletClient.account,
    });
    console.log('tx', tx);
    try {
      const txHash = await readWriteFactory.create(config);
    } catch (e) {
      console.log(e);
    }

    const doppler = new ReadDoppler(
      config.poolKey.currency1,
      addresses.stateView,
      drift
    );

    const poolId = await doppler.getPoolId();

    expect(poolId).toBeDefined();
  });
});
