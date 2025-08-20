# Doppler SDK

A unified TypeScript SDK for interacting with the Doppler Protocol - enabling fair token launches through Dutch auction mechanisms on Uniswap.

## Overview

The Doppler SDK consolidates functionality from the previous `doppler-v3-sdk` and `doppler-v4-sdk` packages into a single, intuitive interface. It provides comprehensive support for creating and managing token auctions on Ethereum and EVM-compatible chains.

### Key Features

- **Static Auctions**: Fixed price range liquidity bootstrapping using Uniswap V3
- **Dynamic Auctions**: Gradual Dutch auctions using Uniswap V4 hooks
- **Flexible Migration**: Support for migrating to Uniswap V2, V3, or V4
- **Token Management**: Built-in support for DERC20 tokens with vesting
- **Type Safety**: Full TypeScript support with discriminated unions
- **Chain Support**: Works with Base, Unichain, Ink, and other EVM chains

## Installation

```bash
npm install @whetstone-research/doppler-sdk viem
# or
yarn add @whetstone-research/doppler-sdk viem
# or
pnpm add @whetstone-research/doppler-sdk viem
```

## Quick Start

```typescript
import { DopplerSDK } from '@whetstone-research/doppler-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

// Set up viem clients
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const walletClient = createWalletClient({
  chain: base,
  transport: http(),
  account: '0x...', // Your wallet address
});

// Initialize the SDK
const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: base.id,
});
```

## Creating Auctions

### Static Auction (Fixed Price Range)

Static auctions use Uniswap V3 pools with concentrated liquidity in a fixed price range. They're ideal for simple, predictable price discovery.

```typescript
const result = await sdk.factory.createStaticAuction({
  token: {
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
    totalSupply: parseEther('1000000000'), // 1 billion tokens
  },
  sale: {
    numTokensToSell: parseEther('900000000'), // Sell 900 million
    numeraire: '0x...', // WETH address
  },
  pool: {
    startTick: -92103, // ~0.0001 ETH per token
    endTick: -69080,   // ~0.001 ETH per token
    fee: 10000,        // 1%
    numPositions: 15,  // Number of liquidity positions
  },
  vesting: {
    duration: BigInt(365 * 24 * 60 * 60), // 1 year
    recipients: [
      { address: '0x...', amount: parseEther('50000000') }, // 50M tokens
      { address: '0x...', amount: parseEther('50000000') }, // 50M tokens
    ],
  },
  migration: {
    type: 'uniswapV2', // Migrate to V2 after auction
  },
  governance: {
    maxShareToBeSold: parseEther('0.35'), // 35% max
    yearlyMintRate: parseEther('0.02'),   // 2% annual
  },
  userAddress: '0x...', // Your address
});

console.log('Pool address:', result.poolAddress);
console.log('Token address:', result.tokenAddress);
```

### Dynamic Auction (Dutch Auction)

Dynamic auctions use Uniswap V4 hooks to implement gradual Dutch auctions where the price moves over time.

```typescript
const result = await sdk.factory.createDynamicAuction({
  token: {
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
    totalSupply: parseEther('1000000'), // 1M tokens
  },
  sale: {
    numTokensToSell: parseEther('900000'), // Sell 900k
    numeraire: '0x...', // WETH address
    minProceeds: parseEther('100'), // Min 100 ETH
    maxProceeds: parseEther('1000'), // Max 1000 ETH
  },
  auction: {
    duration: 7, // 7 days
    epochLength: 3600, // 1 hour epochs
    startTick: -92103, // ~0.0001 ETH per token
    endTick: -69080,   // ~0.01 ETH per token
    gamma: parseEther('0.998'), // Price decrease rate
    numPdSlugs: 5, // Price discovery slugs
  },
  pool: {
    fee: 3000,       // 0.3%
    tickSpacing: 60, // Standard for 0.3% pools
  },
  vesting: {
    duration: BigInt(365 * 24 * 60 * 60), // 1 year
    recipients: [
      { address: '0x...', amount: parseEther('50000') },
      { address: '0x...', amount: parseEther('50000') },
    ],
  },
  migration: {
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: {
      lockDuration: 365 * 24 * 60 * 60, // 1 year
      beneficiaries: [
        { address: '0x...', percentage: 5000 }, // 50%
        { address: '0x...', percentage: 5000 }, // 50%
      ],
    },
  },
  userAddress: '0x...',
});

console.log('Hook address:', result.hookAddress);
console.log('Token address:', result.tokenAddress);
```

### Builder Pattern (Recommended)

Prefer using the builders to construct `CreateStaticAuctionParams` and `CreateDynamicAuctionParams` fluently and safely. Builders apply sensible defaults and can compute ticks and gamma for you.

```typescript
import { StaticAuctionBuilder, DynamicAuctionBuilder } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'

// Dynamic auction via builder
const dynamicParams = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('500000'), numeraire: wethAddress })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByPriceRange({
    priceRange: { startPrice: 0.0001, endPrice: 0.001 },
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
  })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const dyn = await sdk.factory.createDynamicAuction(dynamicParams)

// Static auction via builder
const staticParams = new StaticAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000000'), numTokensToSell: parseEther('900000000'), numeraire: wethAddress })
  .poolByPriceRange({ priceRange: { startPrice: 0.0001, endPrice: 0.001 }, fee: 3000 })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const stat = await sdk.factory.createStaticAuction(staticParams)
```

### Simplified Creation with Defaults

The SDK intelligently applies defaults when parameters are omitted. Here are examples with minimal configuration:

```typescript
// Minimal static auction
const result = await sdk.factory.createStaticAuction({
  token: {
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
    // totalSupply defaults to 1 billion
  },
  sale: {
    // numTokensToSell defaults to 90% of total supply
    numeraire: '0x...', // WETH address (required)
  },
  pool: {
    // Defaults: fee=10000 (1%), numPositions=15
    // Start/end ticks calculated from reasonable price range
  },
  migration: {
    type: 'uniswapV2', // Required
  },
  userAddress: '0x...', // Required
});

// Minimal dynamic auction
const result = await sdk.factory.createDynamicAuction({
  token: {
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  },
  sale: {
    numeraire: '0x...', // WETH address
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
  },
  auction: {
    // Defaults: duration=7 days, epochLength=1 hour
    // gamma and numPdSlugs auto-calculated
  },
  pool: {
    // Defaults: fee=3000 (0.3%), tickSpacing=60
  },
  migration: {
    type: 'uniswapV4',
  },
  userAddress: '0x...',
});
```

## Interacting with Auctions

### Static Auction Interactions

```typescript
// Get a static auction instance
const auction = await sdk.getStaticAuction(poolAddress);

// Get pool information
const poolInfo = await auction.getPoolInfo();
console.log('Current price:', poolInfo.sqrtPriceX96);
console.log('Liquidity:', poolInfo.liquidity);

// Check if ready for migration
const hasGraduated = await auction.hasGraduated();

// Get current price
const price = await auction.getCurrentPrice();
```

### Dynamic Auction Interactions

```typescript
// Get a dynamic auction instance
const auction = await sdk.getDynamicAuction(hookAddress);

// Get comprehensive hook information
const hookInfo = await auction.getHookInfo();
console.log('Total proceeds:', hookInfo.state.totalProceeds);
console.log('Tokens sold:', hookInfo.state.totalTokensSold);

// Check auction status
const hasEndedEarly = await auction.hasEndedEarly();
const currentEpoch = await auction.getCurrentEpoch();
```

## Token Management

### DERC20 Tokens

The SDK includes full support for DERC20 tokens with vesting functionality:

```typescript
import { Derc20 } from '@whetstone-research/doppler-sdk';

const token = new Derc20(publicClient, walletClient, tokenAddress);

// Read token information
const name = await token.getName();
const symbol = await token.getSymbol();
const balance = await token.getBalanceOf(address);

// Vesting functionality
const vestingData = await token.getVestingData(address);
console.log('Total vested:', vestingData.totalAmount);
console.log('Released:', vestingData.releasedAmount);

// Release vested tokens
await token.release(amountToRelease);
```

### Native ETH

The SDK also provides an ETH wrapper with ERC20-like interface:

```typescript
import { Eth } from '@whetstone-research/doppler-sdk';

const eth = new Eth(publicClient, walletClient);
const balance = await eth.getBalanceOf(address);
```

## Price Quotes

Get price quotes across Uniswap V2, V3, and V4:

```typescript
const quoter = sdk.quoter;

// Quote on Uniswap V3
const quote = await quoter.quoteV3ExactInputSingle({
  tokenIn: tokenAddress,
  tokenOut: wethAddress,
  amountIn: parseEther('1000'),
  fee: 3000,
  sqrtPriceLimitX96: 0n,
});

console.log('Expected output:', quote.amountOut);
console.log('Price after swap:', quote.sqrtPriceX96After);
```

## Migration Configuration

The SDK supports flexible migration paths after auction completion:

### Migrate to Uniswap V2
```typescript
migration: {
  type: 'uniswapV2',
}
```

### Migrate to Uniswap V3
```typescript
migration: {
  type: 'uniswapV3',
  fee: 3000,        // 0.3%
  tickSpacing: 60,  // Standard for 0.3% pools
}
```

### Migrate to Uniswap V4
```typescript
migration: {
  type: 'uniswapV4',
  fee: 3000,
  tickSpacing: 60,
  streamableFees: {
    lockDuration: 365 * 24 * 60 * 60, // 1 year
    beneficiaries: [
      { address: '0x...', percentage: 10000 }, // 100%
    ],
  },
}
```

## Supported Chains

The SDK currently supports:
- Base (8453)
- Unichain (1301)
- Ink Sepolia (763373)

## Advanced Usage

### Custom Vesting Configuration

```typescript
vesting: {
  duration: 180 * 24 * 60 * 60, // 180 days
  recipients: [
    { address: '0x...', amount: parseEther('100000') },
    { address: '0x...', amount: parseEther('50000') },
  ],
}
```

### Hook Address Mining (V4)

For optimal gas efficiency with Uniswap V4, you can mine hook addresses:

```typescript
// This feature is coming soon
const minedAddress = await sdk.mineHookAddress({
  prefix: '0x00', // Target prefix for gas optimization
  deployer: '0x...', // Doppler deployer address
});
```

## API Reference

### DopplerSDK

The main SDK class providing access to all functionality.

```typescript
class DopplerSDK {
  constructor(config: DopplerSDKConfig)
  
  // Properties
  factory: DopplerFactory
  quoter: Quoter
  
  // Methods
  getStaticAuction(poolAddress: Address): Promise<StaticAuction>
  getDynamicAuction(hookAddress: Address): Promise<DynamicAuction>
  getPoolInfo(poolAddress: Address): Promise<PoolInfo>
  getHookInfo(hookAddress: Address): Promise<HookInfo>
}
```

### Types

Key types are exported for use in your applications:

```typescript
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  MigrationConfig,
  PoolInfo,
  HookInfo,
  VestingConfig,
} from '@whetstone-research/doppler-sdk';
```

## Development

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build

# Run tests
pnpm test

# Development mode with watch
pnpm dev
```

## Migration from Previous SDKs

If you're migrating from `doppler-v3-sdk` or `doppler-v4-sdk`, see our [Migration Guide](./docs/migration-guide.md).

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
