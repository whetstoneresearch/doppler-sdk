# Design Doc: Unifying Doppler V3 and V4 with `doppler-sdk`

## 1. Overview

The Doppler ecosystem has historically been split between two major protocol versions: V3 and V4. Each had its own dedicated SDK (`doppler-v3-sdk`, `doppler-v4-sdk`), forcing developers to manage separate dependencies, learn distinct APIs, and handle version-specific logic within their applications.

The new `doppler-sdk` package solves this by providing a single, unified interface for interacting with the entire Doppler ecosystem. The key differences between V3 and V4 auctions are:

- **V3 Static Auctions**: Use Uniswap V3 pools with multiple static liquidity positions
- **V4 Dynamic Auctions**: Use Uniswap V4 hooks with dynamic Dutch auction pricing

Despite these differences, both auction types are created through the same `Airlock` contract, just with different initializers (`v3Initializer` for static, `v4Initializer` for dynamic). The unified SDK abstracts away these implementation details.

**Note on Implementation**: Both the V3 SDK and V4 SDK use the `@delvtech/drift` library as an abstraction layer for blockchain interactions, while the unified SDK uses `viem` directly. This is an internal implementation detail that doesn't affect the public API.

The primary goals of this unified SDK are:
- **Simplify Development:** Provide one package and one set of tools to learn.
- **Abstract Complexity:** Handle the complex encoding of version-specific parameters for a unified contract entry point.
- **Improve Maintainability:** Reduce code duplication and fragmentation for both developers and the Doppler team.
- **Excellent Developer Experience:** Offer configuration helpers that apply smart defaults and handle complex calculations automatically.

## 2. Core Architecture: `DopplerSDK` and the `DopplerFactory`

The unification is achieved through a clear, multi-layered architecture within the `doppler-sdk` package:

- **`DopplerSDK` (in `packages/doppler-sdk/src/DopplerSDK.ts`):** This is the main, user-facing entry point. Developers instantiate this class with their `viem` Public and Wallet clients. It acts as a facade, providing access to the SDK's core functionalities. The SDK class provides:
    - `factory`: Access to the DopplerFactory for creating auctions
    - `quoter`: Access to the Quoter for price queries
    - `getStaticAuction(address)`: Get a StaticAuction entity for V3 pools
    - `getDynamicAuction(address)`: Get a DynamicAuction entity for V4 hooks
    - `getPoolInfo(address)`: Quick access to V3 pool information
    - `getHookInfo(address)`: Quick access to V4 hook information

- **`DopplerFactory` (in `packages/doppler-sdk/src/entities/DopplerFactory.ts`):** This is the true heart of the unification logic for *creating* auctions. It is accessed via `sdk.factory`. The factory exposes four primary methods:
    - `buildStaticAuctionConfig(config, userAddress)`: Build complete configuration for V3-style static auctions
    - `buildDynamicAuctionConfig(config, userAddress)`: Build complete configuration for V4-style dynamic auctions
    - `createStaticAuction(params)`: For creating V3-style static auctions on Uniswap V3
    - `createDynamicAuction(params)`: For creating V4-style hook-based dynamic auctions on Uniswap V4

    The build methods handle complex parameter calculation, applying defaults, and preparing the configuration. The create methods then encode these parameters appropriately for the target initializer (`v3Initializer` or `v4Initializer`) and call the **same `airlock.create(...)` contract function**.

- **Auction Entities (`StaticAuction`, `DynamicAuction`):** For interacting with *existing* auctions, the SDK provides separate entity classes that offer a consistent API for reading pool/hook state and performing actions. These are located in `packages/doppler-sdk/src/entities/auction/`.

## 3. Auction Configuration: Before and After

To illustrate the developer experience improvement, let's compare how one might define and create an auction using the old, separate SDKs versus the new, unified SDK.

### Before: The Fragmented Approach

A developer would need to import and manage two different SDKs, each with a complex, multi-step creation process involving manual configuration, encoding/building, and executing.

```typescript
// The old way: Managing two separate, complex SDKs

// --- V3 Static Auction ---
import { ReadWriteFactory as DopplerV3Factory, CreateV3PoolParams } from '@doppler/doppler-v3-sdk';
import { createDrift } from '@delvtech/drift';

// V3 SDK requires Drift for blockchain interactions
const drift = createDrift(/* providers */);
const v3Factory = new DopplerV3Factory(airlockAddress, bundlerAddress, drift);

// 1. Assemble a complex parameters object with nested configurations
const v3PoolParams: CreateV3PoolParams = {
  integrator: '0x...',
  userAddress: '0x...',
  numeraire: '0x...',
  contracts: { 
    tokenFactory: '0x...',
    governanceFactory: '0x...',
    v3Initializer: '0x...',
    liquidityMigrator: '0x...'
  },
  tokenConfig: { name: 'My V3 Token', symbol: 'MVT', tokenURI: '' },
  vestingConfig: 'default', // or detailed VestingConfig object
  v3PoolConfig: { 
    startTick: 175000, 
    endTick: 225000, 
    numPositions: 15, 
    maxShareToBeSold: parseEther('0.35'), 
    fee: 10000 
  },
  saleConfig: {
    initialSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('900000000')
  },
  governanceConfig: {
    initialVotingDelay: 172800,
    initialVotingPeriod: 1209600,
    initialProposalThreshold: 0n
  }
};

// 2. First encode to validate parameters
const { createParams: v3CreateParams, v3PoolConfig } = v3Factory.encode(v3PoolParams);

// 3. Then encode with token ordering adjustment (prevents token0 < numeraire issues)
const finalParams = await v3Factory.encodeCreateData(v3PoolParams);

// 4. Call the create function with the encoded payload
const v3Tx = await v3Factory.create(finalParams);


// --- V4 Dynamic Auction ---
import { ReadWriteFactory as DopplerV4Factory, DopplerPreDeploymentConfig } from '@doppler/doppler-v4-sdk';
import { createDrift } from '@delvtech/drift';

// V4 SDK also uses Drift
const drift = createDrift(/* providers */);
const v4Factory = new DopplerV4Factory(airlockAddress, drift);

// Contract addresses needed for V4
const v4Addresses = { 
  tokenFactory: '0x...',
  dopplerDeployer: '0x...',
  v4Initializer: '0x...',
  poolManager: '0x...',
  airlock: '0x...',
  migrator: '0x...',
  governanceFactory: '0x...',
  noOpGovernanceFactory: '0x...' // optional
};

// 1. Assemble a different, also complex, parameters object
const v4PreDeploymentConfig: DopplerPreDeploymentConfig = {
  name: 'My V4 Token',
  symbol: 'MVT4',
  totalSupply: parseEther('1000000'),
  numTokensToSell: parseEther('500000'),
  priceRange: { startPrice: 1.0, endPrice: 0.2 },
  duration: 7, // days
  epochLength: 3600, // seconds
  blockTimestamp: 1672531200, // a recent timestamp
  tickSpacing: 60,
  fee: 3000,
  numeraire: '0x...', // or zeroAddress for ETH
  minProceeds: parseEther('100'),
  maxProceeds: parseEther('10000'),
  yearlyMintRate: parseEther('0.02'),
  vestingDuration: BigInt(365 * 24 * 60 * 60),
  recipients: ['0x...'],
  amounts: [parseEther('100000')],
  tokenURI: '',
  integrator: '0x...',
  numPdSlugs: 3, // optional
  gamma: undefined, // optional, will be computed
  liquidityMigratorData: '0x' // optional
};

// 2. Build the config, which involves complex logic like mining for a hook address
// This returns the complete params, plus the mined hook and token addresses
const { createParams, hook, token } = v4Factory.buildConfig(
  v4PreDeploymentConfig, 
  v4Addresses,
  { useGovernance: true } // optional options
);

// 3. Call the create function with the built payload
const v4Tx = await v4Factory.create(createParams);
```

### After: The Unified `doppler-sdk` Approach

With the new SDK, the developer uses a single `DopplerFactory` instance and passes properly grouped parameters directly to the creation methods. This provides a clean, intuitive API where related parameters are logically organized.

```typescript
// The new way: A single, unified SDK and Factory

import { DopplerSDK } from '@doppler/doppler-sdk';

// Using viem clients for blockchain interaction
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

const walletClient = createWalletClient({
  chain: mainnet,
  transport: http()
});

// Instantiate the unified SDK once
const doppler = new DopplerSDK({ publicClient, walletClient, chainId: 1 });
const factory = doppler.factory;
const userAddress = walletClient.account.address;

// --- Create a V3-Style Static Auction ---
// Directly pass grouped parameters to createStaticAuction
const { poolAddress, tokenAddress, transactionHash } = await factory.createStaticAuction({
    // Token configuration
    token: {
        name: 'My V3-Style Token',
        symbol: 'MVT',
        tokenURI: '', // Optional metadata URI
        yearlyMintRate: parseEther('0.02') // 2% yearly inflation (optional)
    },
    
    // Sale configuration
    sale: {
        initialSupply: parseEther('1000000000'), // Total token supply
        numTokensToSell: parseEther('900000000'), // Tokens to sell in auction
        numeraire: '0xWETH_ADDRESS...' // WETH or other token to pair with
    },
    
    // Pool configuration (V3-specific)
    pool: {
        startTick: 175000,
        endTick: 225000,
        fee: 10000, // 1% fee tier
        numPositions: 15, // Number of liquidity positions
        maxShareToBeSold: parseEther('0.35') // Max 35% of tokens to sell
    },
    
    // Vesting configuration (optional)
    vesting: {
        duration: 365 * 24 * 60 * 60, // 1 year in seconds
        cliffDuration: 30 * 24 * 60 * 60 // 30 day cliff
    },
    
    // Governance configuration (optional, uses defaults if not specified)
    governance: {
        initialVotingDelay: 172800, // 2 days
        initialVotingPeriod: 1209600, // 14 days
        initialProposalThreshold: 0n
    },
    
    // Migration - where liquidity goes after auction
    migration: {
        type: 'uniswapV2' // Migrate to V2 pool after auction
        // V2 migrator automatically distributes LP tokens:
        // 95% to governance, 5% to protocol
    },
    
    // User and protocol configuration
    integrator: account.address, // Address for integrator fees (optional)
    userAddress: account.address // User creating the auction
});


// --- Example: V4 Auction → V3 Migration (No Governance, No Inflation, With Fee Streaming) ---
// This specific example was requested to show how the current unified SDK handles
// a V4 dynamic auction that migrates to V3 with fee streaming
const v4ToV3Config = await factory.createDynamicAuction({
    // Token configuration - no inflation as requested
    token: {
        name: 'StreamFi Token',
        symbol: 'STREAM',
        tokenURI: 'ipfs://QmStreamFiTokenMetadata...',
        yearlyMintRate: 0n // No inflation
    },
    
    // Sale configuration
    sale: {
        initialSupply: parseEther('100000000'), // 100M total supply
        numTokensToSell: parseEther('60000000'), // 60M for public sale
        numeraire: '0x4200000000000000000000000000000000000006' // WETH on Base
    },
    
    // V4 Dynamic auction configuration
    auction: {
        duration: 7, // 7 day auction
        epochLength: 3600, // 1 hour epochs
        startTick: 180000, // Starting price range
        endTick: 190000, // Ending price range
        gamma: undefined, // Auto-calculate optimal gamma
        minProceeds: parseEther('100'), // Min 100 ETH to succeed
        maxProceeds: parseEther('2000'), // Max 2000 ETH (early exit)
        numPdSlugs: 5 // 5 price discovery slugs
    },
    
    // Pool configuration during auction phase
    pool: {
        fee: 3000, // 0.3% fee during auction
        tickSpacing: 60 // V4 tick spacing
    },
    
    // No vesting - immediate liquidity
    vesting: {
        duration: 0,
        cliffDuration: 0,
        recipients: [
            { address: '0xTeamMultisig...', amount: parseEther('15000000') },
            { address: '0xLiquidityIncentives...', amount: parseEther('10000000') },
            { address: '0xEcosystemGrants...', amount: parseEther('10000000') },
            { address: '0xAdvisors...', amount: parseEther('5000000') }
        ]
    },
    
    // No governance as requested
    governance: null, // or omit entirely for no governance
    
    // Migration to V3 with fee streaming
    migration: {
        type: 'uniswapV3', // Migrate from V4 to V3 after auction
        triggerTime: Date.now() / 1000 + (7 * 24 * 60 * 60), // After 7 days
        minProceeds: parseEther('100'), // Must raise min to migrate
        v3Config: {
            fee: 3000, // 0.3% fee tier for V3 pool
            tickSpacing: 60, // V3 tick spacing
            sqrtPriceX96: undefined // Calculate from final auction price
        },
        // Fee streaming configuration
        streamableFees: {
            lockDuration: 30 * 24 * 60 * 60, // 30 day streaming
            beneficiaries: [
                { address: '0xProtocolTreasury...', percentage: 2000 }, // 20% to protocol
                { address: '0xTeamMultisig...', percentage: 3000 }, // 30% to team
                { address: '0xLPRewards...', percentage: 5000 } // 50% to LPs
            ]
        }
    },
    
    // Platform and user configuration
    integrator: '0xLaunchPlatform...', // Platform fee recipient
    userAddress: account.address,
    blockTimestamp: Number(currentBlockTimestamp + 600n) // Start in 10 minutes
});

console.log('V4→V3 Migration Auction Created:', {
    hookAddress: v4ToV3Config.hookAddress, // V4 hook for auction
    tokenAddress: v4ToV3Config.tokenAddress,
    poolId: v4ToV3Config.poolId, // V4 pool ID during auction
    expectedV3Pool: v4ToV3Config.expectedV3PoolAddress, // Future V3 pool
    transactionHash: v4ToV3Config.transactionHash
});

// --- Create a Standard V4-Style Dynamic Auction ---
// Directly pass grouped parameters to createDynamicAuction
const { hookAddress, tokenAddress, poolId, transactionHash } = await factory.createDynamicAuction({
    // Token configuration
    token: {
        name: 'My V4-Style Token',
        symbol: 'MVT4',
        tokenURI: '',
        yearlyMintRate: 0n // No inflation
    },
    
    // Sale configuration
    sale: {
        initialSupply: parseEther('1000000000'), // 1 billion tokens
        numTokensToSell: parseEther('900000000'), // 900 million for sale
        numeraire: ZERO_ADDRESS // Use ETH as numeraire
    },
    
    // Dynamic auction configuration (V4-specific)
    auction: {
        duration: 7, // Auction duration in days
        epochLength: 3600, // 1 hour epochs for price adjustments
        startTick: 180000,
        endTick: 190000,
        gamma: undefined, // Let SDK calculate optimal gamma
        minProceeds: parseEther('100'), // Minimum ETH to raise
        maxProceeds: parseEther('600'), // Maximum ETH to raise (early exit)
        numPdSlugs: 5 // Price discovery slugs
    },
    
    // Pool configuration
    pool: {
        fee: 3000, // 0.3% fee tier
        tickSpacing: 8 // V4 tick spacing (affects price precision)
    },
    
    // Vesting configuration (optional)
    vesting: {
        duration: 0, // No vesting in this example
        cliffDuration: 0
    },
    
    // Governance configuration (optional)
    governance: {
        initialVotingDelay: 86400, // 1 day
        initialVotingPeriod: 604800, // 7 days
        initialProposalThreshold: parseEther('1000000') // 1M tokens to propose
    },
    
    // Migration - where liquidity goes after auction
    migration: {
        type: 'uniswapV4', // Stay on V4 after auction
        fee: 3000, // Final pool fee
        tickSpacing: 60, // Final pool tick spacing
        streamableFees: { // V4-specific fee streaming
            lockDuration: 60 * 60 * 24 * 30, // 30 days
            beneficiaries: [
                {
                    address: protocolAddress,
                    percentage: 500, // 5% to protocol (in basis points)
                },
                {
                    address: creatorAddress,
                    percentage: 9500, // 95% to creator (in basis points)
                }
            ]
        }
    },
    
    // User and protocol configuration
    integrator: ZERO_ADDRESS, // No integrator fees
    userAddress: account.address, // User creating the auction
    
    // Optional timing configuration
    blockTimestamp: Number(currentBlockTimestamp + 300n) // Start in 5 minutes
});
```

This approach provides a clean, intuitive API where:
- Parameters are logically grouped by their purpose (token, sale, pool, etc.)
- The structure is self-documenting and easy to understand
- Related configuration is kept together, making it easier to reason about
- TypeScript provides full type safety and autocompletion for the nested structure

The build helper methods (`buildStaticAuctionConfig` and `buildDynamicAuctionConfig`) still exist for backward compatibility and for cases where developers want to provide minimal configuration with smart defaults, but the recommended approach is to use the grouped parameters directly for maximum clarity and control.

## 4. Reading State from Existing Auctions

Beyond creating new auctions, a primary use case for the SDK is to interact with and read data from existing auctions, regardless of their version. The unified `DopplerSDK` provides a clear and consistent pattern for this.

The SDK abstracts the two types of auctions into two distinct entity classes: `StaticAuction` for V3-style pools and `DynamicAuction` for V4-style hooks.

### Accessing an Auction Entity

A developer can get an instance of the appropriate auction entity directly from the main `DopplerSDK` object.

**Example:**

```typescript
import { DopplerSDK } from '@doppler/doppler-sdk';

const sdk = new DopplerSDK({ publicClient, chainId });

// Get an entity for an existing V3-style static auction
const staticAuction = await sdk.getStaticAuction('0xV3_POOL_ADDRESS...');

// Get an entity for an existing V4-style dynamic auction
const dynamicAuction = await sdk.getDynamicAuction('0xV4_HOOK_ADDRESS...');
```

### Reading Auction Data

Once you have the entity instance, you can call methods on it to read on-chain data. The SDK exposes standardized methods for common data points, abstracting the underlying contract differences.

**Example:**

```typescript
// --- Reading from a Static Auction (V3) ---

// Get a summary of the pool's state and configuration using the direct helper
const poolInfo = await sdk.getPoolInfo('0xV3_POOL_ADDRESS...');
console.log(`V3 Auction ends at: ${new Date(poolInfo.endTime * 1000)}`);

// Or get the entity to access more specific methods
const staticAuction = await sdk.getStaticAuction('0xV3_POOL_ADDRESS...');
const amountSold = await staticAuction.getAmountSold();
console.log(`Sold: ${amountSold} tokens`);


// --- Reading from a Dynamic Auction (V4) ---

// Get a summary of the hook's state and configuration
const hookInfo = await sdk.getHookInfo('0xV4_HOOK_ADDRESS...');
console.log(`V4 Auction current price: ${hookInfo.currentPrice}`);

// Or get the entity for more detailed interaction
const dynamicAuction = await sdk.getDynamicAuction('0xV4_HOOK_ADDRESS...');
const isSoldOut = await dynamicAuction.isSoldOut();
console.log(`Is V4 auction sold out? ${isSoldOut}`);
```

This approach provides a clean separation of concerns. The main `DopplerSDK` class acts as a gateway to get the right entity, and the entity itself contains the specialized logic for reading data from its specific contract version, while still offering a familiar and consistent API where possible.

## 5. Why the Unified SDK Doesn't Need Drift

While both the V3 and V4 SDKs rely on `@delvtech/drift` as an abstraction layer for blockchain interactions, the unified SDK uses `viem` directly. This architectural decision was made for several important reasons:

### Direct Viem Usage Benefits

1. **Simpler Architecture**: Viem has matured significantly and now provides all the functionality previously requiring Drift's abstraction layer. The unified SDK can leverage viem's native type safety, contract interactions, and transaction management without additional wrappers.

2. **Reduced Complexity**: By removing the Drift abstraction layer, the unified SDK has:
   - Fewer dependencies to maintain and update
   - More straightforward debugging (one less layer in the stack)
   - Cleaner, more readable code that directly shows what's happening

3. **Modern API Design**: Viem's current API provides excellent developer experience out of the box:
   ```typescript
   // Legacy SDKs with Drift
   const contract = drift.contract({ abi, address });
   await contract.write('methodName', args, options);
   
   // Unified SDK with viem
   const { request } = await publicClient.simulateContract({
     address, abi, functionName: 'methodName', args
   });
   await walletClient.writeContract(request);
   ```

4. **Better Performance**: Direct viem usage eliminates the overhead of an additional abstraction layer, resulting in:
   - Faster contract calls
   - Reduced bundle size
   - More efficient memory usage

5. **Ecosystem Alignment**: Viem has become the de facto standard for Ethereum interactions in modern TypeScript applications. Using it directly means:
   - Better compatibility with other tools and libraries
   - Access to the latest features as soon as they're released
   - Larger community for support and contributions

### Migration Path

For developers migrating from the legacy SDKs, the change is transparent. The unified SDK's public API remains consistent regardless of the underlying implementation. The factory methods (`buildStaticAuctionConfig`, `createStaticAuction`, etc.) handle all the complexity internally, so developers don't need to learn new patterns.

## 6. Brainstorming Future API Enhancements

The current architecture with explicit `build...` methods is clear and powerful. We can build on this foundation to further improve the developer experience.

### Option 1: A Fluent Builder Pattern (The Next Evolution)

This pattern would be a wrapper around the existing `buildStaticAuctionConfig` and `buildDynamicAuctionConfig` methods, providing a more guided and readable way to construct an auction. This remains a strong candidate for a future version.

**Concept:** Create a new `AuctionBuilder` class accessible from the factory.

**Full Example Implementation:**
```typescript
import { DopplerSDK } from '@doppler/doppler-sdk';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';

// Setup clients
const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

const walletClient = createWalletClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
  account: privateKeyToAccount('0x...')
});

const doppler = new DopplerSDK({ publicClient, walletClient, chainId: 8453 });
const factory = doppler.factory;

// --- Complete Static Auction Example with Fluent Builder ---
const staticAuctionResult = await factory
  .newAuction('static') // Returns StaticAuctionBuilder
  .withTokenInfo({
    name: 'Community Token',
    symbol: 'COMM',
    tokenURI: 'ipfs://QmXxx...', // IPFS metadata
    yearlyMintRate: parseEther('0.02') // 2% annual inflation
  })
  .withSaleInfo({
    initialSupply: parseEther('1000000000'), // 1 billion tokens
    numTokensToSell: parseEther('900000000'), // 900M for sale
    numeraire: '0x4200000000000000000000000000000000000006' // WETH on Base
  })
  .withV3Params({
    fee: 10000, // 1% fee tier
    numPositions: 20, // 20 liquidity positions for smooth curve
    tickRange: { 
      start: 175000, // Starting price ~$0.001
      end: 225000 // Ending price ~$1.00
    },
    maxShareToBeSold: parseEther('0.40') // Max 40% of supply can be sold
  })
  .withVesting({
    duration: 365 * 24 * 60 * 60, // 1 year vesting
    cliffDuration: 90 * 24 * 60 * 60, // 90 day cliff
    recipients: [
      { address: '0xFounder1...', amount: parseEther('50000000') }, // 50M to founder
      { address: '0xTeamWallet...', amount: parseEther('30000000') }, // 30M to team
      { address: '0xAdvisor...', amount: parseEther('20000000') } // 20M to advisors
    ]
  })
  .withGovernance({
    type: 'compound', // Use Compound-style governance
    initialVotingDelay: 2 * 24 * 60 * 60, // 2 days
    initialVotingPeriod: 7 * 24 * 60 * 60, // 7 days
    initialProposalThreshold: parseEther('10000000'), // 10M tokens to propose
    quorumVotes: parseEther('40000000'), // 40M tokens for quorum
    timelockDelay: 2 * 24 * 60 * 60 // 2 day timelock
  })
  .withMigration({
    type: 'uniswapV2',
    triggerTime: Date.now() / 1000 + (30 * 24 * 60 * 60), // 30 days from now
    minProceeds: parseEther('100'), // Min 100 ETH raised
    lpTokenDistribution: {
      governance: 9500, // 95% to governance treasury
      protocol: 500 // 5% to protocol
    }
  })
  .withIntegrator({
    address: '0xIntegratorWallet...',
    feePercentage: 100 // 1% integrator fee
  })
  .withAdvancedOptions({
    startTime: Date.now() / 1000 + 3600, // Start in 1 hour
    saltNonce: 42, // Custom salt for deterministic addresses
    enableEmergencyPause: true, // Allow emergency pause
    maxSlippage: 300 // 3% max slippage protection
  })
  .validate() // Optional: validate all parameters before execution
  .execute(); // Executes the transaction

// Result contains all deployment information
console.log({
  poolAddress: staticAuctionResult.poolAddress,
  tokenAddress: staticAuctionResult.tokenAddress,
  governanceAddress: staticAuctionResult.governanceAddress,
  vestingContracts: staticAuctionResult.vestingContracts,
  transactionHash: staticAuctionResult.transactionHash,
  gasUsed: staticAuctionResult.gasUsed
});

// --- Complete Dynamic Auction Example with Fluent Builder ---
const dynamicAuctionResult = await factory
  .newAuction('dynamic') // Returns DynamicAuctionBuilder
  .withTokenInfo({
    name: 'Dynamic Launch Token',
    symbol: 'DLT',
    tokenURI: 'https://metadata.example.com/dlt.json',
    yearlyMintRate: 0n // No inflation
  })
  .withSaleInfo({
    initialSupply: parseEther('10000000000'), // 10 billion tokens
    numTokensToSell: parseEther('5000000000'), // 5B for sale
    numeraire: '0x0000000000000000000000000000000000000000' // ETH (native)
  })
  .withV4Params({
    priceRange: { 
      startPrice: 0.00001, // Starting price in ETH
      endPrice: 0.0001 // Target end price in ETH
    },
    duration: 14, // 14 day auction
    epochLength: 3600, // 1 hour epochs
    gamma: 0.997, // Price decay factor (or undefined for auto-calculation)
    numPdSlugs: 7, // 7 price discovery slugs
    bonding: {
      curve: 'exponential', // Exponential bonding curve
      steepness: 1.5 // Curve steepness parameter
    }
  })
  .withPoolConfig({
    fee: 3000, // 0.3% fee tier
    tickSpacing: 60, // V4 tick spacing
    hookPermissions: {
      beforeSwap: true,
      afterSwap: true,
      beforeAddLiquidity: false,
      afterAddLiquidity: false
    }
  })
  .withProceeds({
    minProceeds: parseEther('500'), // Min 500 ETH to succeed
    maxProceeds: parseEther('10000'), // Max 10,000 ETH (early exit)
    proceedsRecipient: '0xTreasury...', // Where proceeds go
    refundOnFailure: true // Auto-refund if min not met
  })
  .withVesting({
    duration: 180 * 24 * 60 * 60, // 6 months
    cliffDuration: 30 * 24 * 60 * 60, // 30 days
    recipients: [
      { address: '0xDAO...', amount: parseEther('2000000000') }, // 2B to DAO
      { address: '0xEcosystem...', amount: parseEther('1000000000') } // 1B to ecosystem
    ]
  })
  .withGovernance({
    type: 'openzeppelin', // OpenZeppelin Governor
    initialVotingDelay: 1 * 24 * 60 * 60, // 1 day
    initialVotingPeriod: 3 * 24 * 60 * 60, // 3 days
    initialProposalThreshold: parseEther('50000000'), // 50M tokens
    votingQuorum: 4 // 4% quorum
  })
  .withMigration({
    type: 'uniswapV4', // Stay on V4
    fee: 500, // 0.05% final fee
    tickSpacing: 10, // Tighter tick spacing for final pool
    hookAddress: '0xCustomHook...', // Optional custom hook for final pool
    streamableFees: {
      lockDuration: 90 * 24 * 60 * 60, // 90 day lock
      beneficiaries: [
        { address: '0xProtocol...', percentage: 1000 }, // 10% to protocol
        { address: '0xLPStakers...', percentage: 9000 } // 90% to LP stakers
      ]
    }
  })
  .withReferralProgram({
    enabled: true,
    tiers: [
      { threshold: parseEther('1'), reward: 100 }, // 1% for >1 ETH
      { threshold: parseEther('10'), reward: 200 }, // 2% for >10 ETH
      { threshold: parseEther('100'), reward: 300 } // 3% for >100 ETH
    ]
  })
  .withAdvancedOptions({
    minedHookAddress: true, // Mine for optimal hook address
    targetPrefix: '0x00', // Target address prefix for gas optimization
    maxMiningTime: 60000, // Max 60 seconds to mine
    customHookData: '0x...', // Custom hook initialization data
    enableDynamicFees: true, // Enable dynamic fee adjustment
    oracleAddress: '0xChainlinkOracle...' // Price oracle for reference
  })
  .onProgress((status) => {
    // Progress callback for long-running operations like mining
    console.log(`Mining progress: ${status.percentage}% - ${status.message}`);
  })
  .validate() // Validate configuration
  .simulate() // Optional: simulate the transaction first
  .execute({
    gasLimit: 5000000n,
    maxFeePerGas: parseGwei('50'),
    maxPriorityFeePerGas: parseGwei('2')
  });

// Access the created auction immediately
const auction = await doppler.getDynamicAuction(dynamicAuctionResult.hookAddress);
const currentPrice = await auction.getCurrentPrice();
console.log(`Auction launched at price: ${currentPrice} ETH per token`);

// --- Specific Example: V4 Auction → V3 Migration with Fee Streaming ---
// This example shows a V4 dynamic auction that migrates to a V3 pool
// with no governance, no inflation, but includes fee streaming
const v4ToV3Example = await factory
  .newAuction('dynamic') // Start with V4 dynamic auction
  .withTokenInfo({
    name: 'StreamFi Token',
    symbol: 'STREAM',
    tokenURI: 'ipfs://QmStreamFiTokenMetadata...',
    yearlyMintRate: 0n // No inflation as requested
  })
  .withSaleInfo({
    initialSupply: parseEther('100000000'), // 100M total supply
    numTokensToSell: parseEther('60000000'), // 60M for public sale
    numeraire: '0x4200000000000000000000000000000000000006' // WETH on Base
  })
  .withV4Params({
    priceRange: {
      startPrice: 0.00005, // Start at $0.05 (assuming $1000 ETH)
      endPrice: 0.0002 // Target $0.20
    },
    duration: 7, // 7 day auction
    epochLength: 3600, // 1 hour epochs for responsive pricing
    gamma: undefined, // Auto-calculate optimal decay
    numPdSlugs: 5, // 5 price discovery slugs
    bonding: {
      curve: 'exponential',
      steepness: 1.2 // Moderate bonding curve
    }
  })
  .withPoolConfig({
    fee: 3000, // 0.3% fee during auction
    tickSpacing: 60, // Standard V4 tick spacing
    hookPermissions: {
      beforeSwap: true,
      afterSwap: true,
      beforeAddLiquidity: false,
      afterAddLiquidity: false
    }
  })
  .withProceeds({
    minProceeds: parseEther('100'), // Min 100 ETH to succeed
    maxProceeds: parseEther('2000'), // Max 2000 ETH (early exit)
    proceedsRecipient: '0xProjectTreasury...', // Where auction proceeds go
    refundOnFailure: true // Auto-refund if minimum not met
  })
  .withVesting({
    duration: 0, // No vesting - tokens immediately liquid
    recipients: [
      // 40M tokens reserved for various purposes
      { address: '0xTeamMultisig...', amount: parseEther('15000000') }, // 15M team
      { address: '0xLiquidityIncentives...', amount: parseEther('10000000') }, // 10M LP rewards
      { address: '0xEcosystemGrants...', amount: parseEther('10000000') }, // 10M ecosystem
      { address: '0xAdvisors...', amount: parseEther('5000000') } // 5M advisors
    ]
  })
  .withGovernance(null) // Explicitly no governance as requested
  .withMigration({
    type: 'uniswapV3', // Migrate to V3 after auction (not V2 or staying on V4)
    triggerTime: Date.now() / 1000 + (7 * 24 * 60 * 60), // Migrate after 7 days
    minProceeds: parseEther('100'), // Must raise min 100 ETH to migrate
    v3Config: {
      fee: 3000, // 0.3% fee tier for final V3 pool
      tickSpacing: 60, // V3 tick spacing
      sqrtPriceX96: undefined // Will be calculated based on final auction price
    },
    // Fee streaming configuration for V3 pool
    streamableFees: {
      lockDuration: 30 * 24 * 60 * 60, // 30 day streaming period
      beneficiaries: [
        {
          address: '0xProtocolTreasury...',
          percentage: 2000 // 20% of fees to protocol
        },
        {
          address: '0xTeamMultisig...',
          percentage: 3000 // 30% to team
        },
        {
          address: '0xLPRewards...',
          percentage: 5000 // 50% back to LPs as rewards
        }
      ]
    }
  })
  .withIntegrator({
    address: '0xLaunchPlatform...', // Platform facilitating the launch
    feePercentage: 250 // 2.5% platform fee
  })
  .withAdvancedOptions({
    minedHookAddress: true, // Mine for gas-efficient V4 hook address
    targetPrefix: '0x00', // Target prefix for gas savings
    maxMiningTime: 30000, // 30 seconds max mining time
    enableDynamicFees: false, // No dynamic fees, keep it simple
    startTime: Date.now() / 1000 + 600 // Start in 10 minutes
  })
  .validate() // Ensure all parameters are valid
  .execute({
    gasLimit: 3000000n,
    maxFeePerGas: parseGwei('30'),
    maxPriorityFeePerGas: parseGwei('1')
  });

console.log('V4 Auction with V3 Migration created:', {
  hookAddress: v4ToV3Example.hookAddress, // V4 hook for auction phase
  tokenAddress: v4ToV3Example.tokenAddress, // The token contract
  futureV3Pool: v4ToV3Example.expectedV3PoolAddress, // Where it will migrate
  transactionHash: v4ToV3Example.transactionHash,
  estimatedMigrationTime: new Date((Date.now() / 1000 + 7 * 24 * 60 * 60) * 1000)
});

// Monitor the auction
const v4Auction = await doppler.getDynamicAuction(v4ToV3Example.hookAddress);
const auctionStatus = await v4Auction.getStatus();
console.log('Auction status:', {
  currentPrice: auctionStatus.currentPrice,
  totalSold: auctionStatus.totalSold,
  proceedsRaised: auctionStatus.proceedsRaised,
  timeRemaining: auctionStatus.timeRemaining
});
```

**Type Safety Example:**
```typescript
// TypeScript ensures correct method availability based on auction type
const builder = factory.newAuction('static');

// ✅ These methods are available for static auctions
builder.withV3Params({ ... });
builder.withTokenInfo({ ... });

// ❌ TypeScript error: withV4Params doesn't exist on StaticAuctionBuilder
builder.withV4Params({ ... }); // Error!

// The builder pattern provides intellisense and autocompletion
const dynamicBuilder = factory.newAuction('dynamic');
dynamicBuilder
  .withV4Params({ // Full intellisense for V4-specific params
    priceRange: { /* autocomplete shows: startPrice, endPrice */ },
    duration: /* autocomplete shows this expects number (days) */,
    // ... etc
  });
```

**Pros:**
- **Highly Readable & Discoverable:** Guides the user through the process step-by-step.
- **Strongly Typed:** TypeScript enforces that `.withV3Params()` is only available after `newAuction('static')` is called.
- **Hides Complexity:** Abstracts away the two-step `build` then `create` process into a single chain.
- **Progressive Disclosure:** Optional methods can be skipped for defaults.
- **Validation & Simulation:** Can validate and simulate before execution.

### Option 2: A Single `createAuction` Method with Discriminated Unions

This approach would unify the API at the `factory` level, creating a single entry point for all auction creations.

**Concept:** The `DopplerFactory` would have one method, `createAuction`, which accepts a configuration object containing a `type` field (`'static' | 'dynamic'`). Based on this field, it calls the appropriate internal logic.

**Full Type Definitions and Examples:**
```typescript
import { DopplerSDK } from '@doppler/doppler-sdk';
import { parseEther, parseGwei } from 'viem';

// Complete type definitions showing the discriminated union pattern
interface BaseAuctionParams {
  // Common fields for all auction types
  token: {
    name: string;
    symbol: string;
    tokenURI?: string;
    yearlyMintRate?: bigint;
  };
  sale: {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: `0x${string}`; // Address or zero for ETH
  };
  vesting?: {
    duration: number;
    cliffDuration?: number;
    recipients?: Array<{
      address: `0x${string}`;
      amount: bigint;
    }>;
  };
  governance?: {
    type?: 'compound' | 'openzeppelin' | 'none';
    initialVotingDelay?: number;
    initialVotingPeriod?: number;
    initialProposalThreshold?: bigint;
    quorumVotes?: bigint;
    votingQuorum?: number; // Percentage for OZ Governor
    timelockDelay?: number;
  };
  integrator?: `0x${string}`;
  userAddress: `0x${string}`;
  startTime?: number;
}

interface StaticAuctionParams extends BaseAuctionParams {
  type: 'static';
  pool: {
    fee: 500 | 3000 | 10000; // V3 fee tiers
    numPositions: number;
    startTick: number;
    endTick: number;
    maxShareToBeSold: bigint;
  };
  migration: {
    type: 'uniswapV2' | 'uniswapV3';
    triggerTime?: number;
    minProceeds?: bigint;
    lpTokenDistribution?: {
      governance: number; // Basis points (9500 = 95%)
      protocol: number; // Basis points (500 = 5%)
    };
    v3Config?: { // If migrating to V3
      fee: 500 | 3000 | 10000;
      tickSpacing: number;
    };
  };
}

interface DynamicAuctionParams extends BaseAuctionParams {
  type: 'dynamic';
  auction: {
    duration: number; // Days
    epochLength: number; // Seconds
    startTick: number;
    endTick: number;
    gamma?: number; // Price decay, auto-calculated if not provided
    minProceeds: bigint;
    maxProceeds: bigint;
    numPdSlugs?: number;
    bonding?: {
      curve: 'linear' | 'exponential' | 'logarithmic';
      steepness?: number;
    };
  };
  pool: {
    fee: number; // V4 allows custom fees
    tickSpacing: number;
    hookPermissions?: {
      beforeSwap?: boolean;
      afterSwap?: boolean;
      beforeAddLiquidity?: boolean;
      afterAddLiquidity?: boolean;
      beforeRemoveLiquidity?: boolean;
      afterRemoveLiquidity?: boolean;
    };
  };
  migration: {
    type: 'uniswapV4' | 'uniswapV2';
    fee?: number; // Final pool fee
    tickSpacing?: number; // Final tick spacing
    hookAddress?: `0x${string}`; // Custom hook for final pool
    streamableFees?: {
      lockDuration: number;
      beneficiaries: Array<{
        address: `0x${string}`;
        percentage: number; // Basis points
      }>;
    };
  };
  referralProgram?: {
    enabled: boolean;
    tiers?: Array<{
      threshold: bigint;
      reward: number; // Basis points
    }>;
  };
  advancedOptions?: {
    minedHookAddress?: boolean;
    targetPrefix?: string;
    maxMiningTime?: number;
    customHookData?: `0x${string}`;
    enableDynamicFees?: boolean;
    oracleAddress?: `0x${string}`;
  };
}

// The unified type that accepts either variant
type UniversalAuctionParams = StaticAuctionParams | DynamicAuctionParams;

// --- Usage Examples ---

const doppler = new DopplerSDK({ publicClient, walletClient, chainId: 8453 });
const factory = doppler.factory;

// Example 1: Complete Static Auction with all options
const staticResult = await factory.createAuction({
  type: 'static', // This discriminator determines available fields
  
  token: {
    name: 'Community DAO Token',
    symbol: 'CDT',
    tokenURI: 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/metadata.json',
    yearlyMintRate: parseEther('0.015') // 1.5% annual inflation
  },
  
  sale: {
    initialSupply: parseEther('100000000'), // 100M tokens
    numTokensToSell: parseEther('75000000'), // 75M for public sale
    numeraire: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // USDC on Base
  },
  
  pool: {
    fee: 3000, // 0.3% fee tier
    numPositions: 25, // 25 positions for granular liquidity
    startTick: 180000, // Starting price: $0.01
    endTick: 200000, // Ending price: $0.50
    maxShareToBeSold: parseEther('0.50') // Max 50% can be sold
  },
  
  vesting: {
    duration: 730 * 24 * 60 * 60, // 2 years
    cliffDuration: 180 * 24 * 60 * 60, // 6 months cliff
    recipients: [
      { 
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEeB',
        amount: parseEther('10000000') // 10M to team
      },
      {
        address: '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed',
        amount: parseEther('5000000') // 5M to advisors
      },
      {
        address: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
        amount: parseEther('10000000') // 10M to ecosystem fund
      }
    ]
  },
  
  governance: {
    type: 'compound',
    initialVotingDelay: 13140, // ~2 days at 13s/block
    initialVotingPeriod: 46027, // ~7 days
    initialProposalThreshold: parseEther('1000000'), // 1M tokens to propose
    quorumVotes: parseEther('5000000'), // 5M tokens for quorum
    timelockDelay: 172800 // 2 days
  },
  
  migration: {
    type: 'uniswapV2',
    triggerTime: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60), // 60 days
    minProceeds: parseEther('50000'), // Min $50k USDC raised
    lpTokenDistribution: {
      governance: 9000, // 90% to DAO treasury
      protocol: 1000 // 10% to protocol
    }
  },
  
  integrator: '0x1234567890123456789012345678901234567890',
  userAddress: '0xUserAddress...',
  startTime: Math.floor(Date.now() / 1000) + 3600 // Start in 1 hour
});

console.log('Static auction created:', {
  poolAddress: staticResult.poolAddress,
  tokenAddress: staticResult.tokenAddress,
  governanceAddress: staticResult.governanceAddress,
  transactionHash: staticResult.transactionHash
});

// Example 2: Complete Dynamic Auction with all features
const dynamicResult = await factory.createAuction({
  type: 'dynamic', // This enables V4-specific fields
  
  token: {
    name: 'AI Protocol Token',
    symbol: 'AIP',
    tokenURI: 'https://api.aiprotocol.xyz/metadata/token.json',
    yearlyMintRate: 0n // No inflation
  },
  
  sale: {
    initialSupply: parseEther('1000000000'), // 1B tokens
    numTokensToSell: parseEther('400000000'), // 400M for sale
    numeraire: '0x0000000000000000000000000000000000000000' // ETH
  },
  
  auction: {
    duration: 30, // 30 day auction
    epochLength: 7200, // 2 hour epochs
    startTick: 175000, // High starting price
    endTick: 190000, // Target end price
    gamma: undefined, // Auto-calculate optimal gamma
    minProceeds: parseEther('1000'), // Min 1000 ETH
    maxProceeds: parseEther('50000'), // Max 50000 ETH (early exit)
    numPdSlugs: 10, // 10 price discovery periods
    bonding: {
      curve: 'exponential',
      steepness: 2.0 // Aggressive curve
    }
  },
  
  pool: {
    fee: 1000, // 0.1% fee tier (V4 custom)
    tickSpacing: 20, // Fine-grained price levels
    hookPermissions: {
      beforeSwap: true, // Enable pre-swap hook
      afterSwap: true, // Enable post-swap hook
      beforeAddLiquidity: true,
      afterAddLiquidity: false,
      beforeRemoveLiquidity: true,
      afterRemoveLiquidity: false
    }
  },
  
  vesting: {
    duration: 365 * 24 * 60 * 60, // 1 year
    cliffDuration: 90 * 24 * 60 * 60, // 3 months
    recipients: [
      {
        address: '0xDAOTreasury...',
        amount: parseEther('300000000') // 300M to DAO
      },
      {
        address: '0xDevelopmentFund...',
        amount: parseEther('200000000') // 200M to dev fund
      },
      {
        address: '0xCommunityRewards...',
        amount: parseEther('100000000') // 100M for rewards
      }
    ]
  },
  
  governance: {
    type: 'openzeppelin',
    initialVotingDelay: 7200, // 1 day at 12s/block
    initialVotingPeriod: 50400, // 7 days
    initialProposalThreshold: parseEther('10000000'), // 10M tokens
    votingQuorum: 4 // 4% quorum
  },
  
  migration: {
    type: 'uniswapV4', // Stay on V4
    fee: 500, // 0.05% final fee
    tickSpacing: 10, // Tighter spacing for mature pool
    hookAddress: '0xCustomLiquidityManager...', // Custom hook
    streamableFees: {
      lockDuration: 180 * 24 * 60 * 60, // 6 month lock
      beneficiaries: [
        {
          address: '0xProtocolTreasury...',
          percentage: 500 // 5% to protocol
        },
        {
          address: '0xLPRewards...',
          percentage: 2000 // 20% to LP rewards
        },
        {
          address: '0xDAOTreasury...',
          percentage: 7500 // 75% to DAO
        }
      ]
    }
  },
  
  referralProgram: {
    enabled: true,
    tiers: [
      { threshold: parseEther('1'), reward: 50 }, // 0.5% for >1 ETH
      { threshold: parseEther('10'), reward: 100 }, // 1% for >10 ETH
      { threshold: parseEther('100'), reward: 200 }, // 2% for >100 ETH
      { threshold: parseEther('1000'), reward: 500 } // 5% for whales
    ]
  },
  
  advancedOptions: {
    minedHookAddress: true, // Mine for gas-efficient address
    targetPrefix: '0x00', // Target prefix
    maxMiningTime: 120000, // 2 minutes max
    customHookData: '0x1234...', // Custom initialization
    enableDynamicFees: true, // Dynamic fee adjustment
    oracleAddress: '0xChainlinkETHUSD...' // Price oracle
  },
  
  integrator: '0xPlatformAddress...',
  userAddress: '0xCreatorAddress...',
  startTime: Math.floor(Date.now() / 1000) + 7200 // Start in 2 hours
});

console.log('Dynamic auction created:', {
  hookAddress: dynamicResult.hookAddress,
  tokenAddress: dynamicResult.tokenAddress,
  poolId: dynamicResult.poolId,
  governanceAddress: dynamicResult.governanceAddress,
  transactionHash: dynamicResult.transactionHash,
  gasUsed: dynamicResult.gasUsed
});

// Example 3: TypeScript discriminated union in action
function processAuctionParams(params: UniversalAuctionParams) {
  // TypeScript narrows the type based on the discriminator
  if (params.type === 'static') {
    // params.pool has V3-specific fields
    console.log(`Creating V3 pool with ${params.pool.numPositions} positions`);
    console.log(`Fee tier: ${params.pool.fee}`);
    // params.auction would be a TypeScript error here
  } else {
    // params.auction is available for dynamic type
    console.log(`Creating V4 auction for ${params.auction.duration} days`);
    console.log(`Epochs: ${params.auction.epochLength}s each`);
    // params.pool.numPositions would be an error here
  }
}

// Example 4: Minimal configuration with defaults
const minimalStatic = await factory.createAuction({
  type: 'static',
  token: { name: 'Simple Token', symbol: 'SMPL' },
  sale: {
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('500000'),
    numeraire: '0xWETH...'
  },
  pool: {
    fee: 3000,
    numPositions: 10,
    startTick: 180000,
    endTick: 190000,
    maxShareToBeSold: parseEther('0.5')
  },
  migration: { type: 'uniswapV2' },
  userAddress: '0xUser...'
  // All other fields use defaults
});
```

**Pros:**
- **Single Entry Point:** Simplifies the factory's public API to its absolute minimum.
- **Type Safety:** Leverages TypeScript discriminated unions to ensure configuration objects are valid.
- **Extensibility:** Could easily accommodate new auction types (e.g., `'hybrid'`, `'streaming'`) by adding to the union.
- **Self-Documenting:** The type field clearly indicates what kind of auction is being created.
- **Familiar Pattern:** Discriminated unions are a well-known TypeScript pattern.

## Dynamic Address Resolution and Overrides

Currently, the SDK relies on a `getAddresses(chainId)` function to fetch the correct contract addresses for a given network. This is implemented in `packages/doppler-sdk/src/addresses.ts` and returns the appropriate addresses based on the chain ID. The system supports the following networks by default:
- Mainnet (1)
- Base (8453)
- Optimism (10)
- Arbitrum (42161)
- Polygon (137)
- BSC (56)

For developers working on local testnets, forked environments, or custom deployments, the SDK could be enhanced to allow address overrides at runtime.

**Potential Enhancement:** Modify the `DopplerSDK` constructor to accept an optional `addressOverrides` object. This object would be passed down to the `DopplerFactory` and any other entities that need it.

**Example (Proposed API):**

```typescript
// In a test file or on a custom network

const addressOverrides = {
  airlock: '0xMyCustomAirlockAddress',
  v3Initializer: '0xMyCustomV3Initializer',
  v4Initializer: '0xMyCustomV4Initializer',
  tokenFactory: '0xMyCustomTokenFactory',
  // ... other addresses
};

const doppler = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: 31337, // local hardhat node
  addressOverrides: addressOverrides // Future enhancement
});

// The factory, when accessed, would use the overridden addresses
const factory = doppler.factory;
// ... factory calls would be directed to the custom addresses
```

**Pros:**
- **Enhanced Testability:** Makes it trivial to mock contract dependencies and run the SDK in a completely isolated environment.
- **Maximum Flexibility:** Enables developers to use the SDK on any EVM-compatible chain, even those not officially supported.
- **Decouples Configuration:** Separates the SDK's logic from the deployment-specific configuration of addresses.
