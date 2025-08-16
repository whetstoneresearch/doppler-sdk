# Doppler V4 SDK

A TypeScript SDK for interacting with the Doppler V4 protocol - a liquidity bootstrapping system built on Uniswap V4.

## Overview

The Doppler V4 SDK provides a comprehensive interface for:

- **Token Creation & Management**: Deploy ERC-20 tokens with vesting schedules
- **Pool Creation**: Create Uniswap V4 pools with custom hooks for price discovery
- **Price Discovery**: Automated gradual dutch auctions with customizable parameters
- **Governance**: Deploy and manage governance contracts for token communities (optional)
- **Liquidity Migration**: Move liquidity between discovery and trading pools

## Installation

```bash
npm install doppler-v4-sdk
```

## Quick Start

```typescript
import { ReadWriteFactory, DOPPLER_V4_ADDRESSES } from 'doppler-v4-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createDrift } from '@delvtech/drift';
import { viemAdapter } from '@delvtech/drift-viem';

// Setup clients
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const account = privateKeyToAccount('0x...');
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

// Create drift instance
const drift = createDrift({
  adapter: viemAdapter({ publicClient, walletClient })
});

// Get contract addresses for Base
const addresses = DOPPLER_V4_ADDRESSES[8453];

// Initialize factory
const factory = new ReadWriteFactory(addresses.airlock, drift);
```

## Core Concepts

### Price Discovery Mechanism

Doppler V4 implements a gradual dutch auction where:

- Token prices move along a predefined curve over time
- Price movements occur in discrete epochs
- The `gamma` parameter controls price movement per epoch
- Liquidity is concentrated around the current price

### Pool Configuration

Each Doppler pool requires:

- **Asset Token**: The token being sold
- **Quote Token**: The token being received (e.g., ETH, USDC)
- **Price Range**: Starting and ending ticks defining the price curve
- **Time Parameters**: Start time, duration, and epoch length
- **Proceeds Thresholds**: Minimum and maximum proceeds targets

## API Reference

### ReadWriteFactory

The main class for creating and managing Doppler pools.

#### Creating a Pool with Governance

```typescript
const config: DopplerPreDeploymentConfig = {
  name: tokenName,
  symbol: tokenSymbol,
  totalSupply: parseEther('1000000000'),
  numTokensToSell: parseEther('600000000'),
  tokenURI,
  blockTimestamp: Math.floor(Date.now() / 1000),
  startTimeOffset: 1,
  duration: 1 / 4,
  epochLength: 200,
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
  vestingDuration: BigInt(24 * 60 * 60 * 365),
  recipients: [wallet.account.address],
  amounts: [parseEther('50000000')],
  numPdSlugs: 15,
  integrator,
};

// Build configuration (uses governance by default)
const { createParams, hook, token } = factory.buildConfig(config, addresses);

// Simulate transaction
const simulation = await factory.simulateCreate(createParams);
console.log(`Estimated gas: ${simulation.request.gas}`);

// Execute creation
const txHash = await factory.create(createParams);
console.log(`Pool created: ${txHash}`);
```

#### Creating a Pool without Governance

To deploy tokens without governance (using NoOpGovernanceFactory), pass the optional `useGovernance: false` parameter:

```typescript
// Build configuration without governance
const { createParams, hook, token } = factory.buildConfig(
  config,
  addresses,
  { useGovernance: false }
);

// Deploy the token (no governance contracts will be created)
const txHash = await factory.create(createParams);
```

When using `useGovernance: false`:
- The NoOpGovernanceFactory will be used instead of the regular governance factory
- No actual governance or timelock contracts will be deployed
- The governance and timelock addresses will be set to `0xdead`
- This saves gas and simplifies deployment for tokens that don't need governance

#### Key Methods

- `buildConfig(params, addresses, options?)` - Build complete pool configuration
- `create(createParams, options?)` - Deploy the pool
- `simulateCreate(createParams)` - Simulate deployment
- `migrate(asset, options?)` - Migrate liquidity after price discovery

### ReadDoppler

Read-only interface for querying pool state.

```typescript
import { ReadDoppler } from 'doppler-v4-sdk';

const doppler = new ReadDoppler(
  dopplerAddress,
  addresses.stateView,
  drift,
  poolId
);

// Get current price
const price = await doppler.getCurrentPrice();

// Get pool configuration
const poolKey = await doppler.getPoolKey();

// Get strategy parameters
const startTime = await doppler.getStartingTime();
const endTime = await doppler.getEndingTime();
const gamma = await doppler.getGamma();

// Get token instances
const assetToken = await doppler.getAssetToken();
const quoteToken = await doppler.getQuoteToken();
```

### Token Interfaces

#### ReadDerc20 / ReadWriteDerc20

```typescript
const token = await doppler.getAssetToken();

// Read operations
const name = await token.getName();
const symbol = await token.getSymbol();
const decimals = await token.getDecimals();
const totalSupply = await token.getTotalSupply();
const balance = await token.getBalanceOf(userAddress);

// Write operations (ReadWriteDerc20 only)
await token.transfer(recipient, amount);
await token.approve(spender, amount);
```

### Quoter

Get price quotes for swaps:

```typescript
import { ReadQuoter } from 'doppler-v4-sdk';

const quoter = new ReadQuoter(addresses.v4Quoter, drift);

const quote = await quoter.quoteExactInputSingle({
  tokenIn: assetTokenAddress,
  tokenOut: quoteTokenAddress,
  fee: 3000,
  amountIn: parseEther('100'),
  sqrtPriceLimitX96: BigInt(0),
});

console.log(`Input: ${quote.amountIn}`);
console.log(`Output: ${quote.amountOut}`);
```

## Supported Networks

| Network      | Chain ID | Status        |
| ------------ | -------- | ------------- |
| Base         | 8453     | ✅ Production |
| Base Sepolia | 84532    | 🧪 Testnet    |
| Unichain     | 130      | ✅ Production |
| Ink          | 57073    | ✅ Production |

Get network addresses:

```typescript
import { DOPPLER_V4_ADDRESSES } from 'doppler-v4-sdk';

const baseAddresses = DOPPLER_V4_ADDRESSES[8453];
const sepoliaAddresses = DOPPLER_V4_ADDRESSES[84532];
```

## Advanced Usage

### Custom Liquidity Migration

```typescript
// Configure custom LP migration
const migrationData = factory.encodeCustomLPLiquidityMigratorData({
  customLPWad: parseEther('1000'), // LP tokens to mint
  customLPRecipient: lpRecipientAddress,
  lockupPeriod: 86400, // 1 day lockup
});

const config = {
  // ... other parameters
  liquidityMigratorData: migrationData,
};
```

### Gamma Calculation

The SDK automatically calculates optimal gamma (price movement per epoch):

```typescript
// Manual gamma calculation
const totalEpochs = (durationDays * 86400) / epochLength;
const tickDelta = Math.abs(endTick - startTick);
const gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing;
```

### Error Handling

The SDK provides detailed error messages for common issues:
- Missing or invalid configuration parameters
- NoOpGovernanceFactory not deployed when `useGovernance: false`
- Invalid price ranges or tick ranges
- Insufficient permissions

### Building

```bash
bun run build
```

## Examples

See the `examples/` directory for complete implementation examples:

- Basic pool creation
- Multi-chain deployment
- Custom governance setup
- Liquidity migration strategies

## Important Notes

- The `useGovernance` parameter defaults to `true` to maintain backward compatibility
- NoOpGovernanceFactory must be deployed on the target chain before using `useGovernance: false`
- If NoOpGovernanceFactory is not deployed, the SDK will throw an error when attempting to use it

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [Documentation](https://docs.doppler.finance)
- [Discord](https://discord.gg/doppler)
- [GitHub Issues](https://github.com/whetstoneresearch/doppler-sdk/issues)