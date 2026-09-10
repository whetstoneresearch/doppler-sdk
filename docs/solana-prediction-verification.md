# Prediction-market SDK verification

Protocol reference: `whetstoneresearch/doppler-sol` commit
`8bac0551f6e0f83a861f4822886d30a00095a22e` (merged PR #207).
SDK starting point: `ef8e083aedb3421b4985850aa64e6f9fec47e9cb`.

## Deployment boundary

A read-only public devnet probe on September 10, 2026 confirmed that the deployed
programs do **not** implement the new prediction ABI:

- Trusted Oracle deployment slot: `467226409` (June 5, 2026).
- Prediction Migrator deployment slot: `467226465` (June 5, 2026).
- Prediction Hook deployment slot: `467226521` (June 5, 2026).
- Initializer deployment slot: `486266634` (August 21, 2026).
- Simulated new `initialize_oracle` arguments were interpreted by the old program
  as a quote mint; the next `create_market` instruction failed with Anchor
  `InstructionFallbackNotFound` (101).

The probe did not sign or broadcast a transaction. Run it again with:

```sh
pnpm prediction:check-deployment
```

A successful probe verifies only the oracle/market creation ABI, not hook policy,
allowlists, trading, settlement, or payouts. Full lifecycle execution is required
before claiming deployment readiness. The new market and oracle layouts require
fresh compatible accounts; see [the migration guide](solana-prediction-migration.md).

## Existing test-typecheck baseline

`pnpm typecheck:test` reports 43 identical TypeScript diagnostic lines on the
pristine SDK starting point and the working branch. They concern existing EVM
tests and Vitest configuration. This update does not introduce those diagnostics.
Source, prediction-tool, and example typechecks are tracked separately; this
baseline does not waive new Solana type errors.

## Verification results

The following commands passed locally (pnpm 10.11.0):

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm typecheck:solana-examples` | Passed |
| `pnpm typecheck:prediction-tools` | Passed |
| `pnpm build` | ESM, CJS, and declarations passed |
| `pnpm test:unit` | 1,005 tests passed |
| `pnpm test:solana` | 225 tests across 28 files passed |
| `pnpm test:solana:prediction:validator` | All six scenarios and completed replay assertions passed |
| `pnpm lint` | Zero errors and warnings |
| `pnpm format:check` | Passed |
| `pnpm generate:codecs` | All generated files unchanged after regeneration |
| Browser example `npm run build` | Passed |
| Protocol `just test-prediction-migrator` | 73 passed |
| Protocol `just test-initializer` | 351 passed |
| Protocol `cargo test -p trusted_oracle -p prediction_hook --tests` | 24 passed |

The protocol recipes used isolated v1.53/v0 SBF builds, appropriate for the
local validator. These are not v3 devnet deployment artifacts.

The full shell harness completed successfully against the clean pinned source:

```sh
DOPPLER_SOL_SOURCE_DIR=/Users/z80/dev/doppler-sol-sdk-validation \
DOPPLER_PREDICTION_RPC_PORT=19019 \
npx --yes pnpm@10.11.0 test:solana:prediction:validator
```

Agave 3.1.8 was on `PATH`. The harness rebuilt all four programs using platform
tools v1.53 / SBPF v0, bootstrapped a fresh ledger, and retained public manifests
and artifact hashes under `doppler-prediction-validator.8oSWqo`.

Six executable scenarios passed against source-built programs on a disposable
local validator: binary, three outcomes, eight outcomes, shared oracle,
incremental settlement, and void refunds. They confirmed 98 application
transactions across eight markets. Tests assert exact payout deltas, expected
program rejection errors, and complete registration. Completed setup and
completed binary workflow replay added zero application transactions.

| Scenario | Verified quote payout (raw units) |
| --- | --- |
| Binary | 9,900,000 partial + 9,900,000 final |
| Three outcomes | 29,700,000 |
| Eight outcomes | 79,200,000 |
| Shared oracle | 19,800,000 per market; two creators and two quote mints |
| Incremental settlement | 9,900,000 claim + 9,900,000 later `claim(0)` |
| Void | 9,900,000 entry refund |

### Browser transaction proof

A visible browser ran the real local-validator workflow with an in-memory,
local-only test signer: oracle creation, market creation, two registrations
using address lookup tables, two buys, oracle finalization, winner settlement,
early claim, loser settlement, and later harvest.

- Market: `AsTmEAVtkBbRScJK2QviTmRmFpGvvbyWeMax8j65uiTh`
- Claim: `47tujoABAztUJFFu4ngXwszkvhJwCKG6SwMvkCMEnAiE5P14R49eErGenMy67LBodem8H6pum9njapvosGvpEL7h`
- Harvest: `3H56jeCNshP7W2kxwZKy4sexjnpUCTtQWDjF7PaG2SnnFxxGsoQoYDju1qwQB2WgUt4f3uLcDQnJ7Wk3fcupUxSw`
- Independent RPC readback: total pot = total claimed = recipient quote balance
  = 2,000,000; pot vault balance = 0; receipt reward debt = 2,000,000.
- Reloaded browser showed all outcomes settled and the pot fully paid; buy
  preview rejected the finalized oracle.

A second visible browser workflow finalized an unpurchased outcome, settled both
entries into the void state, previewed the refund, and refunded the purchased
outcome:

- Market: `9DZfKkoEDiikzwSLBKZrHR4oVGLUD8h33vGkBcXYEP6h`
- Refund: `3t42HMyBX5o4MzUTv1L8tw7zkd1L6QUSytRuusSGmp6kzMAqDW6huBF2nWuKBLiHTHv1zroHSo93ENPSNFpNsauZ`
- Preview: burning 2,997,002,997,002 outcome units returns 1,000,000 quote units.
- Independent RPC readback: total pot = total claimed = recipient quote balance
  = 1,000,000; pot vault balance = 0.

These signatures belong to an ephemeral local ledger and cannot be looked up
on a public explorer. Browser extension-wallet signing remains distinct from
the verified local test signer path. Local-validator results do not establish
live devnet compatibility.

## Remote CI access requirement

[PR #203](https://github.com/whetstoneresearch/doppler-sdk/pull/203) runs the
new validator workflow. Its first run failed before checkout: the existing SDK
GitHub App could not access the private `whetstoneresearch/doppler-sol` repository
(`GET /repos/whetstoneresearch/doppler-sol/installation` returned 404).
An organization app administrator must add that repository to the existing app
installation, then rerun the job. The workflow requests only `contents: read` and
checks out the pinned protocol commit. No user credentials were copied into CI.
This is a remote verification blocker; local validation does not substitute for
a successful Linux CI run.
