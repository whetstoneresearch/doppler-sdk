# Market Cap Configuration Guide

This guide explains how to use the `withMarketCapRange()` method to configure Doppler auctions using dollar-denominated market cap targets instead of raw Uniswap ticks.

## Overview

The `withMarketCapRange()` method provides a business-friendly API for configuring auctions. Instead of dealing with abstract tick values, you specify:

- **Target market cap range** in USD (e.g., $100k to $10M)
- **Numeraire price** in USD (e.g., ETH = $3000)

The SDK automatically converts these values to the appropriate tick ranges.

### Benefits

- **Intuitive**: Think in dollars, not ticks
- **Consistent**: Works across all three builder types
- **Automatic**: SDK handles all tick math and token ordering internally
- **Validation**: Built-in checks for reasonable market cap ranges

---

## Quick Start

### Static Auction (V3)

```ts
const params = sdk.buildStaticAuction()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: '...' })
  .saleConfig({
    initialSupply: parseEther('1000000000'),  // 1B tokens
    numTokensToSell: parseEther('500000000'), // 500M for sale
    numeraire: WETH_ADDRESS
  })
  .withMarketCapRange({
    marketCap: { start: 100_000, end: 10_000_000 }, // $100k to $10M
    numerairePrice: 3000  // ETH = $3000
  })
  .withVesting()
  .withGovernance()
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(userAddress)
  .build()
```

### Dynamic Auction (V4)

```ts
const params = sdk.buildDynamicAuction()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: '...' })
  .saleConfig({
    initialSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('500000000'),
    numeraire: WETH_ADDRESS
  })
  .poolConfig({ fee: 3000, tickSpacing: 60 })  // Required before withMarketCapRange!
  .withMarketCapRange({
    marketCap: { start: 500_000, min: 50_000 }, // $500k start, descends to $50k floor
    numerairePrice: 3000,
    minProceeds: parseEther('100'),   // Min 100 ETH to graduate
    maxProceeds: parseEther('5000')   // Cap at 5000 ETH
  })
  .withGovernance()
  .withMigration({ type: 'uniswapV4', ... })
  .withUserAddress(userAddress)
  .build()
```

### Multicurve (V4)

```ts
const params = sdk.buildMulticurveAuction()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: '...' })
  .saleConfig({
    initialSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('900000000'),  // 90% for sale
    numeraire: WETH_ADDRESS
  })
  .withCurves({
    numerairePrice: 3000,  // ETH = $3000
    curves: [
      { marketCap: { start: 500_000, end: 1_500_000 }, numPositions: 10, shares: parseEther('0.3') },
      { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') },
      { marketCap: { start: 4_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
    ]
  })
  .withVesting()
  .withGovernance()
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(userAddress)
  .build()
```

---

## Method Call Order Requirements

⚠️ **Important**: `withMarketCapRange()` requires certain methods to be called first.

### Static Auction

```
saleConfig() → withMarketCapRange()
```

`saleConfig()` provides:
- `numeraire` address (for token ordering auto-detection)
- `initialSupply` (for market cap calculations)

### Dynamic Auction

```
saleConfig() → poolConfig() → withMarketCapRange()
```

`poolConfig()` provides:
- `tickSpacing` (required for tick calculations)

### Multicurve

```
saleConfig() → withCurves()
```

Same as Static Auction - only `saleConfig()` required first.

---

## API Reference

### StaticAuctionMarketCapConfig

```ts
interface StaticAuctionMarketCapConfig {
  marketCap: { start: number; end: number };  // USD market cap range
  numerairePrice: number;                      // Numeraire price in USD
  tokenSupply?: bigint;                        // Override (defaults to initialSupply)
  tokenDecimals?: number;                      // Default: 18
  numeraireDecimals?: number;                  // Default: 18
  fee?: number;                                // Default: 10000 (1%)
  numPositions?: number;                       // Default: 15
  maxShareToBeSold?: bigint;                   // Default: 0.35e18 (35%)
}
```

### DynamicAuctionMarketCapConfig

```ts
interface DynamicAuctionMarketCapConfig {
  marketCap: { start: number; min: number };  // start = launch price, min = floor price
  numerairePrice: number;                      // Numeraire price in USD
  minProceeds: bigint;                         // Required: minimum ETH to graduate
  maxProceeds: bigint;                         // Required: maximum ETH cap
  tokenSupply?: bigint;                        // Override (defaults to initialSupply)
  tokenDecimals?: number;                      // Default: 18
  numeraireDecimals?: number;                  // Default: 18
  duration?: number;                           // Default: 7 days (604800)
  epochLength?: number;                        // Default: 1 hour (3600)
  gamma?: number;                              // Auto-calculated if not provided
  numPdSlugs?: number;                         // Default: 5
}
```

### MulticurveMarketCapCurvesConfig (withCurves)

```ts
interface MulticurveMarketCapCurvesConfig {
  numerairePrice: number;                      // Numeraire price in USD (e.g., 3000)
  curves: MulticurveMarketCapRangeCurve[];     // Market cap-based curves
  tokenSupply?: bigint;                        // Override (defaults to initialSupply)
  tokenDecimals?: number;                      // Default: 18
  numeraireDecimals?: number;                  // Default: 18
  fee?: number;                                // Default: 500 (0.05%)
  tickSpacing?: number;                        // Derived from fee if not provided
  beneficiaries?: BeneficiaryData[];           // Optional fee streaming recipients
}

interface MulticurveMarketCapRangeCurve {
  marketCap: {
    start: number;       // Start market cap in USD (launch price for first curve)
    end: number;         // End market cap in USD
  };
  numPositions: number;  // Number of LP positions
  shares: bigint;        // WAD-based share (e.g., parseEther('0.3') = 30%)
}
```

---

## Multicurve: Market Cap Range Curves

Multicurve uses `withCurves()` to define liquidity distributions using dollar-denominated market cap ranges - no tick math required.

### The Concept

Each curve specifies a market cap range (start and end in USD). The SDK converts these to the appropriate tick ranges automatically.

```
Curve 1: $500k - $1.5M market cap → tickLower/tickUpper calculated
Curve 2: $1M - $5M market cap → tickLower/tickUpper calculated
Curve 3: $4M - $50M market cap → tickLower/tickUpper calculated
```

### Key Rules

- **First curve's `marketCap.start`** = the launch price
- **Curves must be contiguous or overlapping** (no gaps allowed)
- **Shares must sum to exactly 1e18 (100%)**
- Overlapping curves provide extra liquidity at key thresholds

### Example: Three-Tier Distribution

```ts
.withCurves({
  numerairePrice: 3000,  // ETH = $3000
  curves: [
    // Launch curve (early buyers)
    { marketCap: { start: 500_000, end: 1_500_000 }, numPositions: 10, shares: parseEther('0.3') },
    
    // Mid-range with overlap at $1M-$1.5M
    { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 15, shares: parseEther('0.4') },
    
    // Upper range with overlap at $4M-$5M
    { marketCap: { start: 4_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.3') },
  ]
})
```

**Shares must sum to 1e18 (100%)**. The SDK validates this automatically.

---

## Static vs Dynamic: Key Differences

| Aspect | Static (V3) | Dynamic (V4) |
|--------|-------------|--------------|
| Format | `marketCap: { start, end }` | `marketCap: { start, min }` |
| Semantics | Price ascends from start to end | Dutch auction descends from start to min |
| Proceeds | Not configurable | `minProceeds`, `maxProceeds` required |
| Duration | N/A | `duration`, `epochLength` |
| Pre-requisite | `saleConfig()` only | `saleConfig()` + `poolConfig()` |
| Protocol | Uniswap V3 | Uniswap V4 Hook |

---

## Common Patterns

### Small Launch ($10k - $1M)

```ts
.withMarketCapRange({
  marketCap: { start: 10_000, end: 1_000_000 },
  numerairePrice: 3000,
})
```

### Medium Launch ($100k - $10M)

```ts
.withMarketCapRange({
  marketCap: { start: 100_000, end: 10_000_000 },
  numerairePrice: 3000,
})
```

### Large Launch ($1M - $100M)

```ts
.withMarketCapRange({
  marketCap: { start: 1_000_000, end: 100_000_000 },
  numerairePrice: 3000,
})
```

### With Different Numeraires

```ts
// ETH at $3000
.withMarketCapRange({
  marketCap: { start: 100_000, end: 10_000_000 },
  numerairePrice: 3000,
})

// USDC at $1
.saleConfig({ ..., numeraire: USDC_ADDRESS })
.withMarketCapRange({
  marketCap: { start: 100_000, end: 10_000_000 },
  numerairePrice: 1,
  numeraireDecimals: 6,  // USDC uses 6 decimals
})
```

---

## Validation & Error Handling

The SDK validates market cap configurations automatically:

### Errors (will throw)

- `saleConfig()` not called before `withMarketCapRange()` / `withCurves()`
- `poolConfig()` not called before `withMarketCapRange()` (Dynamic only)
- `start >= end` market cap
- Missing required fields (`minProceeds`/`maxProceeds` for Dynamic)
- Curve shares don't sum to exactly 1e18 (Multicurve)
- Gap between curves (Multicurve) - curves must be contiguous or overlapping

### Warnings (logged but allowed)

- Very small market caps (< $1000)
- Very large market caps (> $1B)
- Extreme price ratios (end/start > 10000x)

---

## Migration from Price-Based Methods

If you're currently using `poolByPriceRange()` or `auctionByPriceRange()`, here's how to migrate:

### Before (price-based)

```ts
.poolByPriceRange({
  priceRange: { startPrice: 0.0001, endPrice: 0.001 },
  fee: 3000
})
```

### After (market cap-based)

```ts
.withMarketCapRange({
  marketCap: { start: 100_000, end: 1_000_000 },  // Equivalent in USD
  numerairePrice: 3000,
})
```

The market cap approach is more intuitive because you're thinking in business terms ($100k to $1M) rather than token-per-ETH ratios.

---

## Understanding Tick Conventions (Advanced)

This section explains how the SDK converts market caps to ticks. You don't need to understand this for normal usage - the SDK handles everything automatically.

### The Math: Market Cap → Tick

The conversion follows these steps:

1. **Market Cap → Token Price**: `tokenPrice = marketCap / tokenSupply`
2. **Token Price → Ratio**: `ratio = numerairePrice / tokenPrice`
3. **Ratio → Tick**: `tick = log(ratio) / log(1.0001)`
4. **Transform**: SDK applies necessary transformations based on numeraire

### Auction Type Behavior

Each auction type has different price movement semantics:

| Type | Price Movement |
|------|---------------|
| Static (V3) | Ascending from start to end market cap |
| Dynamic (V4) | Descending from start to min market cap (Dutch auction) |
| Multicurve | Multiple curves across market cap ranges |

### Debugging Tips

If computed ticks seem wrong:

1. Check your `numerairePrice` is correct (e.g., ETH = ~$3000)
2. Verify `tokenSupply` matches your token configuration
3. For Dynamic auctions, remember `start > min` (descending)

Use `tickToMarketCap()` to reverse-check what market cap a tick represents.

---

## See Also

- [Builder API Reference](./api-builders.md) - Full builder documentation
- [Examples](../examples/) - Complete working examples:
  - `examples/static-auction-by-marketcap.ts`
  - `examples/dynamic-auction-by-marketcap.ts`
  - `examples/multicurve-by-marketcap.ts`


