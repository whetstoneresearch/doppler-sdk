import {
  Address,
  createTestClient,
  Hex,
  http,
  parseEther,
  publicActions,
  walletActions,
} from 'viem';
import { Clients, DopplerSDK } from '../../DopplerSDK';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  DeployDopplerFactoryABI,
  DeployDopplerFactoryDeployedBytecode,
} from '../abis/DeployDopplerFactoryABI';
import { randomBytes } from 'crypto';
import { DopplerAddressProvider } from '../../AddressProvider';
import { DopplerConfigBuilder } from '../../utils';
import { DopplerPool } from '../../entities';

interface TestEnvironment {
  sdk: DopplerSDK;
  clients: Clients;
  addressProvider: DopplerAddressProvider;
  pool: DopplerPool;
}

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const privateKey = `0x${randomBytes(32).toString('hex')}` as Hex;
  const deploymentFactoryAddress = `0x${randomBytes(20).toString(
    'hex'
  )}` as Address;

  const publicClient = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http(),
  }).extend(publicActions);

  const walletClient = createTestClient({
    account: privateKeyToAccount(privateKey),
    chain: foundry,
    mode: 'anvil',
    transport: http(),
  }).extend(walletActions);

  const testClient = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http(),
  });

  testClient.setBalance({
    address: privateKeyToAccount(privateKey).address,
    value: parseEther('1000000'),
  });

  testClient.setCode({
    address: deploymentFactoryAddress,
    bytecode: DeployDopplerFactoryDeployedBytecode,
  });

  const deployContractsHash = await walletClient.writeContract({
    abi: DeployDopplerFactoryABI,
    address: deploymentFactoryAddress,
    functionName: 'run',
    account: walletClient.account,
  });

  await publicClient.waitForTransactionReceipt({
    hash: deployContractsHash,
  });

  const contractAddresses = await publicClient.readContract({
    abi: DeployDopplerFactoryABI,
    address: deploymentFactoryAddress,
    functionName: 'getDeploymentAddresses',
  });

  // Deploy your contracts here and get their addresses
  // You'll need to deploy: poolManager, airlock, tokenFactory, etc.
  const addresses = {
    airlock: contractAddresses[0] as Address,
    tokenFactory: contractAddresses[1] as Address,
    dopplerFactory: contractAddresses[2] as Address,
    governanceFactory: contractAddresses[3] as Address,
    migrator: contractAddresses[4] as Address,
    poolManager: contractAddresses[5] as Address,
    stateView: contractAddresses[6] as Address,
    customRouter: contractAddresses[7] as Address,
  };
  const addressProvider = new DopplerAddressProvider(31337, addresses);

  const sdk = new DopplerSDK(
    { public: publicClient, wallet: walletClient },
    {
      addresses,
    }
  );

  const block = await publicClient.getBlock();
  const configParams = {
    name: 'Test Token',
    symbol: 'TEST',
    totalSupply: parseEther('1000'),
    numTokensToSell: parseEther('1000'),
    blockTimestamp: Number(block.timestamp),
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

  const config = DopplerConfigBuilder.buildConfig(configParams, addressProvider);
  const { pool } = await sdk.deployer.deploy(config);


  return {
    sdk,
    clients: { public: publicClient, wallet: walletClient, test: testClient },
    addressProvider,
    pool
  };
}
