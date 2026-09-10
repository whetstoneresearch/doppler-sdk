# Prediction SDK migration guide

This SDK targets the prediction-market refactor in `doppler-sol` commit
`8bac055` (PR #207). The prediction APIs and on-chain layouts are breaking
changes. Publish this work as an explicitly breaking release; applications
using the earlier prediction module must update before adopting it. The SDK
package version is intentionally unchanged until release coordination.

## API changes

| Earlier API or assumption                                      | Refactored API or behavior                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `getPredictionMarketAddress(oracle, quoteMint, programId?)`    | `getPredictionMarketAddress(oracle, quoteMint, creator, programId?)`                                                              |
| `getPredictionEntryAddress(market, entryId, programId?)`       | `getPredictionEntryAddress(market, baseMint, programId?)`                                                                         |
| `getPredictionEntryByMintAddress` / `EntryByMint`              | Removed; use the mint-derived `Entry` PDA                                                                                         |
| Oracle initialization includes a quote mint                    | Initialize with `nonce` and 2–8 unique, nonzero 32-byte `outcomeIds`                                                              |
| Finalize using a winning mint                                  | `getFinalizeInstruction({ …, winningOutcomeId })`; use an ID declared by the oracle                                          |
| First entry implicitly creates a market                        | Create the creator-owned market explicitly using `getCreateMarketInstructionAsync` before registration                            |
| Entry registration carries an entry ID and oracle              | Registration data contains `outcomeId`; oracle is an account                                                                      |
| Initializer builder auto-appends six prediction accounts       | The prediction workflow supplies registration accounts `oracle, market, entry` explicitly                                         |
| Same remaining accounts for registration, swaps, and migration | Registration: `oracle, market, entry`; buy hook: `oracle, market`; settlement: `oracle, market, potVault, marketAuthority, entry` |
| `migrateEntry` includes an argument struct                     | Instruction data is only its discriminator; settle through Initializer, which authorizes the CPI                                  |
| Claim includes `entryByMint`                                   | Removed; claims use 13 accounts; `prepareClaimAndClose` handles the revised ordering                                              |
| No void payout path                                            | `getRefundInstructionAsync` burns entry tokens for that entry's refund allocation                                                 |
| Mint-only payout preview                                       | Supply both `candidateWinnerMint` and canonical `candidateOutcomeId`                                                              |

Prefer the `predictionMarkets` workflow namespace for account derivation,
configuration validation, and lifecycle instructions. Generated clients remain
available under `predictionMigrator` and `trustedOracle` for advanced callers.
Do not call `registerEntry` or `migrateEntry` directly from an external wallet:
those paths require Initializer's launch-authority signer.

## Account state and deployment compatibility

Existing legacy oracle, market, and entry accounts cannot be reused as refactored
accounts. Their schemas changed, and markets and entries now use different PDA
seeds. Create a new oracle nonce, create the market for its creator and quote mint,
and register a launch for every declared outcome. A new market can share an
already-refactored, unfinalized oracle across creators and quote mints.

Fresh state is a development setup, **not a migration of existing balances**.
Do not reinterpret, overwrite, or abandon funded legacy accounts. Any legacy
fund recovery or conversion needs a separate protocol-supported plan.

The generated layouts are `OracleState` 339 bytes, `Market` 486 bytes, `Entry`
98 bytes, and `ClaimReceipt` 104 bytes. An account's byte length alone does not
prove compatibility: validate the owner, discriminator, relationships, and PDA.
`OracleState` is owned by Trusted Oracle even though its imported codec also
appears in the Prediction Migrator namespace.

Use a matching Trusted Oracle, Prediction Migrator, Prediction Hook, and
Initializer deployment. The checked-in generated program addresses use devnet
source defaults. Program-address overrides select SDK instruction targets;
they do not change fixed cross-program IDs compiled into deployed binaries.
Verify deployed artifacts and configuration before sending lifecycle transactions.

As of September 10, 2026, the upgraded devnet programs pass a simulation of the
new oracle initialization and explicit market creation. Independent reads confirm
SBPF v3 artifacts and the prediction allowlists; live Initializer fee policy is
625 bps protocol fee with 50–1000 bps swap bounds. This supersedes the earlier
failed ABI probe. Verification against those actual deployed binaries on a local
fork passed all six lifecycle scenarios, exact payout/refund assertions, and replay. Public-network transactions are outside this verification scope.
The live artifacts differ from the prepared candidate binaries, so this
is not an exact source-hash attestation. See the
[verification report](solana-prediction-verification.md) for the observed slots
and evidence boundaries. Default fork mode retains raw upstream snapshots and
loads the exact deployed ELF/padding without a protocol checkout or rebuild.
Only the local ProgramData deployment-slot field is normalized to zero for Agave
program-cache loading; authority, owners, balances, and config remain unchanged. Candidate
overlays require explicit `DOPPLER_PREDICTION_FORK_MODE=candidate` and the pinned
protocol/SBPF v3 build. Public-network execution and extension-wallet signing are
outside the fork proof. The upgrade does not convert legacy account layouts or
balances.

## Lifecycle changes for applications

Register all outcomes before enabling buys. Required prediction launch policy is
buy-only, with the required hook context and empty hook payload. An unfinalized
oracle permits indefinite trading; settlement does not depend on reaching a
curve graduation target.

Once the oracle authority finalizes a declared outcome, settle entries through
Initializer. A winning holder can claim after the winning entry settles and
harvest later settlement proceeds using `claim(0)`. Keep or recreate the outcome
ATA for later harvests. When the resolved winner has no surviving circulating
supply, the market is void and each settled entry's holders use burn-based refunds
instead of winner claims.

Curve prices across independent outcomes are not normalized probabilities.
Label currently claimable funds separately from estimated proceeds that require
future entry settlement.
