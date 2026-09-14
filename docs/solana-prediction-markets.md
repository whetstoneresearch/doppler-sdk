# Solana prediction markets

The `predictionMarkets` namespace prepares the complete lifecycle: create an oracle, create a creator-owned market, register an outcome launch for every oracle outcome, buy, finalize the oracle, settle entries, and claim winnings or void refunds. Builders return instructions; your wallet or transaction service owns signing and confirmation.

**Deployment status (September 10, 2026):** devnet now passes the new oracle-initialization and `create_market` ABI simulation. Independent RPC reads confirm all four program artifacts use SBPF v3 and the prediction hook/migrator are allowlisted. The earlier failed probe is superseded. The current verification target is the complete SDK lifecycle on a local fork of the actual deployed binaries and accounts. All six scenarios passed on that fork: 98 lifecycle transactions across eight markets, exact payouts/refunds, and replay without additional transactions. No funded public-network run is required. See the [verification report](solana-prediction-verification.md) for deployment slots, configuration, and artifact limits. Mainnet is not an example target; existing integrations should also read the [ABI migration guide](solana-prediction-migration.md).

## Start with concise SDK examples

These standalone examples use the public `predictionMarkets` helpers for each
step, following the same connection/signing pattern as `solana-minimal-launch.ts`.
They import the repository source for development; installed applications import
`predictionMarkets` from `@whetstone-research/doppler-sdk/solana`.

| Example | SDK helpers | Required action inputs |
| --- | --- | --- |
| [Create](../examples/solana-prediction-create.ts) | `prepareOracle`, `prepareMarket`, `prepareOutcomeLaunch` | None; prints market and YES/NO mint addresses |
| [Buy](../examples/solana-prediction-buy.ts) | `fetchPredictionBuyQuote`, `prepareBuy` | `SOLANA_PREDICTION_MARKET`, `SOLANA_PREDICTION_BASE_MINT`, `SOLANA_PREDICTION_AMOUNT_IN` |
| [Resolve and settle](../examples/solana-prediction-resolve.ts) | `prepareFinalize`, `prepareRemainingSettlements` | `SOLANA_PREDICTION_MARKET`, `SOLANA_PREDICTION_WINNER_INDEX` (0 = YES, 1 = NO) |
| [Claim or refund](../examples/solana-prediction-claim.ts) | `fetchPredictionMarket`, `prepareClaim`, `prepareRefund` | `SOLANA_PREDICTION_MARKET`, `SOLANA_PREDICTION_BURN_AMOUNT`; void refunds also need `SOLANA_PREDICTION_BASE_MINT` |

Set `SOLANA_NETWORK=devnet` (or `custom` with `SOLANA_RPC_URL` and
`SOLANA_WS_URL`) and `SOLANA_KEYPAIR_PATH` to a funded tester signer. Use the
matching prediction deployments and allowlists described below. The creator must
differ from the protocol fee beneficiary. Run a file with:

```bash
pnpm exec tsx examples/solana-prediction-create.ts
```

Then use its printed addresses to run buy, resolve, and claim in order with the
inputs above. Each file submits transactions. Creation starts a new market on
each run; use the resumable scenario runner below when you need persisted recovery.
Buy amounts are raw quote units (10,000,000 = 0.01 SOL for these WSOL markets);
burn amounts are raw outcome units (1,000,000 = one token at six decimals).
The buy helper wraps SOL and prepares token accounts. Finalization uses the
oracle authority signer; after finalization anyone can run settlement. Claims
use the participant signer and pay WSOL. A zero burn harvests later proceeds
from an existing winning claim; void refunds require a positive burn and a
settled entry. Buy a winning outcome before resolution for the normal payout
flow; resolving an outcome with no circulating supply produces a void market.

The larger runner below provides scenario assertions, manifests, and replay
verification; these focused examples show the SDK calls needed by an integrator.

## Run the full example collection

```bash
npx --yes pnpm@10.11.0 install --frozen-lockfile
npx --yes pnpm@10.11.0 typecheck:solana-examples
npx --yes pnpm@10.11.0 exec tsx scripts/check-prediction-deployment.ts
```

The validator harness builds matching program artifacts from a clean protocol checkout, bootstraps Initializer configuration, funds disposable test signers, and runs the scenarios. Consult `scripts/run-solana-prediction-validator.sh` for the pinned protocol revision and harness prerequisites (`solana`, `solana-keygen`, `solana-test-validator`, `spl-token`, Cargo/SBF, and Node). It writes signatures and state assertions to its output; passing compile checks alone is not execution evidence.

Run it with the path to the clean protocol checkout:

```bash
DOPPLER_SOL_SOURCE_DIR=/path/to/doppler-sol bash scripts/run-solana-prediction-validator.sh
```

## Verify against a devnet fork

The default fork mode snapshots the actual devnet Program and ProgramData
accounts without replacing their binaries, together with current configuration,
quote mints, and feature activations. It runs the six SDK scenarios on a local
ledger using a separately pinned validator runtime matching the observed devnet
release. No protocol checkout or build is needed in this mode, and no transaction
is submitted to public devnet.

```bash
PATH="$HOME/.local/share/solana/install/releases/4.3.0-rc.0/solana-release/bin:$PATH" \
DOPPLER_PREDICTION_FORK_VALIDATOR="$HOME/.local/share/solana/install/releases/4.3.0-rc.0/solana-release/bin/solana-test-validator" \
bash scripts/run-solana-prediction-devnet-fork.sh
```

Install the official runtime in the shown location, or adjust the path. The
harness refuses a validator whose reported release or feature-set identifier
differs from the devnet snapshot. The sibling `solana` executable supplies the
matching runtime feature registry. The original upstream Program/ProgramData
snapshots are retained. On the local ledger, only the eight-byte ProgramData
deployment-slot field is normalized to zero to avoid Agave program-cache loading
failures with cloned historical slots. Deployed ELF bytes and padding, upgrade
authority, account owners and balances, and the Initializer configuration remain
unchanged. The run records this normalization and local funding fixtures, verifies
payouts/refunds, and compares preserved state after
execution. See the [verification report](solana-prediction-verification.md) for the completed
deployed-binary run and separately recorded historical candidate runs.

To test an un-deployed candidate deliberately, opt into candidate mode. This
requires a clean protocol checkout at `8bac0551f6e0f83a861f4822886d30a00095a22e`
and the explicit Solana 4.1.0 / SBPF v3 compiler:

```bash
PATH="$HOME/.local/share/solana/install/releases/4.1.0/solana-release/bin:$PATH" \
DOPPLER_PREDICTION_FORK_MODE=candidate \
DOPPLER_PREDICTION_FORK_VALIDATOR="$HOME/.local/share/solana/install/releases/4.3.0-rc.0/solana-release/bin/solana-test-validator" \
DOPPLER_SOL_SOURCE_DIR=/path/to/clean/doppler-sol \
bash scripts/run-solana-prediction-devnet-fork.sh
```

SDK CI runs source, example, and browser checks in this repository. Keep this
temporary fork verification outside the program repository; it does not require
a protocol CI change or an organization admin grant. Record deployed account
hashes and the SDK revision for deployed mode, and the protocol revision and build
artifacts for candidate mode. Public-network transaction execution and browser
extension-wallet signing are outside the fork proof. A green SDK build alone is
not fork execution proof.

## Connect to an existing validator

For an already running matching validator:

```bash
export SOLANA_NETWORK=custom
export SOLANA_RPC_URL=http://127.0.0.1:8899
export SOLANA_WS_URL=ws://127.0.0.1:8900
export SOLANA_KEYPAIR_PATH="$HOME/.config/solana/doppler-tester.json"
npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts --scenario binary --manifest /tmp/prediction-binary.json
```

The signer pays transaction/account rent and spends 10,000,000 raw quote units on every purchased outcome (0.01 SOL with the default WSOL mint). For a custom mint, convert that raw amount using its decimals when funding the signer. A custom SPL Token quote mint can be selected with `SOLANA_PREDICTION_QUOTE_MINT`; fund the signer's quote ATA first. WSOL is the default and is wrapped automatically for buys. Payout assertions inspect WSOL token balances, not native SOL after transaction fees.

All four programs must use their matching compiled IDs; arbitrary runtime ID substitution is rejected. The Initializer configuration must allowlist the prediction hook and prediction migrator. The example creator is a fee beneficiary and must differ from the protocol fee beneficiary. No Metaplex deployment is required: CLI outcome launches use `metadata: null`.

| Scenario | Command flag | Assertions and behavior |
| --- | --- | --- |
| Binary | `--scenario binary` | Two launches, buys, resolution, every settlement, partial then final winner burns; exact payouts match the accounting preview |
| Multiple outcomes | `--scenario multi` | Three distinct canonical IDs; registration bitmap includes every outcome |
| Maximum outcome count | `--scenario eight` | Eight launches; complete bitmap equals 255 |
| Shared oracle | `--scenario shared` | Two distinct creators share one oracle and quote mint; a third market uses the first creator and a second quote mint; all have separate PDAs/pots |
| Incremental settlement | `--scenario incremental` | Settle winner first, burn and claim, settle losers, harvest with `claim(0)` |
| Void refunds | `--scenario void` | Buy only NO, resolve YES with no circulating tokens, settle, burn NO for its entry-specific refund |

Use a separate manifest per scenario. `shared` additionally requires `SOLANA_SECOND_CREATOR_KEYPAIR_PATH` pointing to a distinct funded signer and `SOLANA_SECOND_QUOTE_MINT` naming a different classic SPL mint funded in the primary participant’s ATA. The validator harness provisions these fixtures. No keypair is written to the manifest. Payouts are checked against `previewClaim` or `previewRefund`, including exact quote deltas and token burns. The full run also simulates rejected buys before complete registration and after finalization, rejected sells, and unauthorized oracle finalization.

## Execute individual actions and resume

```bash
npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts --action setup --manifest /tmp/my-market.json
npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts --action inspect --manifest /tmp/my-market.json
npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts --action buy --manifest /tmp/my-market.json
npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts --action resolve --manifest /tmp/my-market.json
npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts --action settle --manifest /tmp/my-market.json
npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts --action claim --manifest /tmp/my-market.json
```

`inspect` is read-only and needs no signer. Change `SOLANA_KEYPAIR_PATH` for participant `buy`/`claim`; oracle finalization requires the original oracle authority. Settlement is permissionless. Keep `--scenario` identical when resuming non-binary manifests.

The public manifest records ledger genesis hash, program IDs, nonce, oracle, creators, mints, launches, entries, and confirmed transaction signatures. Writes are atomic. Setup saves pending launch addresses before submission and checks them on-chain on restart; settlement skips already settled entries. Buy checks its recorded receipt and current token balance before submitting. Claims use the current token balance and harvest existing receipt entitlements when that balance is zero. Do not delete the manifest to retry: that deliberately starts a new oracle/market. After resetting a validator, use a new manifest because the old ledger state no longer exists.

This is a sequential example runner, not a concurrent transaction job queue. A production sender should durably save the signed transaction and signature before broadcast, reconcile ambiguous confirmations, and coordinate concurrent actors. Manifest recovery checks cannot reconstruct a lost confirmation receipt if the process stopped immediately after broadcast; on-chain account state remains authoritative. Never blindly replay a buy after a timeout.

## Integrate the SDK

```ts
import { predictionMarkets } from '@whetstone-research/doppler-sdk/solana';

const oraclePlan = await predictionMarkets.prepareOracle({
  oracleAuthority: walletSigner,
  nonce: BigInt(Date.now()),
  outcomeIds: [yesId, noId], // each exactly 32 bytes, distinct and nonzero
});
const marketPlan = await predictionMarkets.prepareMarket({
  creator: walletSigner,
  oracle: oraclePlan.oracle,
  quoteMint,
});
// Confirm oraclePlan, then marketPlan, using your transaction sender.
```

`prepareOutcomeLaunch` accepts the ordinary launch supply, curve, token accounts, metadata, and fee beneficiaries under `launch`. It enforces buy-only trading, all supply on the curve, required prediction hook flags, empty hook payload, and the registration and settlement account commitments. Use a unique launch ID for each creator/outcome. The canonical outcome ID is oracle-global; its associated token mint is market-local.

`prepareBuy` takes launch accounts, oracle, market, amount in, and minimum amount out. `quoteBuy` computes an XYK exact-input estimate with ceiling-rounded fees and slippage. Supply current curve reserves **after excluding unclaimed fees**. Refresh immediately before building a transaction; `minAmountOut` protects execution if state moves. Use `fetchPredictionBuyQuote` to fetch validated mint/vault state and calculate net reserves from current fee accounting; the CLI uses this helper.

```ts
const view = await predictionMarkets.fetchPredictionMarket(rpc, marketAddress);
console.log(view.status.phase, view.status.missingOutcomeIndexes);
const owned = await predictionMarkets.listPredictionMarkets(rpc, { creator });
const sameEvent = await predictionMarkets.listPredictionMarkets(rpc, { oracle });
```

`fetchPredictionMarketWithLaunches` recovers launch addresses and settlement accounts from a market address, so applications do not need a saved CLI manifest. `prepareMissingOutcomeLaunches(rpc, { market, outcomes })` validates the supplied creator, oracle, quote mint, and outcome IDs, then returns plans only for unregistered outcomes. `prepareRemainingSettlements(rpc, { market, payer })` skips settled entries and places the winner first; confirm each returned plan separately and refetch before retrying. `fetchPredictionClaimReceipt` reads a holder's existing burned entitlement and reward debt for `previewClaim` or later harvests.

An oracle is reusable across independent creators and quote mints. `assertReusableOracle` checks that its immutable outcome list matches and it is unfinalized. A creator can create one market per `(oracle, quoteMint, creator)` PDA. Every oracle outcome must be registered before any buy. Markets can trade indefinitely while the oracle remains unfinalized; no fundraising threshold or timer forces settlement.

## Resolve, settle, and pay holders

Only the oracle authority can call `prepareFinalize`, supplying a canonical winning outcome ID. This freezes buys. Call `prepareSettlement` through Initializer for each entry; do not use the CPMM migration helper. Settlement burns unsold inventory and transfers each entry's net quote contribution into the market pot. Although the on-chain compatibility instruction is called `migrate_launch`, the product action here is settlement.

In a non-void market the winning entry fixes the claimable supply. `prepareClaim` burns some or all of the holder's winning tokens and records that burned entitlement. `fetchPotentialPayoutIfWinner(rpc, { market, candidateMint, tokenAmount })` estimates a registered outcome holder’s payout if it wins using current fee-excluded vault balances. It returns `isEstimate: true` and does not include future buys or receipt reward debt. `previewClaim` returns currently claimable quote from the pot as it exists now. When later entries settle and increase the pot, `prepareHarvest` issues `claim(0)` to withdraw the incremental entitlement without another burn. It recreates an empty outcome ATA when needed. A preview is not a promise about future contributions.

If the winner has zero surviving circulating supply, the market is void. `prepareRefund` burns a holder's entry tokens for that entry's contribution share. This is not a division of the entire pot across all losing tokens. `previewRefund` needs current mint supply and entry state: intermediate burns round down, and the final burn receives the remaining entry contribution. Normal winner claims are unavailable for void markets.

Independent outcome curve prices are **not normalized probabilities** and need not sum to one. Show token amounts, quote amounts, and the distinction between current claimable funds and estimates explicitly.

## Wallet integration and support

The builders accept Solana Kit `TransactionSigner` values and return instructions; they do not import a Node keypair loader. Browser applications should use their connected wallet signer, show the action and quote, prepare the transaction with a recent blockhash, sign/send with their wallet adapter, and reconcile confirmation before refreshing the account view. Keep oracle authority, market creator, transaction fee payer, and participant roles visible. Run the [browser wallet example](../examples/solana-prediction-browser/README.md) for an interactive walkthrough: import the CLI public manifest, connect a Wallet Standard wallet, inspect markets, buy, resolve, settle, and claim/refund.

High-level helpers currently support the classic SPL Token program. Token-2022 support is deliberately not inferred from Initializer mint acceptance: extension behavior must be verified across hook, settlement, burn, and payout paths first. Low-level generated clients remain available for separately verified integrations.
