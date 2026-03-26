import { describe, expect, it } from 'vitest';
import { address } from '@solana/addresses';
import { generateKeyPairSigner } from '@solana/signers';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { initializer, cpmmMigrator } from '@/solana/index.js';

const SYSVAR_RENT_PUBKEY = address('SysvarRent111111111111111111111111111111111');

describe('initializer instructions', () => {
  it('builds initializeConfig with programData account in the correct position', async () => {
    const admin = await generateKeyPairSigner();
    const [config] = await initializer.getConfigAddress();
    const [programData] = await initializer.getProgramDataAddress();

    const ix = initializer.createInitializeConfigInstruction(
      {
        admin,
        config,
        programData,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
      },
      {
        migratorAllowlist: [],
        sentinelAllowlist: [],
      },
    );

    expect(ix.programAddress).toBe(initializer.INITIALIZER_PROGRAM_ID);
    expect(ix.accounts).toHaveLength(4);
    expect(ix.accounts![0].address).toBe(admin.address);
    expect(ix.accounts![1].address).toBe(config);
    expect(ix.accounts![2].address).toBe(programData);
    expect(ix.accounts![3].address).toBe(SYSTEM_PROGRAM_ADDRESS);
    expect((ix.accounts![0] as { signer?: unknown }).signer).toBeDefined();
  });

  it('builds initializeLaunch with correct account ordering (authority + migrator)', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const namespace = admin.address;
    const launchId = initializer.launchIdFromU64(1n);
    const migratorProgram = cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID;

    const [config] = await initializer.getConfigAddress();
    const [launch] = await initializer.getLaunchAddress(namespace, launchId);
    const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);

    const migratorInitCalldata = cpmmMigrator.encodeRegisterLaunchCalldata({
      cpmmConfig: address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL'),
      initialSwapFeeBps: 30,
      initialFeeSplitBps: 5000,
      recipients: [{ wallet: admin.address, amount: 700_000n }, { wallet: admin.address, amount: 0n }],
      minRaiseQuote: 500_000n,
      minMigrationPriceQ64Opt: null,
    });

    const migratorMigrateCalldata = cpmmMigrator.encodeMigrateCalldata({
      baseForDistribution: 700_000n,
      baseForLiquidity: 300_000n,
    });

    const ix = initializer.createInitializeLaunchInstruction(
      {
        config,
        launch,
        launchAuthority,
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
        payer: admin,
        authority: admin,
        migratorProgram,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        rent: SYSVAR_RENT_PUBKEY,
      },
      {
        namespace,
        launchId,
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 700_000n,
        baseForLiquidity: 300_000n,
        curveVirtualBase: 200_000n,
        curveVirtualQuote: 200_000n,
        curveFeeBps: 100,
        curveKind: 0,
        curveParams: new Uint8Array([0]),
        allowBuy: 1,
        allowSell: 1,
        sentinelProgram: SYSTEM_PROGRAM_ADDRESS,
        sentinelFlags: 0,
        sentinelCalldata: new Uint8Array(),
        migratorProgram,
        migratorInitCalldata,
        migratorMigrateCalldata,
        sentinelRemainingAccountsHash: new Uint8Array(32),
        migratorRemainingAccountsHash: new Uint8Array(32),
        metadataName: '',
        metadataSymbol: '',
        metadataUri: '',
      },
    );

    expect(ix.programAddress).toBe(initializer.INITIALIZER_PROGRAM_ID);
    expect(ix.accounts).toHaveLength(13);

    // Account ordering: config, launch, launchAuthority, baseMint, quoteMint, baseVault, quoteVault, payer,
    // then optional authority, optional migratorProgram, then token/system/rent.
    expect(ix.accounts![0].address).toBe(config);
    expect(ix.accounts![1].address).toBe(launch);
    expect(ix.accounts![2].address).toBe(launchAuthority);
    expect(ix.accounts![3].address).toBe(baseMint.address);
    expect(ix.accounts![4].address).toBe(quoteMint);
    expect(ix.accounts![5].address).toBe(baseVault.address);
    expect(ix.accounts![6].address).toBe(quoteVault.address);
    expect(ix.accounts![7].address).toBe(admin.address);
    expect(ix.accounts![8].address).toBe(admin.address);
    expect(ix.accounts![9].address).toBe(migratorProgram);
    expect(ix.accounts![10].address).toBe(TOKEN_PROGRAM_ADDRESS);
    expect(ix.accounts![11].address).toBe(SYSTEM_PROGRAM_ADDRESS);
    expect(ix.accounts![12].address).toBe(SYSVAR_RENT_PUBKEY);

    // Ensure signer metas were attached for the signer accounts.
    for (const idx of [3, 5, 6, 7]) {
      const meta = ix.accounts![idx] as { signer?: unknown };
      expect(meta.signer).toBeDefined();
    }

  });

  it('rejects initializeLaunch when curve kind is not currently enabled', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const namespace = admin.address;
    const launchId = initializer.launchIdFromU64(2n);

    const [config] = await initializer.getConfigAddress();
    const [launch] = await initializer.getLaunchAddress(namespace, launchId);
    const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);

    expect(() =>
      initializer.createInitializeLaunchInstruction(
        {
          config,
          launch,
          launchAuthority,
          baseMint,
          quoteMint,
          baseVault,
          quoteVault,
          payer: admin,
          authority: admin,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
          systemProgram: SYSTEM_PROGRAM_ADDRESS,
          rent: SYSVAR_RENT_PUBKEY,
        },
        {
          namespace,
          launchId,
          baseDecimals: 6,
          baseTotalSupply: 1_000_000n,
          baseForDistribution: 700_000n,
          baseForLiquidity: 300_000n,
          curveVirtualBase: 200_000n,
          curveVirtualQuote: 200_000n,
          curveFeeBps: 100,
          curveKind: 1,
          curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
          allowBuy: 1,
          allowSell: 1,
          sentinelProgram: SYSTEM_PROGRAM_ADDRESS,
          sentinelFlags: 0,
          sentinelCalldata: new Uint8Array(),
          migratorProgram: address('11111111111111111111111111111111'),
          migratorInitCalldata: new Uint8Array(),
          migratorMigrateCalldata: new Uint8Array(),
          sentinelRemainingAccountsHash: new Uint8Array(32),
          migratorRemainingAccountsHash: new Uint8Array(32),
          metadataName: '',
          metadataSymbol: '',
          metadataUri: '',
        },
      ),
    ).toThrow(/unsupported curve kind/);
  });
});
