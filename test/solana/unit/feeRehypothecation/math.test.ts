import { address, getAddressEncoder } from '@solana/kit';
import { describe, expect, it } from 'vitest';

import { feeRehypothecation } from '@/solana/index.js';

describe('fee rehypothecation strategies and math', () => {
  it('exposes four valid routing strategies', () => {
    const strategies = [
      feeRehypothecation.allFeesToBeneficiariesInAsset(),
      feeRehypothecation.allFeesToBeneficiariesInNumeraire(),
      feeRehypothecation.inKindBeneficiaryFees(),
      feeRehypothecation.balancedFourBucket(),
    ];

    for (const strategy of strategies) {
      expect(() =>
        feeRehypothecation.validateFeeRehypothecationStrategy(strategy),
      ).not.toThrow();
    }
  });

  it('sorts beneficiaries by public-key bytes and validates shares', () => {
    const first = address('SysvarC1ock11111111111111111111111111111111');
    const second = address('Sysvar1nstructions1111111111111111111111111');
    const sorted =
      feeRehypothecation.validateAndSortFeeRehypothecationBeneficiaries([
        { wallet: second, shareBps: 4_000 },
        { wallet: first, shareBps: 6_000 },
      ]);
    const encoder = getAddressEncoder();
    const expected = [first, second].sort((left, right) =>
      Buffer.compare(
        Buffer.from(encoder.encode(left)),
        Buffer.from(encoder.encode(right)),
      ),
    );

    expect(sorted.map(({ wallet }) => wallet)).toEqual(expected);
    expect(() =>
      feeRehypothecation.validateAndSortFeeRehypothecationBeneficiaries([
        { wallet: first, shareBps: 9_999 },
      ]),
    ).toThrow(/sum to 10000/);
  });

  it('allows no beneficiaries when every fee remains an in-kind buyback', () => {
    const directBuyback = {
      routingMode:
        feeRehypothecation.FEE_REHYPOTHECATION_ROUTING_MODE_DIRECT_BUYBACK,
      feeRouting: {
        assetFees: {
          assetBuybackBps: 10_000,
          numeraireBuybackBps: 0,
          beneficiaryBps: 0,
          lpBps: 0,
        },
        numeraireFees: {
          assetBuybackBps: 0,
          numeraireBuybackBps: 10_000,
          beneficiaryBps: 0,
          lpBps: 0,
        },
      },
    } as const;

    expect(
      feeRehypothecation.feeRehypothecationRequiresBeneficiaries(directBuyback),
    ).toBe(false);
    expect(
      feeRehypothecation.validateAndSortFeeRehypothecationBeneficiaries(
        [],
        directBuyback,
      ),
    ).toEqual([]);
    expect(() =>
      feeRehypothecation.validateAndSortFeeRehypothecationBeneficiaries(
        [],
        feeRehypothecation.balancedFourBucket(),
      ),
    ).toThrow(/between 1 and 8/);
  });

  it('uses cumulative allocation so batching does not change bucket totals', () => {
    const route = feeRehypothecation.balancedFourBucket().feeRouting.assetFees;
    const once = feeRehypothecation.splitCumulativeFeeIncrement(route, 0n, 4n);
    let cumulative = 0n;
    const batched = [0n, 0n, 0n, 0n];
    for (let index = 0; index < 4; index += 1) {
      const increment = feeRehypothecation.splitCumulativeFeeIncrement(
        route,
        cumulative,
        1n,
      );
      increment.forEach((amount, bucket) => {
        batched[bucket] = batched[bucket]! + amount;
      });
      cumulative += 1n;
    }

    expect(once).toEqual([1n, 1n, 1n, 1n]);
    expect(batched).toEqual(once);
  });

  it('quotes sequential zero-fee conversions and protects nonzero outputs', () => {
    const baseToQuote = feeRehypothecation.quoteZeroFeeExactIn({
      amountIn: 100n,
      reserveIn: 1_000n,
      reserveOut: 2_000n,
      virtualIn: 100n,
      virtualOut: 200n,
    });
    const quoteToBase = feeRehypothecation.quoteZeroFeeExactIn({
      amountIn: 100n,
      reserveIn: 2_000n - baseToQuote,
      reserveOut: 1_000n + 100n,
      virtualIn: 200n,
      virtualOut: 100n,
    });

    expect(baseToQuote).toBe(183n);
    expect(quoteToBase).toBeGreaterThan(0n);
    expect(feeRehypothecation.calculateMinimumOutput(baseToQuote)).toBe(182n);
    expect(() =>
      feeRehypothecation.resolveProtectedMinimumOutput({
        expectedAmountOut: baseToQuote,
        minimumAmountOut: 184n,
      }),
    ).toThrow(/incompatible/);
    expect(() =>
      feeRehypothecation.quoteZeroFeeExactIn({
        amountIn: 1n << 64n,
        reserveIn: 1n,
        reserveOut: 1n,
        virtualIn: 0n,
        virtualOut: 0n,
      }),
    ).toThrow(/u64::MAX/);
  });

  it('assigns beneficiary rounding remainder to the final beneficiary', () => {
    const first = feeRehypothecation.calculateBeneficiaryEntitlement({
      cumulativeFees: 1n,
      beneficiarySharesBps: [5_000, 5_000],
      beneficiaryIndex: 0,
    });
    const second = feeRehypothecation.calculateBeneficiaryEntitlement({
      cumulativeFees: 1n,
      beneficiarySharesBps: [5_000, 5_000],
      beneficiaryIndex: 1,
    });

    expect(first).toBe(0n);
    expect(second).toBe(1n);
  });
});
