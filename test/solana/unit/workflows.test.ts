import { describe, expect, it } from 'vitest';
import { address, type Address } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';

import {
  assertMigrationQuoteThreshold,
  cpmm,
  dopplerLaunchHookV1,
  cpmmMigrator,
  curveSwapExactIn,
  getMigrationQuoteProgress,
  initializer,
  migrateLaunch,
  swapExactIn,
} from '@/solana/index.js';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '@/solana/core/constants.js';
import type { Pool } from '@/solana/core/types.js';

const WSOL_MINT = address('So11111111111111111111111111111111111111112');
const COMPUTE_BUDGET_PROGRAM_ID = address(
  'ComputeBudget111111111111111111111111111111',
);

function createTestPool({
  config,
  token0Mint,
  token1Mint,
  vault0,
  vault1,
  authority,
}: {
  config: Address;
  token0Mint: Address;
  token1Mint: Address;
  vault0: Address;
  vault1: Address;
  authority: Address;
}): Pool {
  return {
    config,
    token0Mint,
    token1Mint,
    vault0,
    vault1,
    authority,
    bump: 255,
    reserve0: 1_000_000n,
    reserve1: 2_000_000n,
    totalShares: 1_000_000n,
    swapFeeBps: 100,
    feeSplitBps: 5_000,
    feeGrowthGlobal0Q64: 0n,
    feeGrowthGlobal1Q64: 0n,
    feesUnclaimed0: 0n,
    feesUnclaimed1: 0n,
    hookProgram: SYSTEM_PROGRAM_ADDRESS,
    hookFlags: 0,
    liquidityMeasureTokenIndex: 0,
    kLast: 0n,
    protocolFeePosition: address('11111111111111111111111111111111'),
    locked: 0,
    version: 1,
    reserved: new Uint8Array(7),
  };
}

describe('Solana workflow helpers', () => {
  it('prepares a WSOL curve exact-in buy with setup before the swap', async () => {
    const payer = await generateKeyPairSigner();
    const cosigner = await generateKeyPairSigner();
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const launch = address('8h4Nw2m3qPH4tB3x3fcQADkHDzWr7TjapfxnY4LuRk7w');
    const launchAuthority = address(
      '5hX6e1cyWUFHMzLM5VGuxFHXU8Gykqa5R2rsJqnyqkyU',
    );
    const launchFeeState = address(
      '3x13Y2NkqGGLNxbh3Pcz9F4SNgtVtFU6fqfmbs36FxgY',
    );

    const prepared = await curveSwapExactIn({
      launch,
      launchAuthority,
      baseVault: baseVault.address,
      quoteVault: quoteVault.address,
      launchFeeState,
      baseMint: baseMint.address,
      quoteMint: WSOL_MINT,
      payer,
      amountIn: 100_000n,
      minAmountOut: 1n,
      tradeDirection: initializer.TRADE_DIRECTION_BUY,
      remainingAccounts: [cosigner],
    });

    expect(prepared.setupInstructions).toHaveLength(4);
    expect(prepared.instructions).toEqual([
      ...prepared.setupInstructions,
      prepared.swapInstruction,
    ]);
    expect(prepared.userIn).toBe(prepared.userQuoteAccount);
    expect(prepared.userOut).toBe(prepared.userBaseAccount);
    expect(prepared.swapInstruction.programAddress).toBe(
      initializer.INITIALIZER_PROGRAM_ID,
    );
    expect(prepared.swapInstruction.accounts![4].address).toBe(
      prepared.userBaseAccount,
    );
    expect(prepared.swapInstruction.accounts![5].address).toBe(
      prepared.userQuoteAccount,
    );
    expect(prepared.swapInstruction.accounts![9].address).toBe(
      dopplerLaunchHookV1.DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID,
    );
    expect(prepared.swapInstruction.accounts!.at(-1)?.address).toBe(
      cosigner.address,
    );
  });

  it('prepares a CPMM exact-in swap with quote, slippage, and token ATAs', async () => {
    const payer = await generateKeyPairSigner();
    const token0Mint = await generateKeyPairSigner();
    const token1Mint = await generateKeyPairSigner();
    const poolAddress = address('3x13Y2NkqGGLNxbh3Pcz9F4SNgtVtFU6fqfmbs36FxgY');
    const pool = createTestPool({
      config: address('E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL'),
      token0Mint: token0Mint.address,
      token1Mint: token1Mint.address,
      vault0: address('2y7VfY6FEteTm5NntQbXcp6BqkhZsd34z8gLT6Rp6g9T'),
      vault1: address('5kWU9u4CuSNCvTzwUW6Wm4j9aigZFg3sLKzg4UFK2qwg'),
      authority: address('5hX6e1cyWUFHMzLM5VGuxFHXU8Gykqa5R2rsJqnyqkyU'),
    });

    const prepared = await swapExactIn({
      pool: { address: poolAddress, account: pool },
      payer,
      amountIn: 10_000n,
      tradeDirection: 1,
      slippageBps: 100n,
      token0Program: TOKEN_2022_PROGRAM_ADDRESS,
      token1Program: TOKEN_PROGRAM_ADDRESS,
    });

    const expectedQuote = cpmm.getSwapQuote(pool, 10_000n, 1);
    expect(prepared.quote).toEqual(expectedQuote);
    expect(prepared.minAmountOut).toBe(
      (expectedQuote.amountOut * 9_900n) / 10_000n,
    );
    expect(prepared.setupInstructions).toHaveLength(2);
    expect(prepared.instructions).toEqual([
      ...prepared.setupInstructions,
      prepared.swapInstruction,
    ]);
    expect(prepared.userIn).toBe(prepared.userToken1);
    expect(prepared.userOut).toBe(prepared.userToken0);
    expect(prepared.swapInstruction.accounts![3].address).toBe(pool.vault1);
    expect(prepared.swapInstruction.accounts![4].address).toBe(pool.vault0);
  });

  it('prepares migrateLaunch with compute budget, recipient ATAs, and CPMM metas', async () => {
    const payer = await generateKeyPairSigner();
    const recipient = await generateKeyPairSigner();
    const baseMint = await generateKeyPairSigner();
    const quoteMint = await generateKeyPairSigner();
    const launch = address('8h4Nw2m3qPH4tB3x3fcQADkHDzWr7TjapfxnY4LuRk7w');
    const launchAuthority = address(
      '5hX6e1cyWUFHMzLM5VGuxFHXU8Gykqa5R2rsJqnyqkyU',
    );
    const recipientAta = address(
      '4Ux8qqquRoLtMfXTrkVN1sRAz7E3BbFyyq1UFgdKpbXr',
    );
    const migrationAccounts =
      await cpmmMigrator.buildCpmmMigrationRemainingAccounts({
        launch,
        baseMint: baseMint.address,
        quoteMint: quoteMint.address,
        launchAuthority,
        adminBaseAta: address('2y7VfY6FEteTm5NntQbXcp6BqkhZsd34z8gLT6Rp6g9T'),
        adminQuoteAta: address('5kWU9u4CuSNCvTzwUW6Wm4j9aigZFg3sLKzg4UFK2qwg'),
        recipientAtas: [recipientAta],
      });

    const prepared = migrateLaunch({
      deployment: {
        initializerProgram: initializer.INITIALIZER_PROGRAM_ID,
        initializerConfig: address(
          'E45nSdnfANtYhCy6qZXo2a7qAWCU6pYjpqsby1bbkaiL',
        ),
        cpmmMigratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
      },
      launch,
      launchAuthority,
      baseMint: baseMint.address,
      quoteMint: quoteMint.address,
      baseVault: address('5M6Ko42FUVA4ovM7EMERuhRdT49yYRaYtLuQ7jnhkBhC'),
      quoteVault: address('7ZAv1WfVd2k9TtPGC82ZxPwpE2L8YB4Y3dByQNCXc9NL'),
      launchFeeState: address('3x13Y2NkqGGLNxbh3Pcz9F4SNgtVtFU6fqfmbs36FxgY'),
      payer,
      cpmmMigration: migrationAccounts,
      recipients: [{ wallet: recipient.address }],
    });

    expect(prepared.computeUnitLimitInstruction?.programAddress).toBe(
      COMPUTE_BUDGET_PROGRAM_ID,
    );
    expect(prepared.recipientAtaInstructions).toHaveLength(1);
    expect(prepared.instructions).toEqual([
      prepared.computeUnitLimitInstruction,
      ...prepared.recipientAtaInstructions,
      prepared.migrateInstruction,
    ]);
    expect(
      prepared.migrateInstruction
        .accounts!.slice(14)
        .map(({ address }) => address),
    ).toEqual(migrationAccounts.metas.map(({ address }) => address));
  });

  it('reports migration quote progress net of pending fees', async () => {
    const rpc = {
      getTokenAccountBalance: () => ({
        send: async () => ({ value: { amount: '1000' } }),
      }),
    };

    await expect(
      assertMigrationQuoteThreshold({
        rpc,
        quoteVault: WSOL_MINT,
        pendingQuoteFees: 200n,
        minRaiseQuote: 900n,
      }),
    ).rejects.toThrow('below minRaiseQuote');

    await expect(
      getMigrationQuoteProgress({
        rpc,
        quoteVault: WSOL_MINT,
        pendingQuoteFees: 200n,
      }),
    ).resolves.toEqual({
      quoteVaultAmount: 1000n,
      pendingQuoteFees: 200n,
      migrationQuoteAmount: 800n,
    });
  });
});
