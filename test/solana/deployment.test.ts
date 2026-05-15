import { describe, expect, it } from 'vitest';
import { AccountRole, address } from '@solana/kit';

import {
  cpmm,
  cosignerHook,
  cpmmMigrator,
  DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES,
  DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES,
  deriveSolanaCpmmDeployment,
  initializer,
  type SolanaCpmmProgramAddresses,
} from '../../src/solana/index.js';

const CUSTOM_PROGRAMS: SolanaCpmmProgramAddresses = {
  cpmmProgram: address('ComputeBudget111111111111111111111111111111'),
  initializerProgram: address('BPFLoaderUpgradeab1e11111111111111111111111'),
  cpmmMigratorProgram: address('AddressLookupTab1e1111111111111111111111111'),
  cpmmHookProgram: address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
  cosignerHookProgram: address('SysvarS1otHashes111111111111111111111111111'),
};

describe('Solana deployment helpers', () => {
  it('derives the default devnet CPMM deployment', async () => {
    const deployment = await deriveSolanaCpmmDeployment();

    expect(deployment).toMatchObject(DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES);
    expect(deployment.cpmmConfig).toBeDefined();
    expect(deployment.initializerConfig).toBeDefined();
  });

  it('derives config PDAs from supplied program IDs', async () => {
    const deployment = await deriveSolanaCpmmDeployment(CUSTOM_PROGRAMS);
    const [expectedCpmmConfig] = await cpmm.getConfigAddress(
      CUSTOM_PROGRAMS.cpmmProgram,
    );
    const [expectedInitializerConfig] = await initializer.getConfigAddress(
      CUSTOM_PROGRAMS.initializerProgram,
    );

    expect(deployment).toMatchObject(CUSTOM_PROGRAMS);
    expect(deployment.cpmmConfig).toBe(expectedCpmmConfig);
    expect(deployment.initializerConfig).toBe(expectedInitializerConfig);
  });

  it('exports known mainnet CPMM deployment program IDs', () => {
    expect(DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES).toEqual({
      cpmmProgram: address('5pXzd9UiWrVxATCYWmgo5EbfxzXqHYhfSKGdCPXPz7vK'),
      initializerProgram: address(
        '4carc9eePfE7jKUXdCAYMhcPf4awEFpZPrz1sTykdss1',
      ),
      cpmmMigratorProgram: address(
        'H71WD4tsiCCipro4urykWHySH1ryvLTmqEdNbHTGwb3o',
      ),
      cpmmHookProgram: address('4pU2NUiPd3WFCw8vTbvyF3RSARhjMqoUejWi7eMJWp3U'),
      cosignerHookProgram: cosignerHook.COSIGNER_HOOK_PROGRAM_ID,
    });
  });

  it('includes fee locker in migrate-launch accounts', async () => {
    const launch = address('SysvarC1ock11111111111111111111111111111111');
    const [feeLocker] = await initializer.getFeeLockerAddress(
      launch,
      CUSTOM_PROGRAMS.initializerProgram,
    );
    const ix = initializer.createMigrateLaunchInstruction({
      config: address('ComputeBudget111111111111111111111111111111'),
      launch,
      launchAuthority: address('Sysvar1nstructions1111111111111111111111111'),
      baseMint: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      quoteMint: address('So11111111111111111111111111111111111111112'),
      baseVault: address('SysvarRecentB1ockHashes11111111111111111111'),
      quoteVault: address('SysvarS1otHashes111111111111111111111111111'),
      feeLocker,
      migratorProgram: CUSTOM_PROGRAMS.cpmmMigratorProgram,
      payer: address('AddressLookupTab1e1111111111111111111111111'),
      rent: address('SysvarRent111111111111111111111111111111111'),
    });

    expect(ix.accounts?.[7]).toEqual({
      address: feeLocker,
      role: AccountRole.READONLY,
    });
    expect(ix.accounts).toHaveLength(14);
  });
});

describe('CPMM migrator custom deployment helpers', () => {
  it('derives remaining accounts with custom CPMM and migrator programs', async () => {
    const launch = address('SysvarC1ock11111111111111111111111111111111');
    const launchAuthority = address(
      'Sysvar1nstructions1111111111111111111111111',
    );
    const baseMint = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const quoteMint = address('So11111111111111111111111111111111111111112');
    const adminBaseAta = address('SysvarRecentB1ockHashes11111111111111111111');
    const adminQuoteAta = address(
      'SysvarS1otHashes111111111111111111111111111',
    );

    const result = await cpmmMigrator.buildCpmmMigrationRemainingAccounts({
      launch,
      baseMint,
      quoteMint,
      launchAuthority,
      adminBaseAta,
      adminQuoteAta,
      recipientAtas: [],
      cpmmProgram: CUSTOM_PROGRAMS.cpmmProgram,
      cpmmMigratorProgram: CUSTOM_PROGRAMS.cpmmMigratorProgram,
    });
    const [expectedState] = await cpmmMigrator.getCpmmMigratorStateAddress(
      launch,
      CUSTOM_PROGRAMS.cpmmMigratorProgram,
    );
    const [expectedAuthority] =
      await cpmmMigrator.getCpmmMigrationAuthorityAddress(
        CUSTOM_PROGRAMS.cpmmMigratorProgram,
      );
    const [expectedCpmmConfig] = await cpmm.getConfigAddress(
      CUSTOM_PROGRAMS.cpmmProgram,
    );

    expect(result.cpmmMigrationState).toBe(expectedState);
    expect(result.migrationAuthority).toBe(expectedAuthority);
    expect(result.cpmmConfig).toBe(expectedCpmmConfig);
    expect(result.addresses).toContain(CUSTOM_PROGRAMS.cpmmProgram);
  });

  it('appends CPMM register-launch accounts for custom migrator programs', async () => {
    const namespace = address('SysvarC1ock11111111111111111111111111111111');
    const launchId = initializer.launchIdFromU64(1n);
    const [launch] = await initializer.getLaunchAddress(
      namespace,
      launchId,
      CUSTOM_PROGRAMS.initializerProgram,
    );
    const [launchAuthority] = await initializer.getLaunchAuthorityAddress(
      launch,
      CUSTOM_PROGRAMS.initializerProgram,
    );
    const [feeLocker] = await initializer.getFeeLockerAddress(
      launch,
      CUSTOM_PROGRAMS.initializerProgram,
    );
    const [cpmmConfig] = await cpmm.getConfigAddress(
      CUSTOM_PROGRAMS.cpmmProgram,
    );
    const [cpmmMigrationState] = await cpmmMigrator.getCpmmMigratorStateAddress(
      launch,
      CUSTOM_PROGRAMS.cpmmMigratorProgram,
    );

    const ix = await initializer.createInitializeLaunchInstruction(
      {
        config: address('SysvarRent111111111111111111111111111111111'),
        launch,
        launchAuthority,
        baseMint: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        quoteMint: address('So11111111111111111111111111111111111111112'),
        baseVault: address('SysvarS1otHashes111111111111111111111111111'),
        quoteVault: address('SysvarRecentB1ockHashes11111111111111111111'),
        feeLocker,
        payer: address('SysvarFees111111111111111111111111111111111'),
        authority: address('SysvarFees111111111111111111111111111111111'),
        migratorProgram: CUSTOM_PROGRAMS.cpmmMigratorProgram,
        hookProgram: CUSTOM_PROGRAMS.cpmmHookProgram,
        cpmmConfig,
        rent: address('SysvarRent111111111111111111111111111111111'),
      },
      {
        namespace,
        launchId,
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
        curveVirtualBase: 1n,
        curveVirtualQuote: 1n,
        curveFeeBps: 100,
        curveKind: initializer.CURVE_KIND_XYK,
        curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
        allowBuy: true,
        allowSell: true,
        hookProgram: CUSTOM_PROGRAMS.cpmmHookProgram,
        hookFlags: 0,
        hookPayload: new Uint8Array(),
        migratorInitPayload: new Uint8Array(),
        migratorMigratePayload: new Uint8Array(),
        hookRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
        migratorInitRemainingAccountsHash:
          initializer.computeRemainingAccountsHash([
            cpmmMigrationState,
            cpmmConfig,
          ]),
        migratorRemainingAccountsHash:
          initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
        metadataName: '',
        metadataSymbol: '',
        metadataUri: '',
        feeBeneficiaries: [
          {
            wallet: address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            shareBps: 9500,
          },
        ],
      },
      CUSTOM_PROGRAMS.initializerProgram,
    );

    expect(ix.accounts?.[ix.accounts.length - 2]?.address).toBe(
      cpmmMigrationState,
    );
    expect(ix.accounts?.[ix.accounts.length - 1]?.address).toBe(cpmmConfig);
    expect(ix.programAddress).toBe(CUSTOM_PROGRAMS.initializerProgram);
  });
});
