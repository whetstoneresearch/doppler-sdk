# Doppler V3 SDK

[![npm version](https://img.shields.io/npm/v/doppler-v3-sdk.svg)](https://www.npmjs.com/package/doppler-v3-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript SDK for interacting with Doppler V3 protocol - a Liquidity Bootstrapping Protocol built on Uniswap V3.

## Features

- 🏭 Factory interactions for doppler contract creation and management
- 💰 Token operations including DERC20 and native ETH handling
- 🔍 Historical event querying for pools and tokens

## Installation

```bash
# Using npm
npm install doppler-v3-sdk

# Using bun
bun add doppler-v3-sdk
```

## Core Concepts

### Factory Interactions

```typescript
import { ReadFactory } from "doppler-v3-sdk";

const factory = new ReadFactory("0x...factoryAddress");
const assetData = await factory.getAssetData(tokenAddress);
const createEvents = await factory.getCreateEvents();
```

### Token Operations

```typescript
// ERC20 Token
const derc20 = new ReadDerc20(tokenAddress);
const balance = await derc20.getBalanceOf(userAddress);

// Native ETH
const eth = new ReadEth();
const ethBalance = await eth.getBalanceOf(userAddress);
```

### Pool Analytics

```typescript
const pool = new ReadUniswapV3Pool(poolAddress);
const [slot0, swapEvents] = await Promise.all([
  pool.getSlot0(),
  pool.getSwapEvents(),
]);
```

### Price Quoting

```typescript
const quoter = new ReadQuoter(quoterAddress);
const quote = await quoter.quoteExactInput({
  params: {
    tokenIn: "0x...",
    tokenOut: "0x...",
    amountIn: parseUnits("1", 18),
    fee: 3000,
  },
  options: {
    tokenDecimals: 18,
    formatDecimals: 4,
  },
});
```

## Key Components

| Component           | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `ReadFactory`       | Interface for reading from the Doppler airlock contract |
| `ReadWriteFactory`  | Interface for writing to the Doppler airlock contract   |
| `ReadDerc20`        | DERC20 token operations with vesting support            |
| `ReadEth`           | Native ETH operations                                   |
| `ReadUniswapV3Pool` | Interface for Uniswap V3 pool contract operations       |
| `ReadInitializer`   | Interface for the UniswapV3Initializer contract         |
| `ReadQuoter`        | Price quoting engine with fixed-point precision         |
| `ReadMigrator`      | Interface for V4 migrator contract with fee streaming   |

## Examples

### Basic Swap Simulation

```typescript
import { ReadQuoter, fixed } from "doppler-v3-sdk";

const quoter = new ReadQuoter("0x...quoterAddress");
const amountIn = fixed(1.5, 18); // 1.5 tokens with 18 decimals

const quote = await quoter.quoteExactInput(
  {
    tokenIn: "0x...",
    tokenOut: "0x...",
    amountIn: amountIn.toBigInt(),
    fee: 3000,
  },
  { tokenDecimals: 18, formatDecimals: 4 }
);

console.log(`Expected output: ${quote.formattedAmountOut}`);
```

Note: for executing swaps see doppler-router [here](https://github.com/whetstoneresearch/doppler-sdk/tree/main/packages/doppler-router)

### Uniswap V3 Pool Data Queries

```typescript
import { ReadUniswapV3Pool } from "doppler-v3-sdk";

const pool = new ReadUniswapV3Pool("0x...poolAddress");
const [slot0, liquidityEvents] = await Promise.all([
  pool.getSlot0(),
  pool.getMintEvents(),
]);

console.log(`Current price: ${slot0.sqrtPriceX96}`);
console.log(`${liquidityEvents.length} liquidity positions found`);
```

### Creating a V3 Pool with V4 Migration and Fee Streaming

The V3 SDK now supports creating Doppler V3 pools that can migrate to Uniswap V4 with advanced fee streaming capabilities. This allows you to distribute trading fees to multiple beneficiaries over time.

```typescript
import { 
  ReadWriteFactory, 
  BeneficiaryData,
  V4MigratorData,
  WAD,
  addresses 
} from "doppler-v3-sdk";

// Step 1: Set up beneficiaries for fee streaming
// Shares must sum to exactly WAD (1e18)
const beneficiaries: BeneficiaryData[] = [
  { 
    beneficiary: "0x...", // Treasury address
    shares: WAD * 70n / 100n  // 70% of fees
  },
  { 
    beneficiary: "0x...", // Development fund
    shares: WAD * 20n / 100n  // 20% of fees
  },
  { 
    beneficiary: "0x...", // Community rewards
    shares: WAD * 10n / 100n  // 10% of fees
  }
];

// Step 2: Sort beneficiaries (required by the contract)
const factory = new ReadWriteFactory(
  addresses.unichain.airlock,
  addresses.unichain.bundler
);
const sortedBeneficiaries = factory.sortBeneficiaries(beneficiaries);

// Step 3: Configure the V4 migrator
const migratorConfig: V4MigratorData = {
  fee: 3000,                    // 0.3% fee tier
  tickSpacing: 60,              // Tick spacing for the V4 pool
  lockDuration: 365 * 24 * 60 * 60, // 1 year lock
  beneficiaries: sortedBeneficiaries
};

// Step 4: Encode the migrator data (automatically includes 5% for airlock owner)
const encodedMigratorData = await factory.encodeV4MigratorData(migratorConfig);

// Or exclude the default beneficiary:
// const encodedMigratorData = await factory.encodeV4MigratorData(migratorConfig, false);

// Step 5: Create the pool with V4 migration configuration
const createParams = await factory.buildConfig({
  integrator: "0x...",
  userAddress: userAddress,
  numeraire: addresses.unichain.weth,
  contracts: {
    tokenFactory: addresses.unichain.tokenFactory,
    governanceFactory: addresses.unichain.governanceFactory,
    poolInitializer: addresses.unichain.v3Initializer,
    liquidityMigrator: addresses.unichain.liquidityMigrator, // V4 migrator
  },
  tokenConfig: {
    name: "My Token",
    symbol: "MTK",
    tokenURI: "https://example.com/token-metadata.json"
  },
  // Pass the encoded migrator data
  liquidityMigratorData: encodedMigratorData,
  // ... other parameters
});

await factory.create(createParams);
```

#### Querying V4 Migrator State

After deployment, you can query the migrator configuration:

```typescript
import { ReadMigrator } from "doppler-v3-sdk";

const migrator = new ReadMigrator(addresses.unichain.liquidityMigrator);

// Get the V4 pool configuration that will be created
const poolKey = await migrator.getAssetData(token0, token1);
console.log(`Fee tier: ${poolKey.fee}`);
console.log(`Tick spacing: ${poolKey.tickSpacing}`);

// Get important contract addresses
const locker = await migrator.locker(); // StreamableFeesLocker address
const poolManager = await migrator.poolManager(); // V4 PoolManager address
```

#### Fee Streaming Benefits

The V4 migrator with StreamableFeesLocker provides several advantages:

1. **Multiple Beneficiaries**: Distribute fees to multiple addresses based on shares
2. **Time-Locked Liquidity**: Liquidity is locked for a specified duration
3. **Streaming Fees**: Beneficiaries can claim accumulated fees over time
4. **No-Op Governance**: Option to permanently lock liquidity by setting recipient to DEAD_ADDRESS
5. **Updatable Beneficiaries**: Beneficiaries can update their receiving address

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
