# V4 Pool Support Implementation Plan

## Overview

This document outlines the implementation of support for post-migration V4 pools in the doppler-v4-sdk. Currently, the SDK only supports Doppler V4 hooks (Dutch auction pools) but not standard V4 pools that tokens migrate to after graduation.

## Problem Statement

When tokens graduate through the V4 migrator:
1. They move from Doppler hooks to standard Uniswap V4 pools
2. These pools use the shared V4MigratorHook
3. They are identified by 32-byte pool IDs within the PoolManager singleton
4. The SDK currently cannot interact with these graduated pools

## Implementation Architecture

### 1. Core Entity Classes

#### 1.1 ReadV4Pool
**File**: `src/entities/v4pool/ReadV4Pool.ts`

```typescript
import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address, Hex } from 'viem';
import { PoolKey } from '@/types';

export class ReadV4Pool {
  constructor(
    private poolManager: ReadContract<PoolManagerABI>,
    private stateView: ReadContract<StateViewABI>,
    private poolKey: PoolKey,
    drift?: Drift<ReadAdapter>
  ) {}

  // Core pool identification
  getPoolId(): Hex
  getPoolKey(): PoolKey
  
  // Pool state queries
  async getSlot0(): Promise<Slot0>
  async getLiquidity(): Promise<bigint>
  async getTickInfo(tick: number): Promise<TickInfo>
  async getFeeGrowthGlobal0(): Promise<bigint>
  async getFeeGrowthGlobal1(): Promise<bigint>
  
  // Token information
  getCurrency0(): Address
  getCurrency1(): Address
  getFee(): number
  getTickSpacing(): number
  getHooks(): Address
  
  // Price calculations
  async getCurrentPrice(): Promise<bigint>
  async getSqrtPriceX96(): Promise<bigint>
  async getCurrentTick(): Promise<number>
}
```

#### 1.2 ReadV4Position
**File**: `src/entities/v4pool/ReadV4Position.ts`

```typescript
export class ReadV4Position {
  constructor(
    private poolManager: ReadContract<PoolManagerABI>,
    private stateView: ReadContract<StateViewABI>,
    private poolId: Hex,
    drift?: Drift<ReadAdapter>
  ) {}

  // Position queries
  async getPosition(
    owner: Address,
    tickLower: number,
    tickUpper: number,
    salt: Hex
  ): Promise<PositionInfo>
  
  async getPositionById(positionId: Hex): Promise<PositionInfo>
  
  // Position calculations
  async getPositionValue(positionInfo: PositionInfo): Promise<{
    amount0: bigint;
    amount1: bigint;
  }>
  
  async getUnclaimedFees(positionInfo: PositionInfo): Promise<{
    fee0: bigint;
    fee1: bigint;
  }>
}
```

#### 1.3 ReadWriteV4Pool
**File**: `src/entities/v4pool/ReadWriteV4Pool.ts`

```typescript
export class ReadWriteV4Pool extends ReadV4Pool {
  constructor(
    poolManager: WriteContract<PoolManagerABI>,
    stateView: ReadContract<StateViewABI>,
    poolKey: PoolKey,
    drift?: Drift<WriteAdapter>
  ) {
    super(poolManager, stateView, poolKey, drift);
  }

  // Swap operations
  async swap(params: {
    zeroForOne: boolean;
    amountSpecified: bigint;
    sqrtPriceLimitX96?: bigint;
    recipient?: Address;
  }): Promise<TransactionResponse>
  
  // Liquidity operations
  async modifyLiquidity(params: {
    tickLower: number;
    tickUpper: number;
    liquidityDelta: bigint;
    salt?: Hex;
  }): Promise<TransactionResponse>
  
  async donate(params: {
    amount0: bigint;
    amount1: bigint;
  }): Promise<TransactionResponse>
}
```

#### 1.4 V4PoolFactory
**File**: `src/entities/v4pool/V4PoolFactory.ts`

```typescript
export class V4PoolFactory {
  // Create pool instances from various inputs
  static fromPoolKey(
    poolKey: PoolKey,
    poolManager: Address,
    stateView: Address,
    drift?: Drift
  ): ReadV4Pool
  
  static fromPoolId(
    poolId: Hex,
    poolManager: Address,
    stateView: Address,
    drift?: Drift
  ): Promise<ReadV4Pool>
  
  static fromTokens(
    token0: Address,
    token1: Address,
    fee: number,
    tickSpacing: number,
    hooks: Address,
    poolManager: Address,
    stateView: Address,
    drift?: Drift
  ): ReadV4Pool
}
```

### 2. Utility Functions

#### 2.1 Pool ID Utilities
**File**: `src/utils/v4pool/poolId.ts`

```typescript
// Compute pool ID from PoolKey
export function computePoolId(poolKey: PoolKey): Hex

// Validate pool ID format
export function isValidPoolId(poolId: string): boolean

// Format pool ID for display
export function formatPoolId(poolId: string, length?: number): string

// Sort tokens for PoolKey
export function sortCurrencies(
  currency0: Address,
  currency1: Address
): [Address, Address]
```

#### 2.2 PoolKey Utilities
**File**: `src/utils/v4pool/poolKey.ts`

```typescript
// Build PoolKey from components
export function buildPoolKey(params: {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}): PoolKey

// Validate PoolKey
export function isValidPoolKey(poolKey: PoolKey): boolean

// Compare PoolKeys
export function poolKeysEqual(key1: PoolKey, key2: PoolKey): boolean
```

#### 2.3 Price Utilities
**File**: `src/utils/v4pool/price.ts`

```typescript
// Convert sqrt price to human readable
export function sqrtPriceToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): number

// Calculate price impact
export function calculatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  currentPrice: bigint
): number
```

### 3. Integration with Existing SDK

#### 3.1 Update Exports
**File**: `src/index.ts`
- Export all new V4 pool entities
- Export utility functions
- Export types

#### 3.2 Add Types
**File**: `src/types/v4pool.ts`
```typescript
export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

export interface TickInfo {
  liquidityGross: bigint;
  liquidityNet: bigint;
  feeGrowthOutside0X128: bigint;
  feeGrowthOutside1X128: bigint;
}

export interface PositionInfo {
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}
```

### 4. Testing Strategy

#### 4.1 Unit Tests
- Pool ID calculation
- PoolKey validation
- Price conversions
- Mock contract interactions

#### 4.2 Integration Tests
- Read pool state from mainnet/testnet
- Verify calculations against known values
- Test error handling

#### 4.3 E2E Tests
- Full swap flow on testnet
- Liquidity provision/removal
- Fee collection

### 5. Migration Path

1. **Phase 1**: Read-only support
   - Implement ReadV4Pool
   - Add utility functions
   - Basic testing

2. **Phase 2**: Write support
   - Implement ReadWriteV4Pool
   - Add transaction methods
   - Comprehensive testing

3. **Phase 3**: Advanced features
   - Position management
   - Fee calculations
   - Event monitoring

### 6. Dependencies

- Existing StateView ABI (already in SDK)
- PoolManager ABI (needs to be added)
- V4 type definitions
- Viem for encoding/hashing

### 7. Example Usage

```typescript
// Create pool instance from PoolKey
const poolKey = {
  currency0: '0x...',
  currency1: '0x...',
  fee: 3000,
  tickSpacing: 60,
  hooks: '0x...' // V4MigratorHook address
};

const pool = new ReadV4Pool(
  poolManager,
  stateView,
  poolKey
);

// Get current price
const price = await pool.getCurrentPrice();

// Execute swap
const writePool = new ReadWriteV4Pool(
  poolManager,
  stateView,
  poolKey
);

await writePool.swap({
  zeroForOne: true,
  amountSpecified: parseEther('1'),
  sqrtPriceLimitX96: 0n
});
```

## Success Criteria

1. Users can read all state from graduated V4 pools
2. Users can execute swaps on graduated V4 pools
3. Users can manage liquidity in graduated V4 pools
4. Feature parity with V3 pool operations
5. Clear documentation and examples
6. Comprehensive test coverage

## Timeline

- Week 1: Implement read-only support
- Week 2: Add write operations
- Week 3: Testing and documentation
- Week 4: Integration and release