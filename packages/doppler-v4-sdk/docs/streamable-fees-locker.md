# StreamableFeesLocker Integration Guide

This guide explains how to use the StreamableFeesLocker with the Doppler V4 SDK for fee distribution and no-op governance.

## Overview

The StreamableFeesLocker is a contract that:
- Locks Uniswap V4 positions for a specified duration
- Streams trading fees to multiple beneficiaries
- Supports perpetual fee collection for no-op governance

## Basic Usage

### 1. Setting Up Beneficiaries

```typescript
import { BeneficiaryData, WAD, DEAD_ADDRESS } from '@doppler-v4/sdk';

// Define beneficiaries with their share percentages
const beneficiaries: BeneficiaryData[] = [
  {
    beneficiary: '0x...protocol', // Protocol treasury
    shares: BigInt(0.05e18), // 5% in WAD
  },
  {
    beneficiary: '0x...integrator', // Integrator
    shares: BigInt(0.05e18), // 5% in WAD
  },
  {
    beneficiary: '0x...team', // Team/DAO
    shares: BigInt(0.9e18), // 90% in WAD
  },
];

// Sort beneficiaries (required for contract validation)
const sortedBeneficiaries = factory.sortBeneficiaries(beneficiaries);
```

### 2. Creating V4 Migrator Data

```typescript
import { V4MigratorData } from '@doppler-v4/sdk';

const v4MigratorConfig: V4MigratorData = {
  fee: 3000, // 0.3% in bips
  tickSpacing: 60,
  lockDuration: 30 * 24 * 60 * 60, // 30 days in seconds
  beneficiaries: sortedBeneficiaries,
};

// Encode the migrator data
const liquidityMigratorData = factory.encodeV4MigratorData(v4MigratorConfig);
```

### 3. Standard Governance Configuration

```typescript
const config = await factory.buildConfig({
  // ... other parameters
  liquidityMigratorData,
  integrator: '0x...integrator',
}, addresses);

// Create the pool
const txHash = await factory.create(config.createParams);
```

### 4. No-Op Governance Configuration

For no-op governance (permanent liquidity lock with perpetual fee streaming):

```typescript
// Configure for no-op governance
const config = await factory.buildConfig({
  // ... other parameters
  liquidityMigratorData,
  integrator: '0x...integrator',
}, addresses, {
  useGovernance: false // This uses the noOpGovernanceFactory
});

// The migration will automatically set recipient to DEAD_ADDRESS (0xdead)
// This ensures the position is permanently locked
```

## Post-Migration Operations

### 1. Distributing Fees

Anyone can call `distributeFees` to collect and distribute trading fees:

```typescript
import { streamableFeesLockerAbi } from '@doppler-v4/sdk';
import { createPublicClient, createWalletClient } from 'viem';

const client = createWalletClient({
  // ... client config
});

// Distribute fees for a position
const hash = await client.writeContract({
  address: addresses.streamableFeesLocker,
  abi: streamableFeesLockerAbi,
  functionName: 'distributeFees',
  args: [tokenId],
});
```

### 2. Claiming Fees (Beneficiaries)

Beneficiaries can claim their accumulated fees:

```typescript
const hash = await client.writeContract({
  address: addresses.streamableFeesLocker,
  abi: streamableFeesLockerAbi,
  functionName: 'releaseFees',
  args: [tokenId],
});
```

### 3. Updating Beneficiary Address

Beneficiaries can update their address:

```typescript
const hash = await client.writeContract({
  address: addresses.streamableFeesLocker,
  abi: streamableFeesLockerAbi,
  functionName: 'updateBeneficiary',
  args: [tokenId, newBeneficiaryAddress],
});
```

## Example: Complete Flow

```typescript
import { 
  ReadWriteFactory, 
  BeneficiaryData, 
  V4MigratorData,
  WAD,
  DEAD_ADDRESS,
  parseEther
} from '@doppler-v4/sdk';

// 1. Initialize factory
const factory = new ReadWriteFactory(addresses.airlock, drift);

// 2. Set up beneficiaries
const beneficiaries: BeneficiaryData[] = [
  { beneficiary: addresses.airlock, shares: BigInt(0.05e18) }, // 5%
  { beneficiary: integratorAddress, shares: BigInt(0.05e18) }, // 5%
  { beneficiary: teamAddress, shares: BigInt(0.9e18) }, // 90%
];

// 3. Sort beneficiaries
const sortedBeneficiaries = factory.sortBeneficiaries(beneficiaries);

// 4. Create V4 migrator configuration
const v4Config: V4MigratorData = {
  fee: 3000,
  tickSpacing: 60,
  lockDuration: 30 * 24 * 60 * 60, // 30 days
  beneficiaries: sortedBeneficiaries,
};

// 5. Encode migrator data
const liquidityMigratorData = factory.encodeV4MigratorData(v4Config);

// 6. Build pool configuration
const config = await factory.buildConfig({
  name: "Example Token",
  symbol: "EXT",
  totalSupply: parseEther("1000000"),
  numTokensToSell: parseEther("500000"),
  priceRange: { startPrice: 0.001, endPrice: 0.01 },
  duration: 30,
  epochLength: 3600,
  liquidityMigratorData,
  // ... other required parameters
}, addresses, {
  useGovernance: false // For no-op governance
});

// 7. Create the pool
const txHash = await factory.create(config.createParams);
```

## Key Points

1. **Beneficiary Validation**: 
   - Beneficiaries must be sorted by address (ascending)
   - Total shares must equal exactly 1e18 (WAD)
   - All shares must be positive

2. **Lock Duration**: 
   - Standard governance: Position unlocks after duration
   - No-op governance: Position locked forever (recipient = DEAD_ADDRESS)

3. **Fee Distribution**:
   - 10% of liquidity goes to StreamableFeesLocker
   - 90% goes to governance timelock (standard) or 100% to locker (no-op)

4. **Migration Types**:
   - Standard: Creates 2 NFTs, locks 10% in StreamableFeesLocker
   - No-op: Creates 1 NFT, locks 100% in StreamableFeesLocker permanently