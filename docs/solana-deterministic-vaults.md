# Deterministic Initializer vaults

`initializer.createInitializeLaunchV2Instruction` creates base and quote curve vault PDAs with seeds `["base_vault", launch]` and `["quote_vault", launch]` under the selected Initializer program. It derives both vault addresses, accepts optional matching addresses, and rejects mismatches. The vaults are writable nonsigners; the mint and payer still sign. This requires an Initializer deployment with `initialize_launch_v2` support.

```ts
const instruction = await initializer.createInitializeLaunchV2Instruction(
  accounts, // same accounts as V1; baseVault and quoteVault may be omitted
  args,     // same launch arguments as V1
  programId,
);
```

For `createLaunch` or `feeRehypothecation.prepareLaunch`, opt in with `vaultMode: 'deterministic'` and supply the derived addresses in `launchAccounts`:

```ts
const [launch] = await initializer.getLaunchAddress(namespace, launchId, programId);
const [[baseVault], [quoteVault]] = await Promise.all([
  initializer.getBaseVaultAddress(launch, programId),
  initializer.getQuoteVaultAddress(launch, programId),
]);
const prepared = await createLaunch({
  ...launchInput,
  programId,
  namespace,
  launchId,
  vaultMode: 'deterministic',
  launchAccounts: { ...launchInput.launchAccounts, baseVault, quoteVault },
});
```

Legacy builders and the default `vaultMode: 'legacy'` keep the original discriminator and vault signer requirements. Switch callers only after upgrading the target Initializer program. The V2 path includes the vesting account placeholder under custom program IDs as well as the default deployment.

Existing launches are not converted. For swaps, claims, vesting, Rehype and migration, always use `Launch.baseVault` and `Launch.quoteVault` from the decoded on-chain state. The account and event layouts are unchanged; deriving V2 addresses for a legacy launch would produce the wrong vaults. No changes to external indexers' classification heuristics are implied.

V2 removes 128 signature bytes from an otherwise equivalent inline transaction. Its vault keys are also eligible for address lookup tables. Metadata and other instruction data still count toward Solana's transaction size limit.
