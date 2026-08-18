import { address } from '@solana/kit';
import { describe, expect, it } from 'vitest';
import * as cpmmAccounts from '@/solana/generated/cpmm/accounts/index.js';
import * as cpmmMigratorAccounts from '@/solana/generated/cpmmMigrator/accounts/index.js';
import * as dopplerLaunchHookV1Accounts from '@/solana/generated/dopplerLaunchHookV1/accounts/index.js';
import * as dopplerRehypeRouterV1Accounts from '@/solana/generated/dopplerRehypeRouterV1/accounts/index.js';
import * as dopplerVestingAccounts from '@/solana/generated/dopplerVesting/accounts/index.js';
import * as initializerAccounts from '@/solana/generated/initializer/accounts/index.js';
import * as predictionMigratorAccounts from '@/solana/generated/predictionMigrator/accounts/index.js';
import * as trustedOracleAccounts from '@/solana/generated/trustedOracle/accounts/index.js';
import { initializer } from '@/solana/index.js';
import type { InitConfigArgs } from '@/solana/initializer/index.js';

const GENERATED_ACCOUNT_MODULES = [
  { name: 'cpmm', exports: cpmmAccounts },
  { name: 'dopplerLaunchHookV1', exports: dopplerLaunchHookV1Accounts },
  { name: 'dopplerRehypeRouterV1', exports: dopplerRehypeRouterV1Accounts },
  { name: 'dopplerVesting', exports: dopplerVestingAccounts },
  { name: 'cpmmMigrator', exports: cpmmMigratorAccounts },
  { name: 'initializer', exports: initializerAccounts },
  { name: 'predictionMigrator', exports: predictionMigratorAccounts },
  { name: 'trustedOracle', exports: trustedOracleAccounts },
] as const;

const DEFAULT_ADDRESS = address('11111111111111111111111111111111');

function callFactory(factory: unknown, exportName: string): unknown {
  if (typeof factory !== 'function') {
    throw new Error(`Missing generated factory: ${exportName}`);
  }
  return (factory as () => unknown)();
}

function readNumericProperty(
  value: unknown,
  property: 'fixedSize' | 'maxSize',
  exportName: string,
): number {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      `Generated factory returned an invalid value: ${exportName}`,
    );
  }

  const propertyValue = (value as Record<string, unknown>)[property];
  if (typeof propertyValue !== 'number') {
    throw new Error(`Missing ${property} on generated codec: ${exportName}`);
  }
  return propertyValue;
}

describe('generated Solana account codec sizes', () => {
  for (const generatedModule of GENERATED_ACCOUNT_MODULES) {
    const moduleExports = generatedModule.exports as Record<string, unknown>;

    for (const [sizeExportName, sizeFactory] of Object.entries(moduleExports)) {
      const match = /^get(.+)Size$/.exec(sizeExportName);
      if (!match) continue;

      const accountName = match[1];
      const encoderExportName = `get${accountName}Encoder`;
      const decoderExportName = `get${accountName}Decoder`;

      it(`${generatedModule.name}.${accountName} aligns its fixed codec and account sizes`, () => {
        const expectedSize = callFactory(sizeFactory, sizeExportName);
        expect(typeof expectedSize).toBe('number');

        expect(
          readNumericProperty(
            callFactory(moduleExports[encoderExportName], encoderExportName),
            'fixedSize',
            encoderExportName,
          ),
        ).toBe(expectedSize);
        expect(
          readNumericProperty(
            callFactory(moduleExports[decoderExportName], decoderExportName),
            'fixedSize',
            decoderExportName,
          ),
        ).toBe(expectedSize);
      });
    }
  }

  it('tracks the variable CPMM migrator state allocation as its maximum size', () => {
    expect(
      readNumericProperty(
        cpmmMigratorAccounts.getCpmmMigratorStateEncoder(),
        'maxSize',
        'getCpmmMigratorStateEncoder',
      ),
    ).toBe(269);
    expect(
      readNumericProperty(
        cpmmMigratorAccounts.getCpmmMigratorStateDecoder(),
        'maxSize',
        'getCpmmMigratorStateDecoder',
      ),
    ).toBe(269);
  });

  it('round-trips the full retained InitConfig account allocation', () => {
    const initConfigArgs: InitConfigArgs = {
      admin: DEFAULT_ADDRESS,
      migratorAllowlistLen: 0,
      migratorAllowlist: Array.from({ length: 32 }, () => DEFAULT_ADDRESS),
      hookAllowlistLen: 0,
      hookAllowlist: Array.from({ length: 32 }, () => DEFAULT_ADDRESS),
      bump: 255,
      version: 1,
      protocolFeeBps: 750,
      minSwapFeeBps: 25,
      maxSwapFeeBps: 500,
      reserved: new Uint8Array(24),
    };
    const encoder = initializer.getInitConfigEncoder();
    const decoder = initializer.getInitConfigDecoder();
    const encoded = encoder.encode(initConfigArgs);

    expect(initializer.getInitConfigSize()).toBe(2_123);
    expect(initializer.getInitConfigCodec().fixedSize).toBe(2_123);
    expect(encoded).toHaveLength(2_123);
    expect(encoded.at(-1)).toBe(0);

    const [decoded, offset] = decoder.read(encoded, 0);
    expect(offset).toBe(2_123);
    expect(decoded.protocolFeeBps).toBe(initConfigArgs.protocolFeeBps);
    expect(() => decoder.decode(encoded.slice(0, -1))).toThrow();
  });

  it('keeps shared Launch account layouts aligned across generated clients', () => {
    const emptyPayload = { len: 0, bytes: new Uint8Array(256) };
    const createdAt = 1_725_000_123n;
    const encoded = initializer.getLaunchEncoder().encode({
      authority: DEFAULT_ADDRESS,
      namespace: DEFAULT_ADDRESS,
      launchId: new Uint8Array(32),
      phase: 0,
      bump: 1,
      launchAuthorityBump: 2,
      pad0: new Uint8Array(5),
      baseMint: DEFAULT_ADDRESS,
      quoteMint: DEFAULT_ADDRESS,
      baseVault: DEFAULT_ADDRESS,
      quoteVault: DEFAULT_ADDRESS,
      baseTotalSupply: 1_000_000n,
      baseForDistribution: 200_000n,
      baseForLiquidity: 0n,
      baseForCurve: 800_000n,
      curveVirtualBase: 1_000_000n,
      curveVirtualQuote: 10_000n,
      swapFeeBps: 100,
      pad1: new Uint8Array(6),
      allowBuy: 1,
      allowSell: 1,
      pad2: new Uint8Array(6),
      hookProgram: DEFAULT_ADDRESS,
      hookFlags: 0,
      pad3: new Uint8Array(4),
      hookPayload: emptyPayload,
      migratorProgram: DEFAULT_ADDRESS,
      migratorInitPayload: emptyPayload,
      migratorMigratePayload: emptyPayload,
      curveKind: 0,
      swapLock: 0,
      vestingEnabled: 1,
      pad4: new Uint8Array(5),
      curveParams: emptyPayload,
      createdAt,
      reserved: new Uint8Array(64),
    });
    const dependentDecoders = [
      cpmmMigratorAccounts.getLaunchDecoder(),
      dopplerRehypeRouterV1Accounts.getLaunchDecoder(),
      dopplerVestingAccounts.getLaunchDecoder(),
      predictionMigratorAccounts.getLaunchDecoder(),
    ];

    for (const decoder of dependentDecoders) {
      const decoded = decoder.decode(encoded);
      expect(decoded.vestingEnabled).toBe(1);
      expect(decoded.createdAt).toBe(createdAt);
    }
  });
});
