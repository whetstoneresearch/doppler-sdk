import { describe, it, expect } from 'vitest';
import { createNoopSigner, address, AccountRole } from '@solana/kit';
import * as pm from '../../../src/solana/predictionMarkets/index.js';
import {
  getClaimInstructionDataDecoder,
  getRegisterEntryInstructionDataDecoder,
  getMigrateEntryInstructionDataDecoder,
} from '../../../src/solana/generated/predictionMigrator/index.js';
import { getInitializeLaunchInstructionDataDecoder } from '../../../src/solana/generated/initializer/index.js';
import {
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '../../../src/solana/core/constants.js';
const signer = createNoopSigner(address('11111111111111111111111111111111'));
const mint = address('So11111111111111111111111111111111111111112');
const id = pm.outcomeIdFromLabel('YES');
describe('prediction lifecycle planners', () => {
  it('rejects missing, duplicated, truncated, and excessive outcomes', () => {
    expect(() => pm.assertOutcomeIds([id])).toThrow();
    expect(() => pm.assertOutcomeIds([id, id])).toThrow();
    expect(() => pm.outcomeIdFromLabel('x'.repeat(33))).toThrow();
    expect(() =>
      pm.assertOutcomeIds(
        Array.from({ length: 9 }, (_, i) => pm.outcomeIdFromLabel(String(i)))
      )
    ).toThrow();
    pm.assertOutcomeIds(
      Array.from({ length: 8 }, (_, i) => pm.outcomeIdFromLabel(String(i)))
    );
  });
  it('prepares explicit oracle and creator-scoped market separately', async () => {
    const oracle = await pm.prepareOracle({
      oracleAuthority: signer,
      nonce: 1n,
      outcomeIds: [id, pm.outcomeIdFromLabel('NO')],
    });
    expect(oracle.instructions).toHaveLength(1);
    const market = await pm.prepareMarket({
      creator: signer,
      oracle: oracle.oracle,
      quoteMint: mint,
    });
    expect(market.instructions[0].accounts?.map((a) => a.address)).toContain(
      market.potVault
    );
  });
  it('commits and appends distinct register, swap, settlement account lists', async () => {
    const result = await pm.prepareOutcomeLaunch({
      oracle: mint,
      creator: signer,
      outcomeId: id,
      launch: {
        config: mint,
        launchId: id,
        launchAccounts: {
          baseMint: signer,
          quoteMint: mint,
          baseVault: signer,
          quoteVault: signer,
        },
        payer: signer,
        supply: {
          baseDecimals: 6,
          baseTotalSupply: 1000n,
          baseForDistribution: 0n,
          baseForLiquidity: 0n,
        },
        curve: {
          curveVirtualBase: 1000n,
          curveVirtualQuote: 1000n,
          swapFeeBps: 100,
        },
      },
    });
    const data = getInitializeLaunchInstructionDataDecoder().decode(
      result.instruction.data!
    );
    expect(data.feeBeneficiaries).toEqual([
      { wallet: signer.address, shareBps: 10000 },
    ]);
    expect(data.allowBuy).toBe(1);
    expect(data.allowSell).toBe(0);
    expect(data.hookFlags).toBe(129);
    expect(result.instruction.accounts?.slice(-3).map((a) => a.role)).toEqual([
      AccountRole.READONLY,
      AccountRole.WRITABLE,
      AccountRole.WRITABLE,
    ]);
    expect(
      getRegisterEntryInstructionDataDecoder().decode(data.migratorInitPayload)
        .outcomeId
    ).toEqual(id);
    expect(data.migratorMigratePayload).toHaveLength(8);
    expect(
      getMigrateEntryInstructionDataDecoder().decode(
        data.migratorMigratePayload
      )
    ).toBeDefined();
  });
  it('rejects an explicitly empty beneficiary list before transaction construction', async () => {
    await expect(
      pm.prepareOutcomeLaunch({
        oracle: mint,
        creator: signer,
        outcomeId: id,
        launch: { feeBeneficiaries: [] } as any,
      })
    ).rejects.toThrow('feeBeneficiaries must be nonempty');
  });
  it('harvest recreates the outcome ATA and encodes claim(0)', async () => {
    const plan = await pm.prepareHarvest({
      market: mint,
      potVault: mint,
      winnerMint: mint,
      quoteMint: mint,
      claimer: signer,
      payer: signer,
    });
    expect(plan.instructions).toHaveLength(3);
    expect(
      getClaimInstructionDataDecoder().decode(plan.claimInstruction.data!)
        .burnAmount
    ).toBe(0n);
  });
  it('rejects unverified Token-2022 settlement configurations', () => {
    expect(() =>
      pm.assertPredictionTokenProgram(TOKEN_2022_PROGRAM_ADDRESS)
    ).toThrow('SPL Token');
    pm.assertPredictionTokenProgram(TOKEN_PROGRAM_ADDRESS);
  });
  it('preserves cumulative claim entitlement across late contributions', () => {
    const market = {
      isResolved: true,
      isVoid: false,
      totalPot: 4n,
      claimableSupply: 3n,
    };
    expect(pm.previewClaim({ market, burnAmount: 1n }).claimableNow).toBe(1n);
    expect(
      pm.previewClaim({
        market: { ...market, totalPot: 6n },
        receipt: { burnedAmount: 1n, rewardDebt: 1n },
        burnAmount: 0n,
      }).claimableNow
    ).toBe(1n);
    expect(
      pm.previewClaim({ market: { ...market, totalPot: 1n }, burnAmount: 1n })
        .canExecute
    ).toBe(false);
  });
  it('releases refund dust only on final circulating-supply burn', () => {
    const entry = {
      isMigrated: true,
      contribution: 2n,
      refundSupply: 3n,
      refundedQuote: 1n,
    };
    expect(
      pm.previewRefund({
        entry,
        isVoid: true,
        burnAmount: 1n,
        currentMintSupply: 2n,
      }).refundAmount
    ).toBe(0n);
    expect(
      pm.previewRefund({
        entry,
        isVoid: true,
        burnAmount: 1n,
        currentMintSupply: 1n,
      }).refundAmount
    ).toBe(1n);
    expect(() =>
      pm.previewRefund({
        entry,
        isVoid: false,
        burnAmount: 1n,
        currentMintSupply: 1n,
      })
    ).toThrow();
  });
  it('quotes with rounded-up fees and enforces available real reserve', () => {
    expect(
      pm.quoteBuy({
        amountIn: 100n,
        baseReserve: 1000n,
        quoteReserve: 0n,
        virtualBase: 1000n,
        virtualQuote: 1000n,
        swapFeeBps: 100,
        slippageBps: 100,
      })
    ).toEqual({ amountOut: 180n, feeAmount: 1n, minAmountOut: 178n });
    expect(() =>
      pm.quoteBuy({
        amountIn: 1n,
        baseReserve: 1000n,
        quoteReserve: 0n,
        virtualBase: 1000n,
        virtualQuote: 1000n,
        swapFeeBps: 100,
      })
    ).toThrow();
  });
});
