# Multicurve Fees

This guide covers reading pending fees and claiming fees for multicurve launches
that use lockable beneficiaries.

## Supported Scope

The SDK currently supports pending-fee previews for one or many initializer-side
multicurve pools in `Locked` status. It also supports claims for a single locked
multicurve pool through `MulticurvePool.collectFees()`. These are typically
multicurve launches created with `pool.beneficiaries` and
`withMigration({ type: 'noOp' })`.

The SDK does not currently support pending-fee previews or claiming for migrated
multicurve launches. Once a multicurve pool is in `Exited` status, calls to
`MulticurvePool.getPendingFees()`, `MulticurveFees.getPendingFees()`, and
`MulticurvePool.collectFees()` will throw.

## Setup

Use the launched token address, also called the asset address in the contracts,
to create a `MulticurvePool` instance when you are working with one pool or
claiming fees.

```typescript
import {
  DopplerSDK,
  LockablePoolStatus,
} from '@whetstone-research/doppler-sdk/evm';
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  chain: base,
  transport: http(process.env.RPC_URL),
  account,
});

const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: base.id,
});

const assetAddress = process.env.ASSET_ADDRESS as Address;
const pool = await sdk.getMulticurvePool(assetAddress);

const state = await pool.getState();
if (state.status !== LockablePoolStatus.Locked) {
  throw new Error('Multicurve fee claiming is only supported for locked pools');
}
```

`getPendingFees()` uses Multicall3. The viem chain attached to your public
client must have a configured `chain.contracts.multicall3.address`.

## Retrieve Pending Fees For One Token

Call `getPendingFees(beneficiary)` with the address whose claimable balance you
want to preview.

```typescript
const beneficiary = account.address;
const pendingFees = await pool.getPendingFees(beneficiary);

console.log('Pending token0 fees:', pendingFees.fees0);
console.log('Pending token1 fees:', pendingFees.fees1);
```

The returned `fees0` and `fees1` are the beneficiary's pending share of the
pool's token0 and token1 fees. Token ordering follows the pool key:

```typescript
const state = await pool.getState();
console.log('token0:', state.poolKey.currency0);
console.log('token1:', state.poolKey.currency1);
```

`getPendingFees()` is read-only. Internally it uses a Multicall3 aggregate to
simulate `collectFees(poolId)` and read the beneficiary's shares and cumulative
fee checkpoints. It does not send a transaction or update on-chain state.

The method can return zero when the address is not a configured beneficiary,
when no new fees have accrued, or when fees were already claimed.

## Retrieve Pending Fees For Multiple Tokens

Use `MulticurveFees` when you need pending fees for several multicurve tokens in
one request path. The entity accepts multiple launched token addresses and
returns one pending-fee result per token.

`MulticurveFees` takes a wallet client for constructor compatibility, but it only
reads pending fees today. Claims still go through `MulticurvePool.collectFees()`.

```typescript
import { MulticurveFees } from '@whetstone-research/doppler-sdk/evm';
import type { Address } from 'viem';

const tokenAddresses = [
  process.env.ASSET_ADDRESS_1 as Address,
  process.env.ASSET_ADDRESS_2 as Address,
];

const multicurveFees = new MulticurveFees(
  publicClient,
  walletClient,
  tokenAddresses,
);

const pendingFeesByToken =
  await multicurveFees.getPendingFees(beneficiaryAddress);

for (const pendingFees of pendingFeesByToken) {
  console.log('Asset:', pendingFees.tokenAddress);
  console.log('Pending token0 fees:', pendingFees.fees0);
  console.log('Pending token1 fees:', pendingFees.fees1);
}
```

By default, `MulticurveFees.getPendingFees(beneficiary)` builds one multicall for
all token addresses passed to the constructor. Each token contributes six calls
to that multicall.

If an RPC provider rejects large multicalls because of simulation gas ceilings,
pass `tokenBatchSize` to limit how many tokens are included per multicall. The
batch size is token-based, so the SDK never splits one token's six fee reads
across different multicalls.

```typescript
const multicurveFees = new MulticurveFees(
  publicClient,
  walletClient,
  tokenAddresses,
  { tokenBatchSize: 25 },
);

const pendingFeesByToken =
  await multicurveFees.getPendingFees(beneficiaryAddress);
```

You can also provide token addresses per call. This is useful for frontends that
load token pages incrementally and do not know the full token list when the
entity is created.

```typescript
const multicurveFees = new MulticurveFees(publicClient, walletClient, []);

const pendingFeesByToken = await multicurveFees.getPendingFees(
  beneficiaryAddress,
  nextPageTokenAddresses,
  { tokenBatchSize: 25 },
);
```

Results are returned in the same order as the token addresses requested. Each
result includes `tokenAddress`, `fees0`, and `fees1`.

## Claim Fees

To claim fees, call `collectFees()` from a wallet client whose `account` is the
beneficiary that should receive the payout.

```typescript
const before = await pool.getPendingFees(account.address);
console.log('Claimable token0:', before.fees0);
console.log('Claimable token1:', before.fees1);

const receipt = await pool.collectFees();
console.log('Transaction:', receipt.transactionHash);
console.log('Newly collected token0 fees:', receipt.fees0);
console.log('Newly collected token1 fees:', receipt.fees1);
```

Any account can call `collectFees()`, but only a configured beneficiary caller
receives their pending share. Calling from a non-beneficiary can still collect
pool fees into the initializer, but it does not claim a beneficiary payout for
that caller.

The `fees0` and `fees1` returned by `collectFees()` are the newly collected pool
fees reported by the contract. They are not necessarily the caller's beneficiary
payout. Use `getPendingFees(account.address)` before claiming, or compare token
balances before and after the transaction, when you need the expected payout for
the caller.

## Common Errors

- `Wallet client required to collect fees`: initialize `DopplerSDK` with a
  `walletClient` before calling `collectFees()`.
- `Multicall3 address is not configured on this chain`: use a viem chain config
  that includes `contracts.multicall3.address`, or add it to your custom chain.
- `Multicurve pool is not locked or was migrated`: the pool is not in `Locked`
  status. The SDK only supports initializer-side locked pool fee claims.
- `Pending fee preview is only supported for initializer-side multicurve pools`:
  one of the requested pools has exited/migrated. Migrated multicurve launch fee
  claiming is not currently supported by the SDK.
- `tokenBatchSize must be a positive integer`: pass a whole number greater than
  zero, or omit `tokenBatchSize` to include all requested tokens in one multicall.

See [examples/multicurve-get-pending-fees.ts](../examples/multicurve-get-pending-fees.ts)
for a runnable multi-token pending-fee script and
[examples/multicurve-collect-fees.ts](../examples/multicurve-collect-fees.ts)
for a runnable claim script.
