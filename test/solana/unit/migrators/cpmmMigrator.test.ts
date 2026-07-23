import { describe, expect, it } from 'vitest';
import { AccountRole, address, type TransactionSigner } from '@solana/kit';
import {
  cpmm,
  dopplerLaunchHookV1,
  cpmmMigrator,
  initializer,
} from '@/solana/index.js';

const { CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS } = cpmmMigrator;

const CREATE_SPOT_POOL_DISCRIMINATOR =
  CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.createSpotPool;
const REGISTER_LAUNCH_DISCRIMINATOR =
  CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.registerLaunch;
const MIGRATE_DISCRIMINATOR = CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.migrate;

const TEST_CONFIG = address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL');
const TEST_WALLET = address('11111111111111111111111111111111');
const TEST_MINT_A = address('So11111111111111111111111111111111111111112');
const TEST_MINT_B = address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL');
const TEST_USDC_MINT = address('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const TEST_VAULT = address('5B6PDEnK92XgKdTec5NJtoAeFqfAZQfuyxiuF4nGK5KQ');
const TEST_SIGNER = { address: TEST_WALLET } as TransactionSigner;

describe('cpmmMigrator payload encoders', () => {
  describe('encodeCreateSpotPoolPayload', () => {
    it('prefixes output with the createSpotPool discriminator', () => {
      const result = cpmmMigrator.encodeCreateSpotPoolPayload({
        swapFeeBps: 30,
        positionId: 0n,
        amount0Max: 700_000n,
        amount1Max: 300_000n,
        minSharesOut: 1n,
      });

      expect([...result.slice(0, 8)]).toEqual([
        ...CREATE_SPOT_POOL_DISCRIMINATOR,
      ]);
    });

    it('encodes spot pool args correctly', () => {
      const result = cpmmMigrator.encodeCreateSpotPoolPayload({
        swapFeeBps: 42,
        positionId: 7n,
        amount0Max: 700_000n,
        amount1Max: 300_000n,
        minSharesOut: (1n << 64n) + 10n,
      });

      const view = new DataView(result.buffer, result.byteOffset);
      expect(view.getUint16(8, true)).toBe(42);
      expect(view.getBigUint64(10, true)).toBe(7n);
      expect(view.getBigUint64(18, true)).toBe(700_000n);
      expect(view.getBigUint64(26, true)).toBe(300_000n);
      expect(view.getBigUint64(34, true)).toBe(10n);
      expect(view.getBigUint64(42, true)).toBe(1n);
    });

    it('accepts safe numeric u64 and u128 values', () => {
      const result = cpmmMigrator.encodeCreateSpotPoolPayload({
        swapFeeBps: 30,
        positionId: 7,
        amount0Max: 700_000,
        amount1Max: 300_000,
        minSharesOut: 1,
      });
      const view = new DataView(result.buffer, result.byteOffset);

      expect(view.getBigUint64(10, true)).toBe(7n);
      expect(view.getBigUint64(18, true)).toBe(700_000n);
      expect(view.getBigUint64(26, true)).toBe(300_000n);
      expect(view.getBigUint64(34, true)).toBe(1n);
    });

    it('rejects unsafe numeric u64 and u128 values', () => {
      const args = {
        swapFeeBps: 30,
        positionId: 0n,
        amount0Max: 700_000n,
        amount1Max: 300_000n,
        minSharesOut: 1n,
      };
      const unsafeNumber = Number.MAX_SAFE_INTEGER + 1;

      expect(() =>
        cpmmMigrator.encodeCreateSpotPoolPayload({
          ...args,
          positionId: unsafeNumber,
        }),
      ).toThrow('positionId must be a safe integer');
      expect(() =>
        cpmmMigrator.encodeCreateSpotPoolPayload({
          ...args,
          amount0Max: unsafeNumber,
        }),
      ).toThrow('amount0Max must be a safe integer');
      expect(() =>
        cpmmMigrator.encodeCreateSpotPoolPayload({
          ...args,
          amount1Max: unsafeNumber,
        }),
      ).toThrow('amount1Max must be a safe integer');
      expect(() =>
        cpmmMigrator.encodeCreateSpotPoolPayload({
          ...args,
          minSharesOut: unsafeNumber,
        }),
      ).toThrow('minSharesOut must be a safe integer');
    });
  });

  describe('encodeRegisterLaunchPayload', () => {
    it('prefixes output with the registerLaunch discriminator', () => {
      const result = cpmmMigrator.encodeRegisterLaunchPayload({
        cpmmConfig: TEST_CONFIG,
        initialSwapFeeBps: 30,
        initialFeeSplitBps: 5000,
        recipients: [
          { wallet: TEST_WALLET, amount: 700_000n },
          { wallet: TEST_WALLET, amount: 0n },
        ],
        minRaiseQuote: 500_000n,
        minMigrationPriceQ64Opt: null,
        migratedPoolHookConfig: null,
      });

      expect([...result.slice(0, 8)]).toEqual([
        ...REGISTER_LAUNCH_DISCRIMINATOR,
      ]);
    });

    it('encodes initialSwapFeeBps correctly', () => {
      const result = cpmmMigrator.encodeRegisterLaunchPayload({
        cpmmConfig: TEST_CONFIG,
        initialSwapFeeBps: 42,
        initialFeeSplitBps: 5000,
        recipients: [
          { wallet: TEST_WALLET, amount: 700_000n },
          { wallet: TEST_WALLET, amount: 0n },
        ],
        minRaiseQuote: 500_000n,
        minMigrationPriceQ64Opt: null,
        migratedPoolHookConfig: null,
      });

      const view = new DataView(result.buffer, result.byteOffset);
      const is_fee_bps = view.getUint16(8 + 32, true);
      expect(is_fee_bps).toBe(42);
    });

    it('encodes migrated pool hook config only when provided', () => {
      const withoutHook = cpmmMigrator.encodeRegisterLaunchPayload({
        cpmmConfig: TEST_CONFIG,
        initialSwapFeeBps: 30,
        initialFeeSplitBps: 5000,
        recipients: [],
        minRaiseQuote: 500_000n,
        minMigrationPriceQ64Opt: null,
        migratedPoolHookConfig: null,
      });
      const withHook = cpmmMigrator.encodeRegisterLaunchPayload({
        cpmmConfig: TEST_CONFIG,
        initialSwapFeeBps: 30,
        initialFeeSplitBps: 5000,
        recipients: [],
        minRaiseQuote: 500_000n,
        minMigrationPriceQ64Opt: null,
        migratedPoolHookConfig: {
          hookProgram: dopplerLaunchHookV1.DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID,
          hookFlags: cpmm.HF_BEFORE_SWAP | cpmm.HF_FORWARD_READONLY_SIGNERS,
        },
      });

      expect(withHook.length - withoutHook.length).toBe(36);
    });
  });

  describe('encodeMigratePayload', () => {
    it('prefixes output with the migrate discriminator', () => {
      const result = cpmmMigrator.encodeMigratePayload({
        baseForDistribution: 700_000n,
        baseForLiquidity: 300_000n,
      });

      expect([...result.slice(0, 8)]).toEqual([...MIGRATE_DISCRIMINATOR]);
    });

    it('encodes baseForDistribution and baseForLiquidity as u64s', () => {
      const result = cpmmMigrator.encodeMigratePayload({
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
      poolInit.protocolFeeOwner[0],
      poolInit.protocolFeePosition[0],
      expectedLpPosition,
      cpmm.CPMM_PROGRAM_ID,
      expectedMigrationAuthority,
      adminBaseAta,
      adminQuoteAta,
      recipientAta,
    ]);
    expect(accounts.metas.map((meta) => meta.address)).toEqual(
      accounts.addresses,
    );
    expect([...accounts.hash]).toEqual([
      ...initializer.computeRemainingAccountsHash(accounts.addresses),
    ]);
  });
});

describe('cpmmMigrator spot pool helpers', () => {
  it('derives canonical spot pool accounts from token A/B inputs', async () => {
    const accounts = await cpmmMigrator.deriveSpotPoolAccounts({
      tokenAMint: TEST_MINT_A,
      tokenBMint: TEST_MINT_B,
      swapFeeBps: 30,
      liquidityOwner: TEST_WALLET,
      positionId: 7n,
    });

    expect([accounts.token0Mint, accounts.token1Mint]).toEqual(
      cpmm.sortMints(TEST_MINT_A, TEST_MINT_B),
    );
    expect(accounts.user0).not.toBe(accounts.user1);
    expect(accounts.pool).toBe(
      (await cpmm.getSpotPoolAddress(TEST_MINT_A, TEST_MINT_B, 30))[0],
    );
    expect(accounts.migrationAuthority).not.toBe(TEST_WALLET);
  });

  it('keys spot pools by canonical pair and fee tier', async () => {
    const [lowFeePool] = await cpmm.getSpotPoolAddress(
      TEST_MINT_A,
      TEST_MINT_B,
      30,
    );
    const [reversedLowFeePool] = await cpmm.getSpotPoolAddress(
      TEST_MINT_B,
      TEST_MINT_A,
      30,
    );
    const [highFeePool] = await cpmm.getSpotPoolAddress(
      TEST_MINT_A,
      TEST_MINT_B,
      100,
    );
    const [launchPool] = await cpmm.getPoolAddress(TEST_MINT_A, TEST_MINT_B);

    expect(reversedLowFeePool).toBe(lowFeePool);
    expect(highFeePool).not.toBe(lowFeePool);
    expect(launchPool).not.toBe(lowFeePool);
  });

  it('matches the on-chain spot pool key derivation', async () => {
    const [pool] = await cpmm.getSpotPoolAddress(
      TEST_MINT_A,
      TEST_USDC_MINT,
      30,
    );

    expect(pool).toBe(address('5xMMP8FsBPaC4KMeJi3uLMZ48Yxk8B9jkhgPwrLvkr1c'));
  });

  it('rejects invalid spot pool fee keys', async () => {
    await expect(
      cpmm.getSpotPoolAddress(TEST_MINT_A, TEST_MINT_B, 65_536),
    ).rejects.toThrow('u16');
  });

  it('rejects unsafe numeric position IDs', async () => {
    await expect(
      cpmmMigrator.deriveSpotPoolAccounts({
        tokenAMint: TEST_MINT_A,
        tokenBMint: TEST_MINT_B,
        swapFeeBps: 30,
        liquidityOwner: TEST_WALLET,
        positionId: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).rejects.toThrow('positionId must be a safe integer');
  });

  it('rejects unsafe numeric create instruction values', async () => {
    const input = {
      payer: TEST_SIGNER,
      tokenAMint: TEST_MINT_A,
      tokenBMint: TEST_MINT_B,
      tokenAAmount: 700_000n,
      tokenBAmount: 300_000n,
      swapFeeBps: 30,
    };
    const unsafeNumber = Number.MAX_SAFE_INTEGER + 1;

    await expect(
      cpmmMigrator.createSpotPoolInstruction({
        ...input,
        positionId: unsafeNumber,
      }),
    ).rejects.toThrow('positionId must be a safe integer');
    await expect(
      cpmmMigrator.createSpotPoolInstruction({
        ...input,
        tokenAAmount: unsafeNumber,
      }),
    ).rejects.toThrow('tokenAAmount must be a safe integer');
    await expect(
      cpmmMigrator.createSpotPoolInstruction({
        ...input,
        tokenBAmount: unsafeNumber,
      }),
    ).rejects.toThrow('tokenBAmount must be a safe integer');
    await expect(
      cpmmMigrator.createSpotPoolInstruction({
        ...input,
        minSharesOut: unsafeNumber,
      }),
    ).rejects.toThrow('minSharesOut must be a safe integer');
  });

  it('builds a createSpotPool instruction with canonical amounts', async () => {
    const ix = await cpmmMigrator.createSpotPoolInstruction({
      payer: TEST_SIGNER,
      tokenAMint: TEST_MINT_A,
      tokenBMint: TEST_MINT_B,
      tokenAAmount: 700_000n,
      tokenBAmount: 300_000n,
      swapFeeBps: 30,
      positionId: 7n,
    });
    const accounts = await cpmmMigrator.deriveSpotPoolAccounts({
      tokenAMint: TEST_MINT_A,
      tokenBMint: TEST_MINT_B,
      swapFeeBps: 30,
      liquidityOwner: TEST_WALLET,
      positionId: 7n,
    });
    const token0IsA = accounts.token0Mint === TEST_MINT_A;
    const view = new DataView(ix.data.buffer, ix.data.byteOffset);

    expect([...ix.data.slice(0, 8)]).toEqual([
      ...CREATE_SPOT_POOL_DISCRIMINATOR,
    ]);
    expect(ix.data).toHaveLength(50);
    expect(ix.accounts).toHaveLength(20);
    expect(ix.accounts![0].address).toBe(accounts.cpmmConfig);
    expect(ix.accounts![1].address).toBe(TEST_WALLET);
    expect(ix.accounts![2].address).toBe(TEST_WALLET);
    expect(ix.accounts![5].address).toBe(accounts.pool);
    expect(view.getUint16(8, true)).toBe(30);
    expect(view.getBigUint64(18, true)).toBe(token0IsA ? 700_000n : 300_000n);
    expect(view.getBigUint64(26, true)).toBe(token0IsA ? 300_000n : 700_000n);
  });

  it('includes signer objects for local signer inputs', async () => {
    const ix = await cpmmMigrator.createSpotPoolInstruction({
      payer: TEST_SIGNER,
      tokenAMint: TEST_MINT_A,
      tokenBMint: TEST_MINT_B,
      tokenAAmount: 700_000n,
      tokenBAmount: 300_000n,
      swapFeeBps: 30,
    });

    expect(ix.accounts[1].role).toBe(AccountRole.WRITABLE_SIGNER);
    expect(ix.accounts[2].role).toBe(AccountRole.READONLY_SIGNER);
    expect((ix.accounts[1] as { signer?: unknown }).signer).toBe(TEST_SIGNER);
    expect((ix.accounts[2] as { signer?: unknown }).signer).toBe(TEST_SIGNER);
  });

  it('marks a Squads vault address as signer without a local signer object', async () => {
    const ix = await cpmmMigrator.createSpotPoolInstruction({
      payer: TEST_VAULT,
      liquidityOwner: TEST_VAULT,
      tokenAMint: TEST_MINT_A,
      tokenBMint: TEST_MINT_B,
      tokenAAmount: 700_000n,
      tokenBAmount: 300_000n,
      swapFeeBps: 30,
    });
    const accounts = await cpmmMigrator.deriveSpotPoolAccounts({
      tokenAMint: TEST_MINT_A,
      tokenBMint: TEST_MINT_B,
      swapFeeBps: 30,
      liquidityOwner: TEST_VAULT,
    });

    expect(ix.accounts[1]).toEqual({
      address: TEST_VAULT,
      role: AccountRole.WRITABLE_SIGNER,
    });
    expect(ix.accounts[2]).toEqual({
      address: TEST_VAULT,
      role: AccountRole.READONLY_SIGNER,
    });
    expect(ix.accounts[11].address).toBe(accounts.position);
    expect(ix.accounts[12].address).toBe(accounts.user0);
    expect(ix.accounts[13].address).toBe(accounts.user1);
  });
});
