import { describe, expect, it } from 'vitest';
import { zeroAddress, type Address, type Hex } from 'viem';
import {
  normalizeDynamicHookState,
  normalizeRehypeFeeDistributionInfo,
  normalizeRehypeFeeSchedule,
  normalizeRehypeHookFees,
  normalizeRehypePoolInfo,
  normalizeRehypePosition,
  parseAirlockLiquidityMigrator,
  parseAirlockPoolOrHook,
} from '../../../../src/evm/entities/auction/contractResults';

const asset = '0x0000000000000000000000000000000000000001' as Address;
const numeraire = '0x0000000000000000000000000000000000000002' as Address;
const buybackDst = '0x0000000000000000000000000000000000000003' as Address;
const liquidityMigrator =
  '0x0000000000000000000000000000000000000004' as Address;
const poolOrHook = '0x0000000000000000000000000000000000000005' as Address;
const positionSalt = `0x${'11'.repeat(32)}` as Hex;

describe('contract result normalizers', () => {
  it('parses Airlock asset data from object and tuple shapes', () => {
    expect(
      parseAirlockPoolOrHook({
        poolOrHook,
        liquidityMigrator,
      }),
    ).toBe(poolOrHook);
    expect(
      parseAirlockLiquidityMigrator({
        poolOrHook,
        liquidityMigrator,
      }),
    ).toBe(liquidityMigrator);

    expect(
      parseAirlockPoolOrHook([
        numeraire,
        zeroAddress,
        zeroAddress,
        liquidityMigrator,
        zeroAddress,
        poolOrHook,
      ]),
    ).toBe(poolOrHook);
    expect(
      parseAirlockLiquidityMigrator([
        numeraire,
        zeroAddress,
        zeroAddress,
        liquidityMigrator,
      ]),
    ).toBe(liquidityMigrator);
  });

  it('normalizes dynamic hook state from object and tuple shapes', () => {
    expect(
      normalizeDynamicHookState({
        totalTokensSold: 3n,
        totalProceeds: 4n,
      }),
    ).toEqual({
      totalTokensSold: 3n,
      totalProceeds: 4n,
    });

    expect(normalizeDynamicHookState([1n, -2n, 3n, 4n, 5n, 6n])).toEqual({
      totalTokensSold: 3n,
      totalProceeds: 4n,
    });
  });

  it('normalizes rehype fee distribution from tuple shapes', () => {
    expect(
      normalizeRehypeFeeDistributionInfo([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]),
    ).toEqual({
      assetFeesToAssetBuybackWad: 1n,
      assetFeesToNumeraireBuybackWad: 2n,
      assetFeesToBeneficiaryWad: 3n,
      assetFeesToLpWad: 4n,
      numeraireFeesToAssetBuybackWad: 5n,
      numeraireFeesToNumeraireBuybackWad: 6n,
      numeraireFeesToBeneficiaryWad: 7n,
      numeraireFeesToLpWad: 8n,
    });
  });

  it('normalizes rehype fee schedule and preserves explicit zeros', () => {
    expect(
      normalizeRehypeFeeSchedule({
        startingTime: 0,
        startFee: 100,
        endFee: 200,
        lastFee: 0,
        durationSeconds: 3600,
      }),
    ).toEqual({
      startingTime: 0,
      startFee: 100,
      endFee: 200,
      lastFee: 0,
      durationSeconds: 3600,
    });
  });

  it('normalizes rehype hook fees from object shapes', () => {
    expect(
      normalizeRehypeHookFees({
        fees0: 1n,
        fees1: 2n,
        beneficiaryFees0: 3n,
        beneficiaryFees1: 4n,
        airlockOwnerFees0: 5n,
        airlockOwnerFees1: 6n,
        customFee: 3000,
      }),
    ).toEqual({
      fees0: 1n,
      fees1: 2n,
      beneficiaryFees0: 3n,
      beneficiaryFees1: 4n,
      airlockOwnerFees0: 5n,
      airlockOwnerFees1: 6n,
      customFee: 3000,
    });
  });

  it('normalizes rehype pool info and positions', () => {
    expect(normalizeRehypePoolInfo([asset, numeraire, buybackDst])).toEqual({
      asset,
      numeraire,
      buybackDst,
    });

    expect(
      normalizeRehypePosition({
        tickLower: -120,
        tickUpper: 120,
        liquidity: 123n,
        salt: positionSalt,
      }),
    ).toEqual({
      tickLower: -120,
      tickUpper: 120,
      liquidity: 123n,
      salt: positionSalt,
    });
  });

  it('throws when required result fields are missing', () => {
    expect(() =>
      normalizeRehypeFeeSchedule({
        startingTime: 0,
        startFee: 100,
        endFee: 200,
        lastFee: 0,
      }),
    ).toThrow(/durationSeconds/);

    expect(() => normalizeRehypePoolInfo([asset, numeraire])).toThrow(
      /buybackDst/,
    );
  });
});
