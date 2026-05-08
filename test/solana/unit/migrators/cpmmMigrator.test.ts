import { describe, expect, it } from 'vitest';
import { address } from '@solana/kit';
import { cpmm, cpmmMigrator, initializer } from '@/solana/index.js';

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

describe('cpmmMigrator remaining accounts', () => {
  it('builds migrate_launch remaining accounts in the committed order', async () => {
    const launch = address('8h4Nw2m3qPH4tB3x3fcQADkHDzWr7TjapfxnY4LuRk7w');
    const baseMint = address('Bt1XAR34t3wWJZsvSuFq7LPgsT6LUzTK3qbknk3kheMG');
    const quoteMint = address('So11111111111111111111111111111111111111112');
    const launchAuthority = address(
      '5hX6e1cyWUFHMzLM5VGuxFHXU8Gykqa5R2rsJqnyqkyU',
    );
    const adminBaseAta = address(
      '2y7VfY6FEteTm5NntQbXcp6BqkhZsd34z8gLT6Rp6g9T',
    );
    const adminQuoteAta = address(
      '5kWU9u4CuSNCvTzwUW6Wm4j9aigZFg3sLKzg4UFK2qwg',
    );
    const recipientAta = address(
      '4Ux8qqquRoLtMfXTrkVN1sRAz7E3BbFyyq1UFgdKpbXr',
    );

    const accounts = await cpmmMigrator.buildCpmmMigrationRemainingAccounts({
      launch,
      baseMint,
      quoteMint,
      launchAuthority,
      adminBaseAta,
      adminQuoteAta,
      recipientAtas: [recipientAta],
    });
    const [expectedState] =
      await cpmmMigrator.getCpmmMigratorStateAddress(launch);
    const poolInit = await cpmm.getPoolInitAddresses(baseMint, quoteMint);
    const [expectedMigrationAuthority] =
      await cpmmMigrator.getCpmmMigrationAuthorityAddress();
    const [expectedLpPosition] = await cpmm.getPositionAddress(
      poolInit.pool[0],
      launchAuthority,
      0n,
    );

    expect(accounts.addresses).toEqual([
      expectedState,
      poolInit.config[0],
      poolInit.pool[0],
      poolInit.authority[0],
      poolInit.vault0[0],
      poolInit.vault1[0],
      poolInit.protocolPosition[0],
      expectedLpPosition,
      cpmm.CPMM_PROGRAM_ID,
      expectedMigrationAuthority,
      adminBaseAta,
      adminQuoteAta,
      recipientAta,
    ]);
    expect(accounts.metas.map((meta) => meta.address)).toEqual(accounts.addresses);
    expect([...accounts.hash]).toEqual([
      ...initializer.computeRemainingAccountsHash(accounts.addresses),
    ]);
  });
});
