/**
 * Example: TopUpDistributor top-ups for split migrators
 *
 * This example demonstrates:
 * - Building ETH and ERC20 top-up calldata on Base Sepolia by default
 * - Optionally simulating an ETH top-up with SIMULATE_TOP_UP=true
 * - Optionally broadcasting a top-up with EXECUTE_TOP_UP=true
 *
 * ERC20 top-ups require a prior token approval for the TopUpDistributor.
 */
import './env';

import { DopplerSDK, ZERO_ADDRESS } from '../src/evm';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const rpcUrl = process.env.RPC_URL || 'https://sepolia.base.org';
const shouldSimulate = process.env.SIMULATE_TOP_UP === 'true';
const shouldExecute = process.env.EXECUTE_TOP_UP === 'true';
const confirmedTopUp = process.env.CONFIRM_TOP_UP === 'true';
const demoAsset = '0x1111111111111111111111111111111111111111' as Address;
const demoNumeraire = '0x4200000000000000000000000000000000000006' as Address;

async function main() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  if (shouldExecute && !confirmedTopUp) {
    throw new Error('CONFIRM_TOP_UP=true is required when EXECUTE_TOP_UP=true');
  }

  const topUpAsset =
    shouldSimulate || shouldExecute
      ? (process.env.ASSET_ADDRESS as Address | undefined)
      : demoAsset;
  if ((shouldSimulate || shouldExecute) && !topUpAsset) {
    throw new Error(
      'ASSET_ADDRESS is required when SIMULATE_TOP_UP=true or EXECUTE_TOP_UP=true',
    );
  }

  const topUpAmount =
    shouldSimulate || shouldExecute ? process.env.TOP_UP_AMOUNT : '1';
  if ((shouldSimulate || shouldExecute) && !topUpAmount) {
    throw new Error(
      'TOP_UP_AMOUNT is required when SIMULATE_TOP_UP=true or EXECUTE_TOP_UP=true',
    );
  }

  const simulationAccount = shouldSimulate
    ? (process.env.USER_ADDRESS as Address | undefined)
    : undefined;
  if (shouldSimulate && !simulationAccount) {
    throw new Error('USER_ADDRESS is required when SIMULATE_TOP_UP=true');
  }

  const walletClient = shouldExecute
    ? (() => {
        const executionPrivateKey = process.env.PRIVATE_KEY as
          | `0x${string}`
          | undefined;
        if (!executionPrivateKey) {
          throw new Error('PRIVATE_KEY is required when EXECUTE_TOP_UP=true');
        }

        const account = privateKeyToAccount(executionPrivateKey);
        return createWalletClient({
          chain: baseSepolia,
          transport: http(rpcUrl),
          account,
        });
      })()
    : undefined;

  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  });

  const topUps = sdk.topUpDistributor;
  const asset = topUpAsset ?? demoAsset;
  const erc20Numeraire =
    (process.env.NUMERAIRE_ADDRESS as Address | undefined) ?? demoNumeraire;
  const amount = parseEther(topUpAmount ?? '1');

  const ethTopUp = {
    asset,
    numeraire: ZERO_ADDRESS,
    amount,
  };
  const erc20TopUp = {
    asset,
    numeraire: erc20Numeraire,
    amount,
  };

  console.log('TopUpDistributor:', topUps.getAddress());
  console.log(
    'Build-only calldata demo uses placeholder addresses unless SIMULATE_TOP_UP=true or EXECUTE_TOP_UP=true.',
  );
  console.log('ETH top-up tx:', topUps.buildTopUpTransaction(ethTopUp));
  console.log('ERC20 top-up tx:', topUps.buildTopUpTransaction(erc20TopUp));
  console.log('ERC20 top-ups require prior approval for:', topUps.getAddress());

  if (shouldSimulate) {
    const simulation = await topUps.simulateTopUp(ethTopUp, simulationAccount);
    console.log('Simulated ETH top-up request:', simulation.request);
  } else {
    console.log(
      'Set SIMULATE_TOP_UP=true and USER_ADDRESS to simulate the top-up.',
    );
  }

  if (shouldExecute) {
    const hash = await topUps.topUp(ethTopUp);
    console.log('Top-up transaction:', hash);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { main };
