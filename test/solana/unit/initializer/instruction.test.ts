import { describe, expect, it } from 'vitest';
import { address } from '@solana/addresses';
import { generateKeyPairSigner } from '@solana/signers';
import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import {
  createLaunch,
  initializer,
  cpmmMigrator,
  cpmmHook,
} from '@/solana/index.js';
import { getInitializeLaunchInstructionDataDecoder } from '@/solana/generated/initializer/instructions/initializeLaunch.js';
import {
  SYSVAR_INSTRUCTIONS_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_METADATA_PROGRAM_ID,
} from '@/solana/core/constants.js';

const SYSVAR_RENT_PUBKEY = address(
  'SysvarRent111111111111111111111111111111111',
);

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
        protocolFeeBps: 0,
        minSwapFeeBps: 0,
        maxSwapFeeBps: 10_000,
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
    const [launchAuthority] =
      await initializer.getLaunchAuthorityAddress(launch);
    const [launchFeeState] = await initializer.getLaunchFeeStateAddress(launch);

    const migratorInitPayload = cpmmMigrator.encodeRegisterLaunchPayload({
      cpmmConfig,
      initialSwapFeeBps: 30,
      initialFeeSplitBps: 5000,
      recipients: [
        { wallet: admin.address, amount: 700_000n },
        { wallet: admin.address, amount: 0n },
      ],
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
      },
    );

    expect(ix.programAddress).toBe(initializer.INITIALIZER_PROGRAM_ID);
    // 15 required/static accounts + hook and metadata placeholders +
    // 2 auto-appended CPMM migrator remaining accounts:
    // cpmmMigrationState and cpmmConfig.
    expect(ix.accounts).toHaveLength(20);

    // Account ordering: config, launch, launchAuthority, baseMint, quoteMint, baseVault, quoteVault, launchFeeState, payer,
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
    expect(ix.accounts![7].address).toBe(launchFeeState);
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
    const [expectedCpmmMigratorState] =
      await cpmmMigrator.getCpmmMigratorStateAddress(launch);
    expect(ix.accounts![18].address).toBe(expectedCpmmMigratorState);
    expect(ix.accounts![19].address).toBe(cpmmConfig);

    // Ensure signer metas were attached for the signer accounts.
    for (const idx of [3, 5, 6, 8]) {
      const meta = ix.accounts![idx] as { signer?: unknown };
      expect(meta.signer).toBeDefined();
    }
  });

  it('prepends the instructions sysvar for Token-2022 metadata without changing routed accounts', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const metadataAccount = await initializer.getTokenMetadataAddress(
      baseMint.address,
    );
    const namespace = admin.address;
    const launchId = initializer.launchIdFromU64(3n);
    const migratorProgram = cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID;
    const cpmmConfig = address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL');

    const [config] = await initializer.getConfigAddress();
    const [launch] = await initializer.getLaunchAddress(namespace, launchId);
    const [launchAuthority] =
      await initializer.getLaunchAuthorityAddress(launch);
    const [launchFeeState] = await initializer.getLaunchFeeStateAddress(launch);
    const [expectedCpmmMigratorState] =
      await cpmmMigrator.getCpmmMigratorStateAddress(launch);

    const ix = await initializer.createInitializeLaunchInstruction(
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
        cpmmConfig,
        baseTokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        rent: SYSVAR_RENT_PUBKEY,
        metadataAccount,
        hookProgram: SYSTEM_PROGRAM_ADDRESS,
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
        hookFlags: 0,
        hookPayload: new Uint8Array(),
        migratorInitPayload: cpmmMigrator.encodeRegisterLaunchPayload({
          cpmmConfig,
          initialSwapFeeBps: 30,
          initialFeeSplitBps: 5000,
          recipients: [],
          minRaiseQuote: 500_000n,
          minMigrationPriceQ64Opt: null,
          migratedPoolHookConfig: null,
        }),
        migratorMigratePayload: cpmmMigrator.encodeMigratePayload({
          baseForDistribution: 700_000n,
          baseForLiquidity: 300_000n,
        }),
        hookRemainingAccountsHash: new Uint8Array(32),
        migratorInitRemainingAccountsHash: new Uint8Array(32),
        migratorRemainingAccountsHash: new Uint8Array(32),
        metadataName: 'Token',
        metadataSymbol: 'TKN',
        metadataUri: 'https://example.com/token.json',
      },
    );

    expect(ix.accounts).toHaveLength(21);
    expect(ix.accounts![16].address).toBe(metadataAccount);
    expect(ix.accounts![17].address).toBe(TOKEN_METADATA_PROGRAM_ID);
    expect(ix.accounts![18].address).toBe(SYSVAR_INSTRUCTIONS_ADDRESS);
    expect(ix.accounts![18].role).toBe(AccountRole.READONLY);
    expect(ix.accounts![19].address).toBe(expectedCpmmMigratorState);
    expect(ix.accounts![20].address).toBe(cpmmConfig);
  });

  it('prepares initializeLaunch from launch domain inputs', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const namespace = admin.address;
    const launchId = initializer.launchIdFromU64(4n);
    const [config] = await initializer.getConfigAddress();
    const [expectedLaunch] = await initializer.getLaunchAddress(
      namespace,
      launchId,
    );
    const [expectedLaunchAuthority] =
      await initializer.getLaunchAuthorityAddress(expectedLaunch);
    const [expectedLaunchFeeState] =
      await initializer.getLaunchFeeStateAddress(expectedLaunch);
    const expectedMetadataAccount = await initializer.getTokenMetadataAddress(
      baseMint.address,
    );
    const [expectedCpmmMigratorState] =
      await cpmmMigrator.getCpmmMigratorStateAddress(expectedLaunch);

    const prepared = await createLaunch({
      deployment: {
        initializerConfig: config,
        initializerProgram: initializer.INITIALIZER_PROGRAM_ID,
      },
      namespace,
      launchId,
      launchAccounts: {
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
      },
      payer: admin,
      authority: admin,
      supply: {
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 700_000n,
        baseForLiquidity: 300_000n,
      },
      curve: {
        curveVirtualBase: 200_000n,
        curveVirtualQuote: 200_000n,
        swapFeeBps: 100,
      },
      tokenPrograms: initializer.launchTokenPrograms.token2022Base(),
      metadata: {
        metadataName: 'Token',
        metadataSymbol: 'TKN',
        metadataUri: 'https://example.com/token.json',
      },
      feeBeneficiaries: [{ wallet: admin.address, shareBps: 10_000 }],
    });

    expect(prepared.namespace).toBe(namespace);
    expect(prepared.launchId).toBe(launchId);
    expect(prepared.addresses).toEqual({
      config,
      launch: expectedLaunch,
      launchAuthority: expectedLaunchAuthority,
      launchFeeState: expectedLaunchFeeState,
      metadataAccount: expectedMetadataAccount,
    });
    expect(prepared.cpmmMigration).toBeDefined();

    const ix = prepared.instruction;
    expect(ix.programAddress).toBe(initializer.INITIALIZER_PROGRAM_ID);
    expect(ix.accounts).toHaveLength(21);
    expect(ix.accounts![0].address).toBe(config);
    expect(ix.accounts![1].address).toBe(expectedLaunch);
    expect(ix.accounts![2].address).toBe(expectedLaunchAuthority);
    expect(ix.accounts![3].address).toBe(baseMint.address);
    expect(ix.accounts![4].address).toBe(quoteMint);
    expect(ix.accounts![5].address).toBe(baseVault.address);
    expect(ix.accounts![6].address).toBe(quoteVault.address);
    expect(ix.accounts![7].address).toBe(expectedLaunchFeeState);
    expect(ix.accounts![10].address).toBe(cpmmHook.CPMM_HOOK_PROGRAM_ID);
    expect(ix.accounts![11].address).toBe(
      cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
    );
    expect(ix.accounts![12].address).toBe(TOKEN_2022_PROGRAM_ADDRESS);
    expect(ix.accounts![13].address).toBe(TOKEN_PROGRAM_ADDRESS);
    expect(ix.accounts![16].address).toBe(expectedMetadataAccount);
    expect(ix.accounts![17].address).toBe(TOKEN_METADATA_PROGRAM_ID);
    expect(ix.accounts![18].address).toBe(SYSVAR_INSTRUCTIONS_ADDRESS);
    expect(ix.accounts![19].address).toBe(expectedCpmmMigratorState);
    expect(ix.accounts![20].address).toBe(prepared.cpmmMigration!.cpmmConfig);
    expect(prepared.cpmmMigration!.cpmmMigrationState).toBe(
      expectedCpmmMigratorState,
    );
    expect(prepared.cpmmMigration!.recipientAtas).toEqual([]);

    if (!ix.data) {
      throw new Error('initialize launch instruction data missing');
    }
    const data = getInitializeLaunchInstructionDataDecoder().decode(ix.data);
    expect(data.hookFlags).toBe(initializer.HF_BEFORE_SWAP);
    expect(data.hookPayload).toHaveLength(0);
    expect(data.hookRemainingAccountsHash).toEqual(
      initializer.computeRemainingAccountsHash([namespace]),
    );
  });

  it('enables cosigning through the CPMM hook when a cosigner is provided', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();
    const cosigner = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const launchId = initializer.launchIdFromU64(6n);
    const [config] = await initializer.getConfigAddress();
    const [cpmmHookConfig] = await cpmmHook.getCpmmHookConfigAddress();
    const [expectedLaunch] = await initializer.getLaunchAddress(
      SYSTEM_PROGRAM_ADDRESS,
      launchId,
    );

    const prepared = await createLaunch({
      deployment: {
        initializerConfig: config,
        initializerProgram: initializer.INITIALIZER_PROGRAM_ID,
      },
      launchId,
      launchAccounts: {
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
      },
      payer: admin,
      authority: admin,
      supply: {
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: 200_000n,
        curveVirtualQuote: 200_000n,
        swapFeeBps: 100,
      },
      cosigner,
      metadata: null,
    });

    expect(prepared.namespace).toBe(SYSTEM_PROGRAM_ADDRESS);
    expect(prepared.addresses.launch).toBe(expectedLaunch);

    const ix = prepared.instruction;
    expect(ix.accounts).toHaveLength(20);
    expect(ix.accounts![10].address).toBe(
      cpmmHook.CPMM_HOOK_PROGRAM_ID,
    );
    expect(ix.accounts![11].address).toBe(
      cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
    );
    expect(ix.accounts![18].address).toBe(
      prepared.cpmmMigration!.cpmmMigrationState,
    );
    expect(ix.accounts![19].address).toBe(prepared.cpmmMigration!.cpmmConfig);

    if (!ix.data) {
      throw new Error('initialize launch instruction data missing');
    }
    const data = getInitializeLaunchInstructionDataDecoder().decode(ix.data);
    expect(data.hookFlags).toBe(
      initializer.HF_BEFORE_SWAP | initializer.HF_FORWARD_READONLY_SIGNERS,
    );
    expect(data.hookPayload).toHaveLength(0);
    expect(data.hookRemainingAccountsHash).toEqual(
      initializer.computeRemainingAccountsHash([
        SYSTEM_PROGRAM_ADDRESS,
        cpmmHookConfig,
        cosigner.address,
      ]),
    );
  });

  it('enables dynamic fees through the CPMM hook', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const launchId = initializer.launchIdFromU64(7n);

    const prepared = await createLaunch({
      namespace: admin.address,
      launchId,
      launchAccounts: {
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
      },
      payer: admin,
      authority: admin,
      supply: {
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: 200_000n,
        curveVirtualQuote: 200_000n,
        swapFeeBps: 100,
      },
      dynamicFee: {
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      },
      cosignGateExpiresAt: null,
      migration: false,
      metadata: null,
    });

    const ix = prepared.instruction;
    if (!ix.data) {
      throw new Error('initialize launch instruction data missing');
    }
    const data = getInitializeLaunchInstructionDataDecoder().decode(ix.data);

    expect(prepared.namespace).toBe(admin.address);
    expect(ix.accounts).toHaveLength(18);
    expect(ix.accounts![10].address).toBe(
      cpmmHook.CPMM_HOOK_PROGRAM_ID,
    );
    expect(ix.accounts![11].address).toBe(initializer.INITIALIZER_PROGRAM_ID);
    expect(data.hookFlags).toBe(
      initializer.HF_BEFORE_CREATE | initializer.HF_BEFORE_SWAP,
    );
    expect(data.hookPayload).toHaveLength(
      cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN,
    );
    expect(cpmmHook.isDynamicFeeSchedulePayload(data.hookPayload)).toBe(
      true,
    );
    expect(data.hookCreateRemainingAccountsHash).toEqual(
      initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
    );
    expect(data.hookRemainingAccountsHash).toEqual(
      initializer.computeRemainingAccountsHash([admin.address]),
    );
  });

  it('combines dynamic fees and cosigning through the CPMM hook', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();
    const cosigner = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const launchId = initializer.launchIdFromU64(8n);
    const [cpmmHookConfig] =
      await cpmmHook.getCpmmHookConfigAddress();

    const prepared = await createLaunch({
      launchId,
      launchAccounts: {
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
      },
      payer: admin,
      authority: admin,
      supply: {
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: 200_000n,
        curveVirtualQuote: 200_000n,
        swapFeeBps: 100,
      },
      cosigner,
      cosignGateExpiresAt: 1_000n,
      dynamicFee: {
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      },
      migration: false,
      metadata: null,
    });

    const ix = prepared.instruction;
    if (!ix.data) {
      throw new Error('initialize launch instruction data missing');
    }
    const data = getInitializeLaunchInstructionDataDecoder().decode(ix.data);

    expect(prepared.namespace).toBe(SYSTEM_PROGRAM_ADDRESS);
    expect(ix.accounts).toHaveLength(18);
    expect(ix.accounts![10].address).toBe(
      cpmmHook.CPMM_HOOK_PROGRAM_ID,
    );
    expect(data.hookFlags).toBe(
      initializer.HF_BEFORE_CREATE |
        initializer.HF_BEFORE_SWAP |
        initializer.HF_FORWARD_READONLY_SIGNERS,
    );
    expect(data.hookPayload).toHaveLength(
      cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN +
        cpmmHook.GATE_EXPIRY_PAYLOAD_LEN,
    );
    expect(
      cpmmHook.isDynamicFeeSchedulePayload(
        data.hookPayload.slice(0, cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toBe(true);
    expect(
      cpmmHook.decodeCosignerGateExpiryPayload(
        data.hookPayload.slice(cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toEqual({
      mode: cpmmHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 1_000n,
      cosigner: cosigner.address,
    });
    expect(data.hookCreateRemainingAccountsHash).toEqual(
      initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
    );
    expect(data.hookRemainingAccountsHash).toEqual(
      initializer.computeRemainingAccountsHash([
        SYSTEM_PROGRAM_ADDRESS,
        cpmmHookConfig,
        cosigner.address,
      ]),
    );
  });

  it('prepares initializeLaunch without a migrator when migration is disabled', async () => {
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const admin = await generateKeyPairSigner();

    const quoteMint = address('DtCGbAhmf5R6Fjuo3zJqCS9Ep5wePTmxHzK8ri8E5nhb');
    const launchId = initializer.launchIdFromU64(5n);

    const prepared = await createLaunch({
      namespace: admin.address,
      launchId,
      launchAccounts: {
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
      },
      payer: admin,
      authority: admin,
      supply: {
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: 200_000n,
        curveVirtualQuote: 200_000n,
        swapFeeBps: 100,
      },
      migration: false,
      metadata: null,
    });

    const ix = prepared.instruction;
    expect(ix.accounts).toHaveLength(18);
    expect(ix.accounts![10].address).toBe(cpmmHook.CPMM_HOOK_PROGRAM_ID);
    expect(ix.accounts![11].address).toBe(initializer.INITIALIZER_PROGRAM_ID);
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
    const [launchAuthority] =
      await initializer.getLaunchAuthorityAddress(launch);

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
        },
      ),
    ).rejects.toThrow(/unsupported curve kind/);
  });

  it('computes initializer curve swap fees with ceil rounding', () => {
    expect(initializer.getCurveSwapFeeAmount(0n, 30)).toBe(0n);
    expect(initializer.getCurveSwapFeeAmount(1n, 30)).toBe(1n);
    expect(initializer.getCurveSwapFeeAmount(333n, 30)).toBe(1n);
    expect(initializer.getCurveSwapFeeAmount(10_001n, 30)).toBe(31n);
    expect(() => initializer.getCurveSwapFeeAmount(-1n, 30)).toThrow(
      /amountIn must be non-negative/,
    );
    expect(() => initializer.getCurveSwapFeeAmount(1n, 10_001)).toThrow(
      /swapFeeBps must be an integer from 0 to 10000/,
    );
  });
});
