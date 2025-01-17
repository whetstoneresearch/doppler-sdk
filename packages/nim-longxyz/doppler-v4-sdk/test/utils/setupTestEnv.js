import { randomBytes } from 'crypto';
import { createPublicClient, createTestClient, createWalletClient, http, parseEther, } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { DeployDopplerFactoryABI, DeployDopplerFactoryDeployedBytecode, } from '../abis/DeployDopplerFactoryABI';
export async function setupTestEnvironment() {
    const privateKey = `0x${randomBytes(32).toString('hex')}`;
    const deploymentFactoryAddress = `0x${randomBytes(20).toString('hex')}`;
    const publicClient = createPublicClient({
        chain: foundry,
        transport: http(),
    });
    const walletClient = createWalletClient({
        account: privateKeyToAccount(privateKey),
        chain: foundry,
        transport: http(),
    });
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
    // TODO: Fix this
    const addresses = {
        airlock: contractAddresses[0],
        tokenFactory: contractAddresses[1],
        dopplerFactory: contractAddresses[2],
        governanceFactory: contractAddresses[3],
        migrator: contractAddresses[4],
        poolManager: contractAddresses[5],
        stateView: contractAddresses[6],
        customRouter: contractAddresses[7],
        uniswapV4Initializer: contractAddresses[7],
        liquidityMigrator: contractAddresses[7],
        quoter: contractAddresses[7],
    };
    return {
        clients: { publicClient, walletClient, testClient },
        addresses,
    };
}
//# sourceMappingURL=setupTestEnv.js.map