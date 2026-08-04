# Building a Custom Solana Hook

Use the SDK's low-level Solana builders when a launch needs a hook program other
than Doppler launch hook v1. The high-level `createLaunch` helper intentionally
uses the canonical Doppler hook and does not accept an arbitrary program.

The smallest complete callback is in
[`examples/solana-custom-hook`](../examples/solana-custom-hook/). It is a
stateless Anchor program that accepts every action without changing fees.

## Callback ABI

The Initializer and CPMM invoke a raw entrypoint named `hook`. The instruction
data has no Anchor instruction discriminator. It starts with this 102-byte,
Borsh-encoded context:

```rust
pub struct HookContextV1 {
    pub action: u8,
    pub trade_direction: u8,
    pub amount_in: u64,
    pub amount_out: u64,
    pub reserve0: u64,
    pub reserve1: u64,
    pub swap_fee_bps: u16,
    pub fee_split_bps: u16,
    pub trunc_price0_q64: u128,
    pub deviation0_q64: u128,
    pub trunc_price1_q64: u128,
    pub deviation1_q64: u128,
}
```

All integers use little-endian Borsh encoding. The field offsets are:

| Bytes | Field |
| --- | --- |
| `0` | `action` |
| `1` | `trade_direction` |
| `2..10` | `amount_in` |
| `10..18` | `amount_out` |
| `18..26` | `reserve0` |
| `26..34` | `reserve1` |
| `34..36` | `swap_fee_bps` |
| `36..38` | `fee_split_bps` |
| `38..54` | `trunc_price0_q64` |
| `54..70` | `deviation0_q64` |
| `70..86` | `trunc_price1_q64` |
| `86..102` | `deviation1_q64` |

The action values depend on the caller:

| Value | Initializer | CPMM |
| --- | --- | --- |
| `0` | before swap | before swap |
| `1` | after swap | after swap |
| `2` | before create | before add liquidity |
| `3` | after create | after add liquidity |
| `4` | before migrate | before remove liquidity |
| `5` | after migrate | after remove liquidity |

For Initializer swaps, direction `0` is quote to base and direction `1` is
base to quote. `reserve0` is the quote reserve and `reserve1` is the base
reserve. CPMM directions and reserves refer to token 0 and token 1 instead.

Initializer appends the launch's `hookPayload` after byte 102 on every callback.
CPMM does not append a generic payload. A before-create Initializer hook may
append a replacement payload to its return data; the Initializer stores that
payload for later callbacks. A launch using create hooks can store at most 224
payload bytes.

## Return Data

Set Solana program return data to exactly 32 bytes:

| Bytes | Meaning |
| --- | --- |
| `0` | allow: `0` rejects, `1` allows |
| `1` | reserved, write `0` |
| `2..4` | swap fee override in basis points, little-endian `u16` |
| `4..6` | fee split override in basis points, little-endian `u16` |
| `6..32` | reserved, write zeroes |

Use `initializer.HOOK_NO_CHANGE` (`0xffff`) for either override when the hook
does not change it. Initializer requires a valid response for every enabled
callback. CPMM requires one for before-actions; returning the same valid result
for every action is simpler and safer.

Overrides apply only to the current invocation and are not stored. Initializer
uses the swap fee override from its before-swap callback; it currently ignores
the fee split override. CPMM uses both fields from its before-swap callback and
caps them to its configured maxima and 10,000 basis points. Fee overrides
returned from other actions do not affect pool state.

Only Initializer's before-create callback may return more than 32 bytes. Any
suffix becomes the replacement launch payload and must be no more than 224
bytes.

## Accounts And Commitments

The hook program receives only the accounts forwarded by its caller. Treat
every forwarded account as untrusted and validate its address, owner, signer
status, writable status, and relationships before using it.

Initializer launch accounts are committed by address at creation:

```text
keccak256(u32_account_count_le || account_0 || account_1 || ...)
```

Use `initializer.computeRemainingAccountsHash` rather than encoding this
yourself. The same addresses must be supplied in the same order on preview,
swap, and migration calls. Runtime hook accounts must be readonly. Readonly
signers are allowed only when `HF_FORWARD_READONLY_SIGNERS` is set. For swap and
preview callbacks, a non-empty list must start with the launch namespace when
that namespace is non-default.

Create callbacks have a separate account list. Pass it as
`hookCreateRemainingAccounts`; the low-level builder derives its count and hash.
Signer objects in this list are forwarded as readonly signers.

CPMM does not use address commitments. It always forwards the CPMM config and
pool, then an optional oracle, followed by filtered remaining accounts. The
hook program account must be present in the CPMM instruction's remaining
accounts, but CPMM removes it before invoking the callback. Signers are filtered
unless the pool enables readonly-signer forwarding, and protocol-sensitive
accounts are not forwarded.

## Initializer Wiring

The following uses the existing low-level builders. `launchAccounts` and
`launchArgs` stand for the ordinary non-hook fields required by
`initialize_launch`.

```typescript
import { address, type Address } from '@solana/kit';
import { initializer } from '@whetstone-research/doppler-sdk/solana';

const hookProgram = address('REPLACE_WITH_YOUR_HOOK_PROGRAM_ID');
const runtimeHookAccounts: Address[] = [launchNamespace];

const initializeInstruction = await initializer.createInitializeLaunchInstruction(
  {
    ...launchAccounts,
    hookProgram,
    hookCreateRemainingAccounts: [],
  },
  {
    ...launchArgs,
    hookFlags: initializer.HF_BEFORE_SWAP,
    hookPayload: new Uint8Array(),
    hookRemainingAccountsHash:
      initializer.computeRemainingAccountsHash(runtimeHookAccounts),
  }
);
```

Pass the identical runtime list when previewing or executing a swap:

```typescript
const previewInstruction = initializer.createPreviewSwapExactInInstruction(
  {
    ...previewAccounts,
    hookProgram,
    remainingAccounts: runtimeHookAccounts,
  },
  { amountIn, tradeDirection }
);

const swapInstruction = initializer.createCurveSwapExactInInstruction(
  {
    ...swapAccounts,
    hookProgram,
    remainingAccounts: runtimeHookAccounts,
  },
  { amountIn, minAmountOut, tradeDirection }
);
```

For an enabled hook that needs no runtime accounts, commit
`initializer.EMPTY_REMAINING_ACCOUNTS_HASH` and pass an empty list. Do not use a
32-byte zero value: zero means that no swap or migration hook is enabled.

When migration hooks are enabled, append remaining accounts to the low-level
`migrate_launch` instruction in this order:

```text
[hook_program, committed_hook_accounts..., migrator_accounts...]
```

## Deployment Checklist

1. Replace the example's `declare_id!` and build it with `cargo build-sbf`.
2. Test every enabled action, malformed payload, missing account, wrong owner,
   wrong signer, and explicit rejection path.
3. Have the protocol administrator allowlist the deployed program in the
   Initializer and, if needed, CPMM config. Deploying a hook does not approve it.
4. Build launch instructions with the deployed program ID, flags, payload, and
   account commitments.
5. Simulate create, preview, swap, and migration flows before using the hook in
   production.
