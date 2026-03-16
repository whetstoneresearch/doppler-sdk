import { describe, expect, it } from 'vitest';
import { address } from '@solana/kit';
import { cpmmMigrator } from '../../../../src/solana/index.js';

const { CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS } = cpmmMigrator;

const REGISTER_LAUNCH_DISCRIMINATOR = CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.registerLaunch;
const MIGRATE_DISCRIMINATOR = CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.migrate;

const TEST_CONFIG = address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL');
const TEST_WALLET = address('11111111111111111111111111111111');

describe('cpmmMigrator calldata encoders', () => {
  describe('encodeRegisterLaunchCalldata', () => {
    it('prefixes output with the registerLaunch discriminator', () => {
      const result = cpmmMigrator.encodeRegisterLaunchCalldata({
        cpmmConfig: TEST_CONFIG,
        initialSwapFeeBps: 30,
        initialFeeSplitBps: 5000,
        recipients: [
          { wallet: TEST_WALLET, amount: 700_000n },
          { wallet: TEST_WALLET, amount: 0n },
        ],
        minRaiseQuote: 500_000n,
        minMigrationPriceQ64Opt: null,
      });

      expect([...result.slice(0, 8)]).toEqual([...REGISTER_LAUNCH_DISCRIMINATOR]);
    });

    it('encodes initialSwapFeeBps correctly', () => {
      const result = cpmmMigrator.encodeRegisterLaunchCalldata({
        cpmmConfig: TEST_CONFIG,
        initialSwapFeeBps: 42,
        initialFeeSplitBps: 5000,
        recipients: [
          { wallet: TEST_WALLET, amount: 700_000n },
          { wallet: TEST_WALLET, amount: 0n },
        ],
        minRaiseQuote: 500_000n,
        minMigrationPriceQ64Opt: null,
      });

      // initialSwapFeeBps is a u16 at bytes 8+32 (after discriminator + cpmmConfig pubkey)
      const view = new DataView(result.buffer, result.byteOffset);
      const is_fee_bps = view.getUint16(8 + 32, true);
      expect(is_fee_bps).toBe(42);
    });
  });

  describe('encodeMigrateCalldata', () => {
    it('prefixes output with the migrate discriminator', () => {
      const result = cpmmMigrator.encodeMigrateCalldata({
        baseForDistribution: 700_000n,
        baseForLiquidity: 300_000n,
      });

      expect([...result.slice(0, 8)]).toEqual([...MIGRATE_DISCRIMINATOR]);
    });

    it('encodes baseForDistribution and baseForLiquidity as u64s', () => {
      const result = cpmmMigrator.encodeMigrateCalldata({
        baseForDistribution: 700_000n,
        baseForLiquidity: 300_000n,
      });

      const view = new DataView(result.buffer, result.byteOffset);
      expect(view.getBigUint64(8, true)).toBe(700_000n);
      expect(view.getBigUint64(16, true)).toBe(300_000n);
    });
  });
});
