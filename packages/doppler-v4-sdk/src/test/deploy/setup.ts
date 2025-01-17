import { randomBytes } from 'crypto';
import {
  Address,
  createTestClient,
  createWalletClient,
  Hex,
  http,
  parseEther,
  publicActions,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, unichainSepolia } from 'viem/chains';
import { Clients, DopplerV4Addresses } from '../../types';
import {
  DeployDopplerFactoryABI,
  DeployDopplerFactoryDeployedBytecode,
} from '../abis/DeployDopplerFactoryABI';
import { airlockAbi } from '../../abis';

interface TestEnvironment {
  clients: Clients;
  addresses: DopplerV4Addresses;
}

const rpc = 'http://localhost:8545';

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const privateKey = `0x${randomBytes(32).toString('hex')}` as Hex;
  const deploymentFactoryAddress = `0x${randomBytes(20).toString(
    'hex'
  )}` as Address;

  const publicClient = createTestClient({
    chain: unichainSepolia,
    mode: 'anvil',
    transport: http(rpc),
  }).extend(publicActions);

  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: unichainSepolia,
    transport: http(rpc),
  });

  const testClient = createTestClient({
    chain: unichainSepolia,
    mode: 'anvil',
    transport: http(rpc),
  });

  await testClient.setBalance({
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
    functionName: 'deploy',
    account: walletClient.account,
  });

  await publicClient.waitForTransactionReceipt({
    hash: deployContractsHash,
  });

  const {
    airlock,
    tokenFactory,
    dopplerDeployer,
    uniswapV4Initializer,
    uniswapV3Initializer,
    governanceFactory,
    uniswapV2LiquidityMigrator,
    customRouter2,
    manager,
    quoter,
    stateView,
    uniRouter,
  } = await publicClient.readContract({
    abi: DeployDopplerFactoryABI,
    address: deploymentFactoryAddress,
    functionName: 'getAddrs',
  });

  // Deploy your contracts here and get their addresses
  // You'll need to deploy: poolManager, airlock, tokenFactory, etc.
  const addresses = {
    airlock,
    tokenFactory,
    dopplerDeployer,
    v4Initializer: uniswapV4Initializer,
    v3Initializer: uniswapV3Initializer,
    governanceFactory,
    migrator: uniswapV2LiquidityMigrator,
    customRouter: customRouter2,
    poolManager: manager,
    quoter,
    stateView,
    uniRouter,
  };

  await testClient.mine({
    blocks: 1,
  });

  const tfModuleState = await publicClient.readContract({
    abi: airlockAbi,
    address: airlock,
    functionName: 'getModuleState',
    args: [tokenFactory],
  });

  const v3piModuleState = await publicClient.readContract({
    abi: airlockAbi,
    address: airlock,
    functionName: 'getModuleState',
    args: [uniswapV3Initializer],
  });

  const v4piModuleState = await publicClient.readContract({
    abi: airlockAbi,
    address: airlock,
    functionName: 'getModuleState',
    args: [uniswapV4Initializer],
  });

  const gfModuleState = await publicClient.readContract({
    abi: airlockAbi,
    address: airlock,
    functionName: 'getModuleState',
    args: [governanceFactory],
  });

  const migratorModuleState = await publicClient.readContract({
    abi: airlockAbi,
    address: airlock,
    functionName: 'getModuleState',
    args: [uniswapV2LiquidityMigrator],
  });

  console.log('tfModuleState', tfModuleState, tokenFactory);
  console.log('v3piModuleState', v3piModuleState, uniswapV3Initializer);
  console.log('v4piModuleState', v4piModuleState, uniswapV4Initializer);
  console.log('gfModuleState', gfModuleState, governanceFactory);
  console.log(
    'migratorModuleState',
    migratorModuleState,
    uniswapV2LiquidityMigrator
  );

  return {
    clients: { publicClient, walletClient, testClient },
    addresses,
  };
}
