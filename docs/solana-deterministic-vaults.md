# Deterministic launch vaults

Solana launch helpers now use `initialize_launch_v2` by default. Both token vault addresses are PDAs derived from the launch account. `createLaunch`, the low-level `createInitializeLaunchInstruction`, vesting, Rehype, and prediction-market launch helpers use this default.

## Deployment prerequisite

The target initializer must support the **mint-derived** `initialize_launch_v2` argument format. The earlier V2 version accepts a caller-selected launch ID and is not compatible with this SDK default. Coordinate the protocol and SDK rollout; an existing V2 deployment or staged upgrade buffer alone does not establish support for this format.

Integrations using Hook V2 also need its updated launch-address validation. Rehype uses the router's new `initialize_rehype_v2` instruction; explicit legacy mode retains the original router instruction. No network deployment is performed by this SDK change.

Both network example suites load pinned initializer candidates into disposable local validators while cloning other network programs and configuration. The [fixture manifest](../test/solana/fixtures/initializer-v2/manifest.json) records their source revision and binary hashes. Passing these tests validates the candidates, not live deployment. The prediction lifecycle suite separately tests explicit legacy compatibility with deployed programs.

## Creating a launch

Keep the existing helper and omit both `launchId` and vault keypairs:

```ts
const prepared = await createLaunch({
  ...launchInput,
  launchAccounts: { baseMint, quoteMint },
});

const { baseVault, quoteVault } = prepared.addresses;
```

Use these returned addresses for later swaps, funding, and account lookups. Vesting and Rehype return them under `prepared.launchAddresses` and use the resolved base vault when composing vesting funding. `deriveCreateLaunchAddresses` also returns the canonical vault PDAs when addresses are needed before preparation.

The low-level `createInitializeLaunchInstruction(accounts, args, programId)` no longer takes `args.launchId`; omit `accounts.baseVault` and `accounts.quoteVault` to derive them. `createInitializeLaunchV2Instruction` remains available as an explicit alias for V2 behavior. Supplied vault overrides must match the canonical PDAs; unrelated keypair addresses are rejected rather than silently changing the destination.

Existing callers that generate vault keypairs must remove those inputs and use the returned PDAs, or explicitly select legacy mode. `namespace` remains optional grouping metadata and is not part of the V2 address. Prediction helpers still use the oracle as their namespace. The returned `launchId` is the base mint encoded as 32 bytes, matching the persisted account field; it is not an additional identifier to generate.

## Legacy compatibility

To create a launch against an older deployment, explicitly select the original instruction and provide both vault signers:

```ts
const prepared = await createLaunch({
  ...launchInput,
  vaultMode: 'legacy',
  launchAccounts: {
    baseMint,
    quoteMint,
    baseVault: baseVaultSigner,
    quoteVault: quoteVaultSigner,
  },
});
```

Vesting, Rehype, and prediction launch inputs accept the same `vaultMode` selection. Low-level callers can use `createInitializeLaunchLegacyInstruction`; the generated V1 instruction builders remain available. Returned launch addresses reflect the selected mode, including legacy vaults.

Existing launches are unaffected. Read their vault addresses from launch state rather than deriving V2 addresses for a launch created through V1.

## Address and IDL details

- Launch seeds: `['launch', baseMint]`; derive with `getLaunchV2Address(baseMint, programId)`. The mint must sign creation, preventing another mint from claiming the address.
- `getLaunchAddress(namespace, launchId)` continues to derive legacy addresses.
- Base vault seeds: `['base_vault', launch]` under the initializer program.
- Quote vault seeds: `['quote_vault', launch]` under the initializer program.
- Both vaults are writable nonsigners, eliminating two transaction signatures (128 bytes). Removing the caller ID saves another 32 instruction bytes.
- V2 includes the optional vesting-config account slot for every program ID, including custom deployments.

V1 vaults already used the launch-authority PDA as their token authority. V2 binds the launch to its mint and derives the token-account addresses. Vault authority still comes from the launch-authority PDA. Deterministic addresses make integration easier, but indexers and security providers may still need to recognize the vaults as protocol inventory.

The initializer and Rehype router IDLs are synchronized with the paired protocol change. Regenerate codecs with `pnpm generate:codecs`. Code generation preserves the SDK's existing `initializer` namespace even though the source IDL names the program `doppler_launch_markets_v1`.
