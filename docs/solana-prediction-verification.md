# Prediction-market SDK verification

Protocol reference: `whetstoneresearch/doppler-sol` commit
`8bac0551f6e0f83a861f4822886d30a00095a22e` (merged PR #207).
SDK starting point: `ef8e083aedb3421b4985850aa64e6f9fec47e9cb`.

## Deployment boundary

The September 10, 2026 post-upgrade devnet probe passed both the new
`initialize_oracle` arguments (two canonical outcomes) and `create_market`, with
`simulationError: null`. This supersedes the earlier same-day probe that found
the old oracle interpretation and Anchor `InstructionFallbackNotFound` (101).
Neither probe signed or broadcast a transaction.

Independent RPC inspection at 19:55:32 UTC, context slots 496308540–496308555,
recorded these live deployments:

| Program | Deployment slot | ELF version |
| --- | --- | --- |
| Trusted Oracle | 496291801 | SBPF v3 |
| Prediction Migrator | 496291924 | SBPF v3 |
| Prediction Hook | 496292025 | SBPF v3 |
| Initializer | 496287029 | SBPF v3 |

All four are executable upgradeable programs at the SDK's expected addresses.
Initializer config `A9DojSvj32PMTTGctEcWZu9GSKuQVEhPkBXxDxmYu34o` includes the
prediction migrator and hook in its existing two-migrator/eight-hook allowlists.
Its protocol fee is 625 bps and permitted swap fees are 50–1000 bps.

The live ELF hashes differ from the separately prepared candidate artifacts.
The binaries embed different compiler-host paths, and some section lengths also
differ. These observations show differing build inputs; they do not establish an
exact source revision match or prove that build-host differences explain every
byte. The pinned source revision below describes the tested candidate artifacts,
not an independently proven source hash for the live deployments.

The requested verification target is creation through payouts using the actual
deployed binaries on a local devnet fork. That run passed all six scenarios. No funded
public-network lifecycle is required for this task. ABI simulation and
program/config inspection alone do not establish the full fork lifecycle. Fresh
compatible account state is still required; see
[the migration guide](solana-prediction-migration.md).

Local evidence:

- `/tmp/doppler-prediction-new-devnet-probe.log`
- `/tmp/doppler-live-prediction-verification/program-verification.json`
- `/tmp/doppler-live-prediction-verification/initializer-config.json`

Repeat the read-only probe with:

```sh
pnpm prediction:check-deployment
```

## Completed deployed-binary fork (September 10, 2026)

The tested SDK code matches `7bda05d`. The run snapshotted devnet accounts and
features at slot **496311901**, and ProgramData at **496311903**. All six
scenarios passed: **98 lifecycle transactions across eight markets**. Lookup-table
setup transactions are additional and recorded in scenario logs. Binary setup
and completed-workflow replay added no lifecycle transactions.

| Scenario | Lifecycle transactions | Payout in raw quote units |
| --- | ---: | --- |
| Binary | 11 | 9,900,000 + 9,900,000 |
| Three outcomes | 13 | 29,700,000 |
| Eight outcomes | 28 | 79,200,000 |
| Shared oracle, two creators and two quote mints | 26 | 19,800,000 in each of three markets |
| Incremental settlement | 11 | 9,900,000 + 9,900,000 later harvest |
| Void refund | 9 | 9,900,000 |

The suite checks actual quote-token balance changes, burned tokens, final market
state, and expected rejection errors. The final verification at local slot
**970** rechecked all four deployed binaries, original upgrade authorities,
Initializer config, and both quote mints. Independent byte comparison confirmed
that only bytes within the ProgramData deployment-slot field changed; ELF bytes
and all allocation padding remain identical to the upstream snapshots.

Agave **4.3.0-rc.0** and feature-set identifier **2409014235** matched devnet.
All **253** runtime-recognized active features matched. The **70** active feature
account IDs absent from that runtime registry are recorded separately; this is
not a claim that the local validator reproduces every aspect of the public cluster.

```sh
PATH="$HOME/.local/share/solana/install/releases/4.3.0-rc.0/solana-release/bin:$PATH" \
DOPPLER_PREDICTION_FORK_VALIDATOR="$HOME/.local/share/solana/install/releases/4.3.0-rc.0/solana-release/bin/solana-test-validator" \
DOPPLER_PREDICTION_FORK_RPC_PORT=19219 \
bash scripts/run-solana-prediction-devnet-fork.sh
```

Evidence is retained under `doppler-prediction-devnet-fork.CIrM3k` in the local
temporary directory: original upstream accounts, normalized genesis snapshots,
`fork-manifest.json`, `local-before.json`, `local-verification.json`, six public
scenario manifests/logs, and replay logs. Full output:
`/tmp/doppler-sdk-deployed-devnet-fork-verified.log`.

No protocol source or locally rebuilt binary was used. SOL funding, the synthetic
second quote-token balance, native-mint balance restoration, and fresh application
state exist only on the disposable local ledger. Public-network transactions and
extension-wallet signing are outside this SDK fork proof.

## Test-typecheck status

The prediction regression helpers now accept Kit's `ReadonlyUint8Array` codec
output type. This fixes six test type errors reported by CI; the remote Unit Tests
check passed at `7bda05d`. Local full test typechecking still reports unrelated EVM/Vitest
diagnostics; prediction-tool and example typechecks pass.

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
PATH=/Users/z80/.cache/doppler-agave-3.1.8/solana-release/bin:$PATH \
DOPPLER_SOL_SOURCE_DIR=/Users/z80/dev/doppler-sol-sdk-validation \
DOPPLER_PREDICTION_RPC_PORT=19019 \
bash scripts/run-solana-prediction-validator.sh > /tmp/doppler-sdk-prediction-final-harness.log 2>&1
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

## Temporary fork verification

The SDK workflow runs source, example and tool checks plus the browser build.
Default deployed mode retains the original raw upstream Program/ProgramData
snapshots and requires no protocol checkout or compiler. Local loading normalizes
only the eight-byte ProgramData deployment-slot field to zero. The first attempt
with original historical slots hit Agave `ProgramCacheHitMaxLimit` despite a
validator warp. This metadata adjustment preserves the deployed ELF and padding
bytes, upgrade authority, account owners and balances, and Initializer config;
it does not rebuild or replace the deployed binary. The deployed-binary run passed all six scenarios and final preservation checks. Candidate mode is an explicit opt-in using
`DOPPLER_PREDICTION_FORK_MODE=candidate`, a clean pinned protocol checkout, and
Solana 4.1.0 / SBPF v3 builds. Keep both forms of temporary verification outside
the program repository; no protocol workflow is required for this SDK check.

A temporary Linux run also passed all six scenarios at SDK commit
`2616b642ca3d8c44efa2953e5c2ba8235dd92a9b` and protocol commit
`8bac0551f6e0f83a861f4822886d30a00095a22e`:
[retained execution evidence](https://github.com/whetstoneresearch/doppler-sol/actions/runs/34516311537).
The proposed protocol workflow PR was closed without merging and its remote
branch deleted. That historical run is evidence, not an ongoing CI dependency.
The original cross-repository GitHub App requirement has also been removed.

The September 10 devnet upgrades and successful ABI probe supersede the earlier
deployment deferral. The historical candidate-overlay runs below did not upgrade
public devnet or make existing prediction accounts layout-compatible. They must
not be represented as runs against the actual deployed binaries. The new default
deployed mode preserves those binaries and authority/configuration, with only the
documented local ProgramData deployment-slot normalization. Its proof
will cover execution on the local fork; public-network transactions and browser
extension-wallet signing remain outside that proof.

## Historical candidate-overlay devnet-fork execution

The six scenarios completed against a devnet account/feature fork captured at
slot **496278573**, with 98 confirmed application transactions across eight
markets. Completed binary setup and full-workflow replay sent no additional
application transactions. Exact payouts match the scenario table above.

The source remained pinned to `8bac0551f6e0f83a861f4822886d30a00095a22e`.
Builds used Agave 4.1.0 / platform-tools v1.54 / SBPF v3. The local validator
used **4.3.0-rc.0**, matching devnet's reported runtime and compiled feature-set
identifier **2409014235**. All **253 runtime-recognized active features** matched.
The snapshot also records 70 active feature-account IDs absent from that same
runtime's registry; they are not presented as independently verified runtime
behavior.

Before and after the workflows, the harness verified all four loaded ProgramData
ELF hashes against the candidate artifacts and compared the Initializer config
and WSOL/USDC mint accounts by owner, lamports, executable flag, data length and
SHA-256. The live config was preserved: admin unchanged, protocol fee 625 bps,
swap bounds 50–1000 bps, and the existing two migrators/eight hooks allowlisted.
No local config bootstrap or admin substitution was used.

Explicit local fixtures: ephemeral SOL-funded signers; a new USDC ATA with
1,000,000,000 raw test units while preserving the real mint account; restoration
of the snapshotted WSOL mint SOL balance after the validator's built-in genesis
normalization; and candidate-program upgrade authority assigned to the local
genesis signer. Fresh oracle/market/launch/receipt state was created by SDK
transactions. No transaction was submitted to public devnet.

Run artifacts are retained locally under `doppler-prediction-devnet-fork.3gvGBc`:
`fork-manifest.json`, upstream snapshots, scenario manifests/signatures, per-case
logs, and `local-verification.json`. The complete output is
`/tmp/doppler-sdk-prediction-devnet-fork.log`. Use the command in the prediction
market guide to reproduce with separately installed compiler and runtime.

Browser fee-policy regression: the walkthrough previously hard-coded a zero
swap fee. It now exposes a fee field defaulting to 100 bps, within the cloned
50–1000 bps bounds. A visible browser created oracle/market state and confirmed
registration on the retained fork at market
`9addHX5MNXhgayULMeHNoX1K2J9EgF16CuEfRM5ykJG3`, launch
`6Knfgd5zsNK7JgrFfhEVs9mcay5zv5koN5ZgzsxkdpAL`, signature
`hKLaZFd9N4hNmQy2opnk41KaPKjFzMukJsVVupX3KFhDvMBYS4iYrBt5XYcgrn7HWfr374KpPMjq5NV1ZpyLkEt`.
The browser build, source formatting, lint and prediction-tool typecheck passed.
