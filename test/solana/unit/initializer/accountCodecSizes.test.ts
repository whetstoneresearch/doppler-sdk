import { address } from '@solana/kit';
import { describe, expect, it } from 'vitest';
import * as cpmmAccounts from '@/solana/generated/cpmm/accounts/index.js';
import * as cpmmHookAccounts from '@/solana/generated/cpmmHook/accounts/index.js';
import * as cpmmMigratorAccounts from '@/solana/generated/cpmmMigrator/accounts/index.js';
import * as initializerAccounts from '@/solana/generated/initializer/accounts/index.js';
import * as predictionMigratorAccounts from '@/solana/generated/predictionMigrator/accounts/index.js';
import * as trustedOracleAccounts from '@/solana/generated/trustedOracle/accounts/index.js';
import { initializer } from '@/solana/index.js';
import type { InitConfigArgs } from '@/solana/initializer/index.js';

const GENERATED_ACCOUNT_MODULES = [
  { name: 'cpmm', exports: cpmmAccounts },
  { name: 'cpmmHook', exports: cpmmHookAccounts },
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
});
