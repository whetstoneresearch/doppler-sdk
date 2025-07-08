# Doppler V4 SDK Documentation

## Guides

### StreamableFeesLocker Integration

- **[StreamableFeesLocker Overview](./streamable-fees-locker.md)** - Understanding fee distribution and beneficiary management
- **[Token Launch Examples](./token-launch-examples.md)** - Complete examples for launching tokens with V4 migrators

### Key Concepts

#### Governance Models

1. **Standard Governance**
   - 90% of liquidity → Governance Timelock (for DAO control)
   - 10% of liquidity → StreamableFeesLocker (for fee distribution)
   - Suitable for traditional DAO-governed tokens

2. **No-Op Governance** 
   - 100% of liquidity → StreamableFeesLocker (permanently locked)
   - Recipient set to DEAD_ADDRESS (0xdead)
   - Fees stream to beneficiaries forever
   - Suitable for fair launch / community tokens

#### Beneficiary Configuration

Beneficiaries receive trading fees from locked liquidity:
- Must be sorted by address (ascending)
- Shares must sum to exactly 1e18 (100%)
- Can be updated by beneficiaries themselves
- Fees accumulate and can be claimed anytime

## Quick Start

```typescript
import { ReadWriteFactory, DOPPLER_V4_ADDRESSES } from '@doppler-v4/sdk';

// Get addresses for your chain
const addresses = DOPPLER_V4_ADDRESSES[chainId];

// Initialize factory
const factory = new ReadWriteFactory(addresses.airlock, drift);

// See token-launch-examples.md for complete examples
```

## API Reference

See the [TypeScript definitions](../src/types.ts) for complete API documentation.