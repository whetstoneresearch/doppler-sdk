import { ReadWriteFactory, DOPPLER_V4_ADDRESSES } from 'doppler-v4-sdk';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  zeroAddress,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createDrift } from '@delvtech/drift';
import { viemAdapter } from '@delvtech/drift-viem';
import { Chain, WalletClient } from 'viem';

export function getDrift(chainId: Chain['id'], walletClient?: WalletClient) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  // @ts-expect-error - drift-viem is not typed correctly
  return createDrift({ adapter: viemAdapter({ publicClient, walletClient }) });
}

async function createBasicPool() {
  // Setup clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  // Replace with your private key
  const account = privateKeyToAccount('0x...');
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  // Create drift instance
  const drift = getDrift(base.id, walletClient);
  // Get contract addresses for Base
  const addresses = DOPPLER_V4_ADDRESSES[8453];

  // Initialize factory
  // @ts-expect-error - drift-viem is not typed correctly
  const factory = new ReadWriteFactory(addresses.airlock, drift);

  // Configure pool parameters
  const config = {
    name: 'Example Token',
    symbol: 'EXAMPLE',
    totalSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('600000000'),
    tokenURI: 'https://example.com/token-metadata.json',
    blockTimestamp: Math.floor(Date.now() / 1000),
    startTimeOffset: 3600, // Start in 1 hour
    duration: 1 / 4, // Quarter day duration
    epochLength: 200, // 200 seconds per epoch
    gamma: 800,
    tickRange: {
      startTick: 174_312,
      endTick: 186_840,
    },
    tickSpacing: 2,
    fee: 20_000, // 2%
    minProceeds: parseEther('2'),
    maxProceeds: parseEther('4'),
    yearlyMintRate: 0n,
    vestingDuration: BigInt(24 * 60 * 60 * 365), // 1 year
    recipients: [account.address],
    amounts: [parseEther('50000000')],
    numPdSlugs: 15,
    integrator: zeroAddress, // your integrator address
  };

  try {
    // Build configuration
    const { createParams } = factory.buildConfig(config, addresses);

    // simulate the transaction to check it will succeed
    const simulation = await factory.simulateCreate(createParams);

    // Execute pool creation
    const txHash = await factory.create(createParams);
    console.log(`Pool created successfully! Transaction hash: ${txHash}`);
  } catch (error) {
    console.error('Failed to create pool:', error);
  }
}

// Run the example
createBasicPool().catch(console.error);
