/**
 * Example: Deploy Decay Multicurve on Base Mainnet
 *
 * This example is simulation-first and supports optional execution.
 *
 * Required env:
 * - PRIVATE_KEY
 * - RPC_URL (defaults to Base mainnet RPC)
 * - CONFIRM_BASE_MAINNET=true
 *
 * Optional env:
 * - EXECUTE_MAINNET=true (if omitted, the script only simulates)
 */
import './env';

import { DopplerSDK, WAD, getAddresses } from '../src';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const rpcUrl = process.env.RPC_URL ?? base.rpcUrls.default.http[0];
const confirmMainnet = process.env.CONFIRM_BASE_MAINNET === 'true';
const executeMainnet = process.env.EXECUTE_MAINNET === 'true';

if (!privateKey) throw new Error('PRIVATE_KEY is not set');
if (!confirmMainnet) {
  throw new Error(
    'Set CONFIRM_BASE_MAINNET=true to run this script on Base mainnet'
  );
}

async function main() {
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account,
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) {
    throw new Error(
      `Connected to chain ${chainId}, expected Base mainnet (${base.id})`
    );
  }

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id });
  const addresses = getAddresses(base.id);

  const decayInitializer = addresses.v4DecayMulticurveInitializer;
  if (!decayInitializer) {
    throw new Error(
      'Base mainnet decay initializer is not configured in SDK deployments'
    );
  }
  if (!addresses.v2Migrator) {
    throw new Error('Base mainnet v2Migrator is not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const symbolSuffix = String(timestamp).slice(-4);

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: `Base Mainnet Example ${timestamp}`,
      symbol: `BME${symbolSuffix}`,
      tokenURI: 'ipfs://base-mainnet-example.json',
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth,
    })
    .poolConfig({
      fee: 12_000, // terminal fee: 1.2%
      tickSpacing: 200,
      curves: [
        {
          tickLower: 0,
          tickUpper: 220_000,
          numPositions: 1,
          shares: parseEther('0.99'),
        },
        {
          tickLower: 220_000,
          tickUpper: 887_200,
          numPositions: 1,
          shares: parseEther('0.01'),
        },
      ],
    })
    .withDecay({
      startTime: timestamp + 60, // starts 1 minute after submission
      startFee: 800_000, // 80%
      durationSeconds: 3600, // 1 hour decay
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withV4DecayMulticurveInitializer(decayInitializer)
    .withUserAddress(account.address)
    .build();

  if (params.initializer?.type !== 'decay') {
    throw new Error('This Base mainnet script is decay-only');
  }

  console.log('Base mainnet decay multicurve deployment example');
  console.log('Account:', account.address);
  console.log('RPC:', rpcUrl);
  console.log(
    'Execute mainnet:',
    executeMainnet ? 'yes' : 'no (simulation only)'
  );
  console.log('Token:', `${params.token.name} (${params.token.symbol})`);
  console.log('Initial supply:', formatEther(params.sale.initialSupply));
  console.log('Tokens for sale:', formatEther(params.sale.numTokensToSell));
  console.log('Numeraire (WETH):', params.sale.numeraire);
  console.log('Decay initializer:', decayInitializer);
  console.log(
    'Decay schedule:',
    `${params.initializer?.type === 'decay' ? `${params.initializer.startFee} -> ${params.pool.fee} over ${params.initializer.durationSeconds}s` : 'n/a'}`
  );
  console.log();

  const simulation = await sdk.factory.simulateCreateMulticurve(params);
  console.log('Simulation result');
  console.log('Predicted token address:', simulation.tokenAddress);
  console.log('Predicted pool ID:', simulation.poolId);
  console.log('Estimated gas:', simulation.gasEstimate.toString());
  console.log();

  if (!executeMainnet) {
    console.log('Skipping execution. Set EXECUTE_MAINNET=true to broadcast.');
    return;
  }

  console.log('Broadcasting createMulticurve transaction on Base mainnet...');
  const result = await simulation.execute();

  console.log('Deployment complete');
  console.log('Transaction:', result.transactionHash);
  console.log('Token address:', result.tokenAddress);
  console.log('Pool ID:', result.poolId);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
