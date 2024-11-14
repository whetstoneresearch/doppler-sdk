import { Address, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { DopplerSDK } from '../DopplerSDK';

// Test accounts from anvil
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
// const TEST_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

export async function setupTestEnvironment() {
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http('http://127.0.0.1:8545'),
  });

  const walletClient = createWalletClient({
    account: privateKeyToAccount(TEST_PRIVATE_KEY),
    chain: foundry,
    transport: http('http://127.0.0.1:8545'),
  });

  // Deploy your contracts here and get their addresses
  // You'll need to deploy: poolManager, airlock, tokenFactory, etc.
  const addresses = {
    airlock: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Address,
    tokenFactory: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Address,
    dopplerFactory: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' as Address,
    governanceFactory: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as Address,
    migrator: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as Address,
    poolManager: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
    stateView: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Address,
  };

  const sdk = new DopplerSDK(
    { public: publicClient, wallet: walletClient },
    {
      addresses,
    }
  );

  return {
    sdk,
    publicClient,
    walletClient,
    addresses,
  };
}
