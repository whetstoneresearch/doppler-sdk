# Prediction-market SDK verification

The SDK has three complementary test layers: serialized-account unit tests,
source-built local-validator scenarios, and a local fork of deployed devnet
programs. Compilation or an ABI probe alone does not establish lifecycle behavior.

## Reproduce the checks

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm typecheck:solana-tests
pnpm typecheck:solana-examples
pnpm typecheck:prediction-tools
pnpm test:unit
pnpm test:solana
pnpm lint
pnpm format:check
pnpm build
pnpm exec tsx scripts/benchmark-solana-metadata-size.ts
pnpm test:solana:prediction:devnet-fork
```

The fork requires `solana`, `solana-keygen`, and `solana-test-validator` on
`PATH`. Its validator and sibling CLI must match the upstream runtime release
and feature-set identifier. CI installs Agave 4.3.0-rc.0; an upstream runtime
change requires updating that pin, not bypassing the check. An alternate
validator can be selected with `DOPPLER_PREDICTION_FORK_VALIDATOR`.

Optional fork settings are `SOLANA_DEVNET_RPC_URL`,
`DOPPLER_PREDICTION_FORK_RPC_PORT`, and an empty
`DOPPLER_PREDICTION_FORK_REPORT_DIR`. No funded wallet is required. The harness
creates ephemeral local signers and submits transactions only to localhost.

## Unit and integration coverage

Unit tests verify instruction account order, creator/oracle/outcome bindings,
registration and settlement recovery, buy-only trading, reserved-fee accounting,
claim/refund/harvest construction, and receipt validation. Quote regressions
cover fee collection during a read, snapshot trading flags, invalid launch
bindings, and the known-launch path without a program-account scan.

The lifecycle runner lives in `test/solana/integration/prediction/`. The four
standalone create/buy/resolve/claim files under `examples/` demonstrate public
SDK usage without embedding the scenario harness.

| Scenario | Execution assertions |
| --- | --- |
| Binary | Two outcomes; partial and final winning-token burns |
| Three outcomes | Complete registration and canonical outcome IDs |
| Eight outcomes | Maximum outcome count and complete bitmap |
| Shared oracle | Isolated creator-owned markets and two quote mints |
| Incremental settlement | Early claim followed by later `claim(0)` harvest |
| Void | Zero-holder winner and entry-specific losing-token refund |

All scenarios assert quote-token balance changes, burned balances, and final
market state. The runner also checks rejected buys before complete registration
and after finalization, rejected sells, unauthorized finalization, and completed
setup/workflow replay without additional lifecycle transactions.

## What the deployed fork preserves

Default `deployed` mode snapshots live Program/ProgramData accounts, Initializer
configuration, quote mints, and feature activations. It does not compile or
replace the deployed ELF. A fresh ledger cannot load the upstream historical
deployment slots reliably, so the local ProgramData deployment-slot field is
normalized to zero. ELF bytes and padding, upgrade authorities, account owners,
and configuration remain unchanged and are checked after execution.

Explicit local fixtures are SOL funding, a synthetic second quote-token account
without changing its mint supply, restoration of the native mint's snapshotted
lamports after validator genesis, and newly created application accounts. The
fork is not a claim of public-network execution, browser-wallet signing, or
perfect reproduction of features absent from the installed runtime's registry.

The report directory retains upstream snapshots, `fork-manifest.json`, scenario
logs and public manifests, `local-before.json`, and `local-verification.json`.
CI uploads logs and verification summaries, excluding ephemeral keys. Each run
records its deployed account hashes; live programs are not pinned to one binary.

## Source-built alternative and historical evidence

`pnpm test:solana:prediction:validator` builds programs from the clean protocol
revision pinned in its script, currently
`8bac0551f6e0f83a861f4822886d30a00095a22e` (doppler-sol PR #207). Set
`DOPPLER_SOL_SOURCE_DIR` to that checkout. Candidate-overlay fork mode is also
available explicitly via `DOPPLER_PREDICTION_FORK_MODE=candidate`; its builds
require Solana 4.1.0 and SBPF v3. Neither mode establishes that locally built
artifacts equal the deployed programs.

The previously recorded deployed-binary run at SDK revision `7bda05d` used
devnet snapshot slots 496311901/496311903, Agave 4.3.0-rc.0, and feature-set
2409014235. It passed six scenarios across eight markets with 98 lifecycle
transactions, plus setup/replay checks and unchanged-account verification.
That historical result is tied to its recorded revision, not automatically to
subsequent SDK edits. Current execution evidence belongs in each CI run and
PR verification summary.
