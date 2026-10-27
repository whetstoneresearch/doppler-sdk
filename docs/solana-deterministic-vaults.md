# Deterministic launch vaults

Solana launch helpers now use `initialize_launch_v2` by default. Both token vault addresses are PDAs derived from the launch account. `createLaunch`, the low-level `createInitializeLaunchInstruction`, vesting, Rehype, and prediction-market launch helpers use this default.

## Deployment prerequisite

The target initializer must support `initialize_launch_v2` before using this SDK default. Devnet was upgraded to protocol revision `44d4135` on October 19, 2026, at slot `513029425`; SPL Token and Token-2022 launches through the SDK default were confirmed on-chain. Mainnet was upgraded on October 22, 2026; its deployed program matches the V2 build of the same revision.

Both example fork suites copy the deployed initializer and other network programs directly, so they test V2 against what each network runs. The prediction lifecycle suite separately tests deployed-program compatibility with explicit legacy launches.

## Creating a launch

Keep the existing helper and omit vault keypairs:

```ts
const prepared = await createLaunch({
  ...launchInput,
  launchAccounts: { baseMint, quoteMint },
});

const { baseVault, quoteVault } = prepared.addresses;
```

Use these returned addresses for later swaps, funding, and account lookups. Vesting and Rehype return them under `prepared.launchAddresses` and use the resolved base vault when composing vesting funding. `deriveCreateLaunchAddresses` also returns the canonical vault PDAs when addresses are needed before preparation.

The low-level `createInitializeLaunchInstruction(accounts, args, programId)` keeps its name and arguments; omit `accounts.baseVault` and `accounts.quoteVault` to derive them. `createInitializeLaunchV2Instruction` remains available as an explicit alias for V2 behavior. Supplied vault overrides must match the canonical PDAs; unrelated keypair addresses are rejected rather than silently changing the destination.

Existing callers that generate vault keypairs must remove those inputs and use the returned PDAs, or explicitly select legacy mode. Other launch settings, hook payloads, remaining accounts, and lifecycle behavior are unchanged.

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

- Base vault seeds: `['base_vault', launch]` under the initializer program.
- Quote vault seeds: `['quote_vault', launch]` under the initializer program.
- Both vaults are writable nonsigners, eliminating two transaction signatures (128 signature bytes).
- V2 includes the optional vesting-config account slot for every program ID, including custom deployments.

V1 vaults already used the launch-authority PDA as their token authority. V2 changes the token-account addresses, not who controls the tokens. Deterministic addresses make integration easier, but indexers and security providers may still need to recognize the vaults as protocol inventory.

The initializer IDL is synchronized with `doppler-sol` revision `44d4135`. Regenerate codecs with `pnpm generate:codecs`. Code generation preserves the SDK's existing `initializer` namespace even though the source IDL names the program `doppler_launch_markets_v1`.
