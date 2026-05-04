# Migration Options Guide

The SDK encodes post‑auction liquidity migration via a discriminated union `MigrationConfig`:

```ts
export type MigrationConfig =
  | { type: 'uniswapV2' }
  | {
      type: 'uniswapV2Split'
      proceedsSplit?: { recipient: Address; share: bigint }
    }
  | {
      type: 'uniswapV4'
      fee: number
      tickSpacing: number
      streamableFees?: {
        lockDuration: number // seconds
        beneficiaries: { beneficiary: Address; shares: bigint }[] // shares in WAD
      }
    }
  | {
      type: 'uniswapV4Split'
      fee: number
      tickSpacing: number
      streamableFees: {
        lockDuration: number // seconds
        beneficiaries: { beneficiary: Address; shares: bigint }[] // shares in WAD
      }
      proceedsSplit?: { recipient: Address; share: bigint }
    }
  | { type: 'noOp' }
```

Internally, the factory resolves the on‑chain migrator address for your chain and ABI‑encodes the specific data shape required by that migrator.

## When to choose which

- Uniswap V2
  - Simple constant‑product pool; broad ecosystem tooling
  - No price range configuration; least complexity
  - Good default if you do not require V3/V4‑specific features

- Uniswap V4
  - Pools with hooks; optionally supports fee streaming via `StreamableFeesLocker`
  - Choose when you want programmable fee distribution to beneficiaries, and V4 infra is available on your chain

- Uniswap V2 Split
  - Uses `UniswapV2MigratorSplit`
  - Adds proceeds-split support plus automatic `TopUpDistributor` pull-up during migration
  - Good when a recipient should receive part of migration proceeds and any accumulated top-ups

- Uniswap V4 Split
  - Uses `UniswapV4MigratorSplit`
  - Adds V4 locker beneficiaries plus optional proceeds split and top-up support
  - Requires `streamableFees` because the split migrator always configures locker beneficiaries

## V2 Migration

```ts
.withMigration({ type: 'uniswapV2' })
```

- Encoded data: empty (`0x`)
- Migrator address resolved per chain (see `src/addresses.ts`)

## V2 Split Migration

```ts
.withMigration({
  type: 'uniswapV2Split',
  proceedsSplit: {
    recipient: '0xRecipient...',
    share: parseEther('0.1'),
  },
})
```

- Encoded data: `(recipient:address, share:uint256)`
- `share` is in WAD and capped onchain at `0.5e18` (50%)
- If `proceedsSplit` is omitted, the SDK still selects the split migrator but encodes a zero recipient / zero share
- The split recipient also receives any `TopUpDistributor` funds pulled during migration

## V4 Migration (streamable fees)

```ts
.withMigration({
  type: 'uniswapV4',
  fee: 3000,
  tickSpacing: 60,
  streamableFees: {
    lockDuration: 365 * 24 * 60 * 60, // 1 year
    beneficiaries: [
      { beneficiary: '0x...', shares: parseEther('0.95') },
      { beneficiary: '0xAirlockOwner...', shares: parseEther('0.05') },
    ],
  },
})
```

- Encoded data:
  - `(fee:uint24, tickSpacing:int24, lockDuration:uint32, beneficiaries: (address, shares[WAD])[])`
  - The SDK sorts beneficiaries by address (ascending) as required by the contract
- Validation:
  - If `streamableFees` is provided: at least one beneficiary, all shares must be positive, total shares must sum to `1e18`
  - Contract enforces: airlock owner must receive at least 5% of streamed fees (add as a beneficiary if applicable)
- Chain support:
- Ensure `streamableFeesLocker` and `v4Migrator` are deployed on your target chain (see `src/addresses.ts`)

## V4 Split Migration

```ts
.withMigration({
  type: 'uniswapV4Split',
  fee: 3000,
  tickSpacing: 8,
  streamableFees: {
    lockDuration: 30 * 24 * 60 * 60,
    beneficiaries: [
      { beneficiary: '0xAirlockOwner...', shares: parseEther('0.05') },
      { beneficiary: '0xTeam...', shares: parseEther('0.95') },
    ],
  },
  proceedsSplit: {
    recipient: '0xRecipient...',
    share: parseEther('0.1'),
  },
})
```

- Encoded data:
  - `(fee:uint24, tickSpacing:int24, lockDuration:uint32, beneficiaries:(address,shares[WAD])[], proceedsRecipient:address, proceedsShare:uint256)`
- Validation:
  - `streamableFees` is required
  - At least one beneficiary, all shares positive, total shares equal `1e18`
  - `proceedsSplit.share` is capped at `0.5e18` when provided
- Runtime behavior:
  - The split recipient receives the configured share of numeraire proceeds during migration
  - The same recipient also receives any `TopUpDistributor` funds pulled for the asset/numeraire pair
  - Locker positions remain managed by the split migrator; the SDK does not directly configure `TopUpDistributor` or lockers beyond migration params

## Top-ups for Split Migrators

- The SDK exposes `sdk.topUpDistributor` and `sdk.getTopUpDistributor(address?)` for building, simulating, and submitting `topUp({ asset, numeraire, amount })` where `getAddresses(chainId).topUpDistributor` is configured. The same object shape is used by `buildTopUpTransaction({ asset, numeraire, amount })` and `simulateTopUp({ asset, numeraire, amount })`.
- ETH top-ups use `numeraire = ZERO_ADDRESS` and send `value = amount`; ERC20 top-ups send no native value and require prior approval for the `TopUpDistributor` to transfer `amount`.
- The split migrator automatically pulls top-up funds for the asset/numeraire pair to the split recipient when migration executes.

## Governance Selection

- Required: You must call `withGovernance(...)` in the builders.
- Standard governance: Call `withGovernance({ type: 'default' })`, or pass `{ type: 'custom', initialVotingDelay, initialVotingPeriod, initialProposalThreshold }`.
- No‑op governance: Call `withGovernance({ type: 'noOp' })`. The SDK throws if the chain’s `noOpGovernanceFactory` is not deployed and you didn’t override the governance factory address.
- Launchpad governance: Call `withGovernance({ type: 'launchpad', multisig })` in the builders.

## Address Resolution

Migrator contracts are selected per chain via `getAddresses(chainId)` (see `src/addresses.ts`).

- `v2Migrator`, `v2MigratorSplit`, `v4Migrator`, and `v4MigratorSplit` must be present for the chosen type
- Some optional contracts (`streamableFeesLocker`, `topUpDistributor`) may be `0x0` or undefined on certain chains — avoid split flows or fee streaming where not supported. Using no‑op governance requires the chain’s `noOpGovernanceFactory` or providing a governance factory override.

## Quick Decision Guide

- Want simplest path and immediate trading? Use V2
- Want split proceeds plus top-up pull-up on a V2 pool? Use V2 Split
- Want programmable fee streaming to beneficiaries and are on a V4‑ready chain? Use V4
- Want V4 fee streaming plus proceeds split / top-up support? Use V4 Split
