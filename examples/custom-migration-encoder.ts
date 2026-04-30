import './env';

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  DopplerSDK,
  DopplerFactory,
  type MigrationEncoder,
  type MigrationConfig,
} from '../src/evm';

/**
 * Example: Using a custom migration encoder with DopplerFactory
 *
 * This example shows how to provide a custom migration data encoder
 * using the fluent .withCustomMigrationEncoder() method. The custom
 * encoder can handle specialized migration logic for supported migration types.
 */

// Create a custom migration encoder
const customMigrationEncoder: MigrationEncoder = (config: MigrationConfig) => {
  switch (config.type) {
    case 'uniswapV2':
      // Custom V2 encoding - perhaps with additional metadata
      console.log('Custom V2 encoding with additional metadata');
      return encodeAbiParameters([{ type: 'string' }], ['custom-v2-metadata']);

    case 'uniswapV4':
      // Custom V4 encoding - perhaps with different beneficiary format
      console.log('Custom V4 encoding with specialized beneficiary handling');

      // Custom logic here - this is just an example
      const customData = encodeAbiParameters(
        [{ type: 'uint24' }, { type: 'int24' }, { type: 'string' }],
        [config.fee, config.tickSpacing, 'custom-v4-migration'],
      );

      return customData;

    case 'uniswapV2Split':
    case 'uniswapV4Split':
    case 'dopplerHook':
    case 'noOp':
      throw new Error(`This example encoder does not handle ${config.type}`);

    default:
      const exhaustive: never = config;
      throw new Error(`Unsupported migration type: ${exhaustive}`);
  }
};

async function main() {
  // Setup clients
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // Create SDK
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  });

  // Set custom migration encoder on the factory using fluent API
  sdk.factory.withCustomMigrationEncoder(customMigrationEncoder);

  // Example: Create auction params manually to demonstrate custom encoder
  const createParams = {
    token: {
      name: 'Custom Token',
      symbol: 'CUSTOM',
      tokenURI: 'https://example.com/token.json',
    },
    sale: {
      initialSupply: BigInt('1000000000000000000000000000'),
      numTokensToSell: BigInt('900000000000000000000000000'),
      numeraire: '0x4200000000000000000000000000000000000006' as `0x${string}`, // WETH on Base
    },
    pool: {
      startTick: -276400,
      endTick: -276200,
      fee: 10000,
    },
    governance: { type: 'default' as const },
    migration: {
      type: 'uniswapV4' as const,
      fee: 3000,
      tickSpacing: 60,
    },
    userAddress: account.address,
  };

  // The factory will now use your custom encoder for migration data
  const encodedParams =
    await sdk.factory.encodeCreateStaticAuctionParams(createParams);
  console.log(
    'Migration data encoded with custom encoder:',
    encodedParams.liquidityMigratorData,
  );

  console.log('SDK factory configured with custom migration encoder!');
}

// Example of a factory-only approach (without SDK)
function factoryOnlyExample() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // Create factory directly and configure with fluent API (method chaining)
  const factory = new DopplerFactory(
    publicClient,
    walletClient,
    baseSepolia.id,
  ).withCustomMigrationEncoder(customMigrationEncoder);

  console.log('DopplerFactory created with custom migration encoder!');
  return factory;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { customMigrationEncoder, main, factoryOnlyExample };
