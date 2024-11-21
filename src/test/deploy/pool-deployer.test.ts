import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment } from './setup';
import { parseEther } from 'viem';
import { DopplerConfigParams } from '../../PoolDeployer';
import { DopplerConfigBuilder } from '../../utils';
import { fetchPositionState } from '../../fetch/PositionState';

describe('Doppler Pool Deployment', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment();
  });

  it('should deploy a new Doppler pool', async () => {
    const { sdk, addressProvider, clients } = testEnv;

    if (!clients.test || !clients.wallet) {
      throw new Error('Test client not found');
    }

    const { timestamp } = await clients.public.getBlock();
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
      addressProvider
    );

    const startingTime = configParams.blockTimestamp;
    await clients.test.setNextBlockTimestamp({ timestamp: BigInt(startingTime + 1) });
    await clients.test.mine({ blocks: 1 });


    const { pool } = await sdk.deployer.deploy(config);
    expect(pool.doppler.address).toBeDefined();
    expect(pool.doppler.deploymentTx).toBeDefined();

    const slugs = await fetchPositionState(
      pool.doppler.address,
      clients.public
    );

    expect(slugs[0].liquidity).toEqual(BigInt(0));
    expect(slugs[1].liquidity).toBeGreaterThan(BigInt(0));
    expect(slugs[2].liquidity).toBeGreaterThan(BigInt(0));
  });
});
