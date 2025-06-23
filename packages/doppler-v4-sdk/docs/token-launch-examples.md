# Token Launch Examples with V4 Migrators

This guide provides complete examples for launching tokens using Doppler V4 with StreamableFeesLocker integration.

> **Note on startTimeOffset**: The `startTimeOffset` parameter is included in the type definitions but is not currently used by the SDK implementation. All pools will start 30 seconds after the transaction is confirmed. This will be addressed in a future update.

## Prerequisites

```typescript
import { 
  ReadWriteFactory,
  BeneficiaryData,
  V4MigratorData,
  DEAD_ADDRESS,
  DOPPLER_V4_ADDRESSES
} from 'doppler-v4-sdk';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { Drift } from '@delvtech/drift';
import { viemAdapter } from '@delvtech/drift-viem';

// Setup clients
const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

const walletClient = createWalletClient({
  chain: base,
  transport: http(),
  account: privateKeyToAccount('0x...') // Your private key
});

// Setup Drift
import { createDrift } from '@delvtech/drift';

const drift = createDrift({ adapter: viemAdapter({ publicClient, walletClient }) });

// Get addresses for your chain
const addresses = DOPPLER_V4_ADDRESSES[base.id];

// Initialize factory
const factory = new ReadWriteFactory(addresses.airlock, drift);
```

## Example 1: Standard Token Launch with Governance

This example launches a token with standard governance, where 90% of liquidity goes to the timelock and 10% to the StreamableFeesLocker.

```typescript
async function launchTokenWithGovernance() {
  // 1. Define your token parameters
  const tokenName = "Community Token";
  const tokenSymbol = "COMM";
  const totalSupply = parseEther("1000000"); // 1M tokens
  const numTokensToSell = parseEther("700000"); // 700k for sale
  
  // 2. Set up beneficiaries for the 10% locked liquidity
  const beneficiaries: BeneficiaryData[] = [
    {
      beneficiary: addresses.airlock, // Protocol: 5%
      shares: BigInt(0.05e18), // 5% in WAD (1e18 = 100%)
    },
    {
      beneficiary: '0x123...', // REPLACE with your integrator address: 5%
      shares: BigInt(0.05e18), // 5% in WAD (1e18 = 100%)
    },
    {
      beneficiary: '0x456...', // REPLACE with team/treasury address: 90%
      shares: BigInt(0.9e18), // 90% in WAD (1e18 = 100%)
    }
  ];
  
  // 3. Sort beneficiaries (required by contract)
  const sortedBeneficiaries = factory.sortBeneficiaries(beneficiaries);
  
  // 4. Configure V4 migrator
  const v4Config: V4MigratorData = {
    fee: 3000, // 0.3% pool fee
    tickSpacing: 60, // Standard for 0.3% pools
    lockDuration: 180 * 24 * 60 * 60, // 180 days lock
    beneficiaries: sortedBeneficiaries
  };
  
  // 5. Encode migrator data
  const liquidityMigratorData = factory.encodeV4MigratorData(v4Config);
  
  // 6. Configure vesting (optional)
  const vestingRecipients = [
    '0x789...', // Team member 1
    '0xabc...', // Team member 2
  ];
  const vestingAmounts = [
    parseEther("50000"), // 50k tokens
    parseEther("50000"), // 50k tokens
  ];
  
  // 7. Build complete configuration
  const { createParams, hook, token } = await factory.buildConfig({
    // Token details
    name: tokenName,
    symbol: tokenSymbol,
    totalSupply: totalSupply,
    numTokensToSell: numTokensToSell,
    tokenURI: "https://api.example.com/token/metadata",
    
    // Timing
    blockTimestamp: Math.floor(Date.now() / 1000),
    startTimeOffset: 1, // Start in 1 day (NOTE: Currently not used by SDK - uses fixed 30 second offset)
    duration: 30, // 30 day sale
    epochLength: 3600, // 1 hour epochs
    
    // Price configuration
    priceRange: { 
      startPrice: 0.0001, // Starting price in ETH
      endPrice: 0.01     // Maximum price in ETH
    },
    tickSpacing: 60,
    fee: 3000, // 0.3%
    
    // Sale parameters
    minProceeds: parseEther("10"), // Minimum 10 ETH
    maxProceeds: parseEther("1000"), // Maximum 1000 ETH
    
    // Vesting
    yearlyMintRate: parseEther("100000"), // 100k tokens/year inflation
    vestingDuration: BigInt(4 * 365 * 24 * 60 * 60), // 4 years
    recipients: vestingRecipients,
    amounts: vestingAmounts,
    
    // Migration
    liquidityMigratorData: liquidityMigratorData,
    
    // Integrator
    integrator: '0x123...', // REPLACE with your actual integrator address to receive fees
  }, addresses, {
    useGovernance: true // Standard governance (default)
  });
  
  // 8. Log deployment details
  console.log("Token will be deployed at:", token);
  console.log("Hook will be deployed at:", hook);
  console.log("Sale will start at:", new Date((Math.floor(Date.now() / 1000) + 86400) * 1000));
  
  // 9. Create the pool
  const tx = await factory.create(createParams);
  console.log("Transaction hash:", tx);
  
  // 10. Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("Pool created in block:", receipt.blockNumber);
  
  return { token, hook, tx };
}
```

## Example 2: No-Op Governance Launch (100% Locked Liquidity)

This example launches a token with no-op governance, where 100% of liquidity is permanently locked in the StreamableFeesLocker.

```typescript
async function launchTokenNoOpGovernance() {
  // 1. Define token parameters (similar to above)
  const tokenName = "Perpetual Fee Token";
  const tokenSymbol = "PFT";
  const totalSupply = parseEther("10000000"); // 10M tokens
  const numTokensToSell = parseEther("5000000"); // 5M for sale
  
  // 2. Set up beneficiaries for 100% of liquidity
  // These beneficiaries will receive fees forever
  const beneficiaries: BeneficiaryData[] = [
    {
      beneficiary: '0xDAO...', // DAO Treasury: 40%
      shares: BigInt(0.4e18),
    },
    {
      beneficiary: '0xDEV...', // Development Fund: 30%
      shares: BigInt(0.3e18),
    },
    {
      beneficiary: '0xCOM...', // Community Rewards: 20%
      shares: BigInt(0.2e18),
    },
    {
      beneficiary: addresses.airlock, // Protocol: 10%
      shares: BigInt(0.1e18),
    }
  ];
  
  // 3. Sort beneficiaries
  const sortedBeneficiaries = factory.sortBeneficiaries(beneficiaries);
  
  // 4. Configure V4 migrator for no-op governance
  const v4Config: V4MigratorData = {
    fee: 10000, // 1% pool fee (higher for more fees)
    tickSpacing: 200, // Wider spacing for 1% pool
    lockDuration: 0, // Duration is ignored for no-op governance (permanent lock)
    beneficiaries: sortedBeneficiaries
  };
  
  // 5. Encode migrator data
  const liquidityMigratorData = factory.encodeV4MigratorData(v4Config);
  
  // 6. Build configuration with no-op governance
  const { createParams, hook, token } = await factory.buildConfig({
    // Token details
    name: tokenName,
    symbol: tokenSymbol,
    totalSupply: totalSupply,
    numTokensToSell: numTokensToSell,
    tokenURI: "ipfs://QmXxx...", // IPFS metadata
    
    // Timing
    blockTimestamp: Math.floor(Date.now() / 1000),
    startTimeOffset: 0.5, // Start in 12 hours (NOTE: Currently not used by SDK - uses fixed 30 second offset)
    duration: 14, // 14 day sale
    epochLength: 1800, // 30 minute epochs
    
    // Price configuration with ETH as quote
    priceRange: { 
      startPrice: 0.00001, // Lower starting price
      endPrice: 0.001      // Lower max price
    },
    tickSpacing: 200,
    fee: 10000, // 1%
    
    // Sale parameters
    minProceeds: parseEther("50"), // Minimum 50 ETH
    maxProceeds: parseEther("500"), // Maximum 500 ETH
    
    // No vesting for no-op governance
    yearlyMintRate: BigInt(0),
    vestingDuration: BigInt(0),
    recipients: [],
    amounts: [],
    
    // Migration
    liquidityMigratorData: liquidityMigratorData,
    
    // Integrator
    integrator: '0x123...', // REPLACE with your actual integrator address to receive fees
  }, addresses, {
    useGovernance: false // No-op governance - CRITICAL!
  });
  
  // The migration will automatically set recipient to DEAD_ADDRESS
  console.log("No-op governance: liquidity will be locked forever");
  console.log("Beneficiaries will receive fees in perpetuity");
  
  // 7. Create the pool
  const tx = await factory.create(createParams);
  console.log("Transaction hash:", tx);
  
  return { token, hook, tx };
}
```

## Example 3: Custom Quote Token Launch

This example shows launching with a custom quote token (not ETH).

```typescript
async function launchTokenCustomQuote() {
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC on mainnet
  
  // 1. Set up beneficiaries
  const beneficiaries: BeneficiaryData[] = [
    {
      beneficiary: addresses.airlock,
      shares: BigInt(0.1e18), // 10% to protocol
    },
    {
      beneficiary: '0xTREASURY...',
      shares: BigInt(0.9e18), // 90% to treasury
    }
  ];
  
  const sortedBeneficiaries = factory.sortBeneficiaries(beneficiaries);
  
  // 2. Configure V4 migrator
  const v4Config: V4MigratorData = {
    fee: 500, // 0.05% for stable pairs
    tickSpacing: 10, // Tight spacing for stables
    lockDuration: 90 * 24 * 60 * 60, // 90 days
    beneficiaries: sortedBeneficiaries
  };
  
  const liquidityMigratorData = factory.encodeV4MigratorData(v4Config);
  
  // 3. Build configuration with USDC as quote
  const { createParams, hook, token } = await factory.buildConfig({
    name: "Stable Token",
    symbol: "STBL",
    totalSupply: parseEther("100000000"), // 100M tokens
    numTokensToSell: parseEther("50000000"), // 50M for sale
    tokenURI: "",
    
    blockTimestamp: Math.floor(Date.now() / 1000),
    startTimeOffset: 2, // Start in 2 days (NOTE: Currently not used by SDK - uses fixed 30 second offset)
    duration: 7, // 7 day sale
    epochLength: 7200, // 2 hour epochs
    
    // IMPORTANT: Use numeraire for custom quote token
    numeraire: usdcAddress,
    
    // Price in USDC (6 decimals)
    priceRange: { 
      startPrice: 0.1,  // $0.10
      endPrice: 1.0     // $1.00
    },
    tickSpacing: 10,
    fee: 500,
    
    // Proceeds in USDC (6 decimals)
    minProceeds: BigInt(100000 * 1e6), // 100k USDC
    maxProceeds: BigInt(10000000 * 1e6), // 10M USDC
    
    yearlyMintRate: BigInt(0),
    vestingDuration: BigInt(0),
    recipients: [],
    amounts: [],
    
    liquidityMigratorData: liquidityMigratorData,
    integrator: '0x123...',
  }, addresses);
  
  console.log("Token paired with USDC:", usdcAddress);
  
  const tx = await factory.create(createParams);
  return { token, hook, tx };
}
```

## Post-Launch Operations

After launching, you can interact with the StreamableFeesLocker:

```typescript
async function distributeAndClaimFees(tokenId: bigint) {
  // 1. Anyone can distribute fees
  const distributeTx = await walletClient.writeContract({
    address: addresses.streamableFeesLocker,
    abi: streamableFeesLockerAbi,
    functionName: 'distributeFees',
    args: [tokenId]
  });
  
  console.log("Fees distributed:", distributeTx);
  
  // 2. Check claimable balance for a beneficiary
  const claimable = await publicClient.readContract({
    address: addresses.streamableFeesLocker,
    abi: streamableFeesLockerAbi,
    functionName: 'beneficiariesClaims',
    args: [beneficiaryAddress, currencyAddress]
  });
  
  console.log("Claimable amount:", claimable);
  
  // 3. Beneficiary claims fees
  const claimTx = await walletClient.writeContract({
    address: addresses.streamableFeesLocker,
    abi: streamableFeesLockerAbi,
    functionName: 'releaseFees',
    args: [tokenId]
  });
  
  console.log("Fees claimed:", claimTx);
}
```

## Important Notes

1. **Governance Choice**: 
   - `useGovernance: true` (default) = 90% to timelock, 10% to locker (this split is automatic and handled by the V4Migrator contract)
   - `useGovernance: false` = 100% to locker, permanent lock

2. **Beneficiary Requirements**:
   - Must be sorted by address (use `sortBeneficiaries()`)
   - Shares must sum to exactly 1e18
   - Cannot have duplicate addresses

3. **Price Ranges**:
   - For ETH pairs: prices in ETH (18 decimals)
   - For custom pairs: prices in quote token decimals

4. **Testing Recommendations**:
   - Test on testnet first
   - Verify beneficiary addresses
   - Double-check share calculations
   - Ensure sufficient quote token liquidity exists
