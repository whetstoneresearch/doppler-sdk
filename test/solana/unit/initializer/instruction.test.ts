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
        hookAllowlist: [],
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
    const cpmmConfig = address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL');

    const [config] = await initializer.getConfigAddress();
    const [launch] = await initializer.getLaunchAddress(namespace, launchId);
    const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
    const [feeLocker] = await initializer.getFeeLockerAddress(launch);

    const migratorInitPayload = cpmmMigrator.encodeRegisterLaunchPayload({
      cpmmConfig,
      initialSwapFeeBps: 30,
      initialFeeSplitBps: 5000,
      recipients: [{ wallet: admin.address, amount: 700_000n }, { wallet: admin.address, amount: 0n }],
      minRaiseQuote: 500_000n,
      minMigrationPriceQ64Opt: null,
      migratedPoolHookConfig: null,
    });

    const migratorMigratePayload = cpmmMigrator.encodeMigratePayload({
      baseForDistribution: 700_000n,
      baseForLiquidity: 300_000n,
    });

    const ix = await initializer.createInitializeLaunchInstruction(
      {
        config,
        launch,
        launchAuthority,
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
        feeLocker,
        payer: admin,
        authority: admin,
        migratorProgram,
        cpmmConfig,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
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
        allowBuy: true,
        allowSell: true,
        hookProgram: SYSTEM_PROGRAM_ADDRESS,
        hookFlags: 0,
        hookPayload: new Uint8Array(),
        migratorInitPayload,
        migratorMigratePayload,
        hookRemainingAccountsHash: new Uint8Array(32),
        migratorInitRemainingAccountsHash: new Uint8Array(32),
        migratorRemainingAccountsHash: new Uint8Array(32),
        metadataName: '',
        metadataSymbol: '',
        metadataUri: '',
        feeBeneficiaries: [{ wallet: baseMint.address, shareBps: 9500 }],
      },
    );

    expect(ix.programAddress).toBe(initializer.INITIALIZER_PROGRAM_ID);
    // 14 required/static accounts + hook and metadata placeholders +
    // 2 auto-appended CPMM migrator remaining accounts:
    // cpmmMigrationState and cpmmConfig.
    expect(ix.accounts).toHaveLength(20);

    // Account ordering: config, launch, launchAuthority, baseMint, quoteMint, baseVault, quoteVault, feeLocker, payer,
    // then optional authority, optional hookProgram, optional migratorProgram,
    // then base/quote token, system/rent, optional metadata placeholders, then auto-appended
    // cpmmMigrationState and cpmmConfig.
    expect(ix.accounts![0].address).toBe(config);
    expect(ix.accounts![1].address).toBe(launch);
    expect(ix.accounts![2].address).toBe(launchAuthority);
    expect(ix.accounts![3].address).toBe(baseMint.address);
    expect(ix.accounts![4].address).toBe(quoteMint);
    expect(ix.accounts![5].address).toBe(baseVault.address);
    expect(ix.accounts![6].address).toBe(quoteVault.address);
    expect(ix.accounts![7].address).toBe(feeLocker);
    expect(ix.accounts![8].address).toBe(admin.address);
    expect(ix.accounts![9].address).toBe(admin.address);
    expect(ix.accounts![10].address).toBe(initializer.INITIALIZER_PROGRAM_ID);
    expect(ix.accounts![11].address).toBe(migratorProgram);
    expect(ix.accounts![12].address).toBe(TOKEN_PROGRAM_ADDRESS);
    expect(ix.accounts![13].address).toBe(TOKEN_PROGRAM_ADDRESS);
    expect(ix.accounts![14].address).toBe(SYSTEM_PROGRAM_ADDRESS);
    expect(ix.accounts![15].address).toBe(SYSVAR_RENT_PUBKEY);
    expect(ix.accounts![16].address).toBe(initializer.INITIALIZER_PROGRAM_ID);
    expect(ix.accounts![17].address).toBe(initializer.INITIALIZER_PROGRAM_ID);
    const [expectedCpmmMigratorState] = await cpmmMigrator.getCpmmMigratorStateAddress(launch);
    expect(ix.accounts![18].address).toBe(expectedCpmmMigratorState);
    expect(ix.accounts![19].address).toBe(cpmmConfig);

    // Ensure signer metas were attached for the signer accounts.
    for (const idx of [3, 5, 6, 8]) {
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
    const [feeLocker] = await initializer.getFeeLockerAddress(launch);

    await expect(
      initializer.createInitializeLaunchInstruction(
        {
          config,
          launch,
          launchAuthority,
          baseMint,
          quoteMint,
          baseVault,
          quoteVault,
          feeLocker,
          payer: admin,
          authority: admin,
          baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
          quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
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
          allowBuy: true,
          allowSell: true,
          hookProgram: SYSTEM_PROGRAM_ADDRESS,
          hookFlags: 0,
          hookPayload: new Uint8Array(),
          migratorInitPayload: new Uint8Array(),
          migratorMigratePayload: new Uint8Array(),
          hookRemainingAccountsHash: new Uint8Array(32),
          migratorInitRemainingAccountsHash: new Uint8Array(32),
          migratorRemainingAccountsHash: new Uint8Array(32),
          metadataName: '',
          metadataSymbol: '',
          metadataUri: '',
          feeBeneficiaries: [{ wallet: baseMint.address, shareBps: 9500 }],
        },
      ),
    ).rejects.toThrow(/unsupported curve kind/);
  });

  it('builds claimFeeLocker with correct account ordering', async () => {
    const beneficiary = await generateKeyPairSigner();
    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const launch = address('3ev4CeaJr48DmAD7uJi8Rv7R59FE5Yi4F1UyfbwGHtyk');
    const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
    const [feeLocker] = await initializer.getFeeLockerAddress(launch);

    const accounts = {
      launch,
      launchAuthority,
      feeLocker,
      baseMint: address('7uQ54RR3cbszA2F9KjZABPXdxE32LhDfzuPBL7at9dmq'),
      quoteMint,
      baseVault: address('8VrM4ArsJGLCmiJkiS9nQqSvhjR4rz9oZwfNSzuzDE57'),
      quoteVault: address('BUK6N7GohfX7xcwEzwL2MPnMXSYLCwXMMccHVFe3MY8K'),
      beneficiary: beneficiary.address,
      beneficiaryBaseAccount: address('9KY5BhmhWLCK8Nr4nUKnSoFCxV6PiGp4eW3wV96vBj99'),
      beneficiaryQuoteAccount: address('2WVfbpu45p2VYj7kRkaTTDTBtbBc6rUme7gB5XcEYGBm'),
    };

    const ix = initializer.createClaimFeeLockerInstruction(accounts);

    expect(ix.accounts).toHaveLength(12);
    expect(ix.accounts!.map((account) => account.address)).toEqual([
      accounts.launch,
      accounts.launchAuthority,
      accounts.feeLocker,
      accounts.baseMint,
      accounts.quoteMint,
      accounts.baseVault,
      accounts.quoteVault,
      accounts.beneficiary,
      accounts.beneficiaryBaseAccount,
      accounts.beneficiaryQuoteAccount,
      TOKEN_PROGRAM_ADDRESS,
      TOKEN_PROGRAM_ADDRESS,
    ]);
  });

  it('builds distributeBaseAllocation with correct account ordering', async () => {
    const admin = await generateKeyPairSigner();
    const [config] = await initializer.getConfigAddress();
    const launch = address('3ev4CeaJr48DmAD7uJi8Rv7R59FE5Yi4F1UyfbwGHtyk');
    const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);

    const accounts = {
      config,
      launch,
      launchAuthority,
      baseMint: address('7uQ54RR3cbszA2F9KjZABPXdxE32LhDfzuPBL7at9dmq'),
      baseVault: address('8VrM4ArsJGLCmiJkiS9nQqSvhjR4rz9oZwfNSzuzDE57'),
      recipientBaseAccount: address('9KY5BhmhWLCK8Nr4nUKnSoFCxV6PiGp4eW3wV96vBj99'),
      distributionAuthority: admin,
    };

    const ix = initializer.createDistributeBaseAllocationInstruction(accounts);

    expect(ix.accounts).toHaveLength(8);
    expect(ix.accounts!.map((account) => account.address)).toEqual([
      accounts.config,
      accounts.launch,
      accounts.launchAuthority,
      accounts.baseMint,
      accounts.baseVault,
      accounts.recipientBaseAccount,
      admin.address,
      TOKEN_PROGRAM_ADDRESS,
    ]);
    expect((ix.accounts![6] as { signer?: unknown }).signer).toBeDefined();
  });
});
