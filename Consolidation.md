# Doppler SDK Consolidation Plan

## 1. Overview & Goals

This document outlines the plan to consolidate the `@packages/doppler-v3-sdk` and `@packages/doppler-v4-sdk` into a single, unified `@packages/doppler-sdk`.

The primary goals of this initiative are:
- **Unify the Developer Experience**: Provide a single, cohesive SDK for all Doppler-related interactions.
- **Clarify Terminology**: Move away from the confusing "v3" and "v4" monikers, which imply specific Uniswap versions, and adopt more descriptive terms.
- **Improve API Design**: Create a more intuitive, type-safe, and organized API that simplifies the process of creating and managing auctions.
- **Enhance Maintainability**: Reduce code duplication and simplify maintenance by managing a single package.

## 2. Core Concepts & New Terminology

To eliminate confusion, we will standardize the following terms:

- **Static Auction**: Refers to the functionality currently in `doppler-v3-sdk`. It involves creating a liquidity bootstrapping pool using a standard Uniswap v3 pool with a fixed price range. This is ideal for simple, predictable price discovery events.

- **Dynamic Auction**: Refers to the functionality currently in `doppler-v4-sdk`. It uses a Uniswap v4 hook to create a gradual Dutch auction where the price moves dynamically over time according to set parameters (`gamma`, `epochLength`, etc.).

- **Migration**: The process of moving liquidity from either auction type to a standard, permanent trading pool on Uniswap. The migration target can be Uniswap v2, v3, or v4, and is independent of the auction type chosen.

## 3. Proposed API Design

### 3.1. Main SDK Entry Point

A new `DopplerSDK` class will be the primary entry point for all interactions, providing access to various modules.

```typescript
// packages/doppler-sdk/src/index.ts
import { DopplerSDK } from '@doppler-sdk/main';
import { viemClient } from './clients';

// Initialize the SDK with chain and client info
const sdk = new DopplerSDK({
  client: viemClient,
  chainId: 8453, // e.g., Base mainnet
});

// Access different parts of the SDK
const factory = sdk.factory;
const quoter = sdk.quoter;
```

### 3.2. Unified Factory

A single `DopplerFactory` class will handle the creation of all auction types, replacing the separate `ReadWriteFactory` classes from the old SDKs.

- `DopplerFactory.createStaticAuction(params: CreateStaticAuctionParams)`
- `DopplerFactory.createDynamicAuction(params: CreateDynamicAuctionParams)`

### 3.3. Auction Interaction

Once an auction is created, dedicated classes will be used to interact with them, abstracting the underlying contract differences.

- `sdk.getStaticAuction(poolAddress: Address)`: Returns a `StaticAuction` instance for interacting with a static auction pool.
- `sdk.getDynamicAuction(hookAddress: Address)`: Returns a `DynamicAuction` instance for interacting with a dynamic auction hook.

## 4. New Configuration Objects

The new API will feature clearly defined, nested configuration objects to improve readability and type safety.

### 4.1. `CreateStaticAuctionParams`

```typescript
interface CreateStaticAuctionParams {
  // Token configuration
  token: {
    name: string;
    symbol: string;
    tokenURI: string;
  };

  // Sale configuration
  sale: {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address; // e.g., WETH address
  };

  // Static Auction (Uniswap v3) Pool configuration
  pool: {
    startTick: number;
    endTick: number;
    fee: number; // e.g., 3000 for 0.3%
  };

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;
}
```

### 4.2. `CreateDynamicAuctionParams`

```typescript
interface CreateDynamicAuctionParams {
  // Token and Sale configs are the same as for Static Auctions
  token: { ... };
  sale: { ... };

  // Dynamic Auction (Uniswap v4 Hook) configuration
  auction: {
    duration: number; // in days
    epochLength: number; // in seconds
    priceRange: { startPrice: number; endPrice: number };
    gamma?: number; // Optional, can be auto-calculated
    minProceeds: bigint;
    maxProceeds: bigint;
  };

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;
}
```

### 4.3. `MigrationConfig` (Discriminated Union)

This is the cornerstone of the new API, making the migration path explicit and type-safe. It replaces the opaque `liquidityMigratorData` hex string.

```typescript
type MigrationConfig =
  | { type: 'uniswapV2' } // Basic migration to a new Uniswap v2 pool
  | { 
      type: 'uniswapV3'; 
      fee: number; 
      tickSpacing: number;
    }
  | {
      type: 'uniswapV4';
      fee: number;
      tickSpacing: number;
      // Configuration for fee streaming via StreamableFeesLocker
      streamableFees: {
        lockDuration: number; // in seconds
        beneficiaries: BeneficiaryData[];
      };
      // For no-op governance where 100% of liquidity is permanently locked
      noOpGovernance?: boolean;
    };
```

## 5. "Before vs. After" Code Examples

### Example 1: Creating a Static Auction migrating to Uniswap v4

**Before (`doppler-v3-sdk`)**: The developer had to use the "v3" SDK and manually encode "v4" data, which was confusing.

```typescript
// Confusing: Using v3 SDK to create something that migrates to v4
const factory = new ReadWriteFactory(...);

// Manually encode V4 migrator data into an opaque hex string
const v4MigratorData = await factory.encodeV4MigratorData({
  fee: 3000,
  tickSpacing: 60,
  lockDuration: 365 * 24 * 60 * 60,
  beneficiaries: sortedBeneficiaries
});

// Create the pool, passing the opaque data
await factory.create({
  // ... other params
  liquidityMigratorData: v4MigratorData,
  contracts: {
    // ... other contracts
    poolInitializer: addresses.unichain.v3Initializer,
    liquidityMigrator: addresses.unichain.liquidityMigrator, // Which migrator is this?
  }
});
```

**After (unified `doppler-sdk`)**: The intent is clear and the configuration is type-safe.

```typescript
const factory = sdk.factory;

await factory.createStaticAuction({
  token: { name: 'My Token', symbol: 'MTK', ... },
  sale: { ... },
  pool: { startTick: 175000, endTick: 225000, fee: 3000 },
  // Explicit, type-safe migration config
  migration: {
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: {
      lockDuration: 365 * 24 * 60 * 60, // 1 year
      beneficiaries: sortedBeneficiaries
    }
  },
  userAddress: '0x...'
});
```

## 6. Proposed File Structure

The new `@packages/doppler-sdk` will be organized as follows:

```
packages/doppler-sdk/src/
├── index.ts            # Main SDK entry point (exports DopplerSDK)
├── DopplerSDK.ts       # The main SDK class definition
├── addresses.ts        # Unified address book for all supported chains
├── constants.ts        # Unified constants (WAD, DEAD_ADDRESS, etc.)
├── types.ts            # All public types (CreateParams, MigrationConfig, etc.)
├── abis/               # All required ABIs for all auction and migration types
└── entities/
    ├── DopplerFactory.ts # The new unified factory for creating auctions
    ├── auction/
    │   ├── StaticAuction.ts  # Class for interacting with a static auction
    │   └── DynamicAuction.ts # Class for interacting with a dynamic auction
    ├── token/
    │   ├── Derc20.ts
    │   └── Eth.ts
    ├── Quoter.ts         # Unified quoter for v2, v3, and v4 pools
    └── utils/            # Shared helper functions (price conversion, etc.)
```

## 7. Implementation Plan

The consolidation will be executed in phases:

- **Phase 1: Scaffolding and Core Abstractions**
  - Create the new `@packages/doppler-sdk` directory and `package.json`.
  - Define all the new public types (`CreateStaticAuctionParams`, `MigrationConfig`, etc.) in `src/types.ts`.
  - Implement the shell of the `DopplerSDK` and `DopplerFactory` classes.

- **Phase 2: Implement Static Auctions**
  - Port the core logic from `doppler-v3-sdk` into the `DopplerFactory.createStaticAuction` method.
  - Adapt the logic to work with the new `CreateStaticAuctionParams` and `MigrationConfig` types.
  - Implement the `StaticAuction` interaction class.

- **Phase 3: Implement Dynamic Auctions**
  - Port the core logic from `doppler-v4-sdk` into the `DopplerFactory.createDynamicAuction` method.
  - Adapt the logic to the new `CreateDynamicAuctionParams` and `MigrationConfig` types.
  - Implement the `DynamicAuction` interaction class.

- **Phase 4: Unify Shared Entities**
  - Consolidate the `Quoter`, `Derc20`, and `Eth` entities into the new SDK, ensuring they can handle all relevant Uniswap versions.
  - Unify the `addresses.ts` and `constants.ts` files.

- **Phase 5: Testing and Documentation**
  - Write a comprehensive suite of tests (unit and integration) for the new unified API.
  - Test all combinations of auction types and migration targets.
  - Update all `README.md` files, docs, and examples to reflect the new API.
  - Create a migration guide for users of the old SDKs.

- **Phase 6: Deprecation and Cleanup**
  - Mark the `@packages/doppler-v3-sdk` and `@packages/doppler-v4-sdk` packages as deprecated in their `package.json` and `README.md` files.
  - Point users to the new `@packages/doppler-sdk`.
  - Eventually, remove the old packages from the monorepo.
