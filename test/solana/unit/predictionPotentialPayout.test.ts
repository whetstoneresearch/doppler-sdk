import { describe, it, expect } from 'vitest';
import { address } from '@solana/kit';
import {
  calculatePotentialPayoutIfWinner,
  assertPotentialPayoutCandidate,
} from '../../../src/solana/predictionMarkets/potentialPayout.js';
const snapshot = {
  isVoid: false,
  totalPot: 0n,
  totalClaimed: 0n,
  tokenAmount: 10n,
  candidateMintSupply: 1000n,
  candidateUnsoldBase: 900n,
  unsettledQuoteVaults: [
    { amount: 110n, pendingFees: 10n },
    { amount: 220n, pendingFees: 20n },
  ],
};
describe('hypothetical prediction payout', () => {
  it('estimates before oracle resolution and excludes quote fees', () => {
    expect(calculatePotentialPayoutIfWinner(snapshot)).toEqual({
      kind: 'hypothetical-remaining-pot',
      realizedRemainingPot: 0n,
      unsettledContributions: 300n,
      potUsed: 300n,
      claimableSupplyUsed: 100n,
      payoutQuoteForTokenAmount: 30n,
      isEstimate: true,
    });
  });
  it('separates remaining realized pot and future settlement contributions', () => {
    const result = calculatePotentialPayoutIfWinner({
      ...snapshot,
      totalPot: 100n,
      totalClaimed: 40n,
      unsettledQuoteVaults: [{ amount: 220n, pendingFees: 20n }],
    });
    expect(result.realizedRemainingPot).toBe(60n);
    expect(result.unsettledContributions).toBe(200n);
    expect(result.payoutQuoteForTokenAmount).toBe(26n);
  });
  it('uses fixed winning supply after earlier holder burns', () => {
    const result = calculatePotentialPayoutIfWinner({
      ...snapshot,
      totalPot: 100n,
      totalClaimed: 40n,
      candidateMintSupply: 60n,
      candidateUnsoldBase: 0n,
      fixedWinnerSupply: 100n,
      unsettledQuoteVaults: [],
    });
    expect(result.payoutQuoteForTokenAmount).toBe(6n);
  });
  it('rejects zero surviving supply, void markets and inconsistent fees', () => {
    expect(() =>
      calculatePotentialPayoutIfWinner({
        ...snapshot,
        candidateUnsoldBase: 1000n,
      })
    ).toThrow('zero');
    expect(() =>
      calculatePotentialPayoutIfWinner({ ...snapshot, isVoid: true })
    ).toThrow('void');
    expect(() =>
      calculatePotentialPayoutIfWinner({
        ...snapshot,
        unsettledQuoteVaults: [{ amount: 1n, pendingFees: 2n }],
      })
    ).toThrow('fees');
  });
});

describe('finalized candidate eligibility', () => {
  const yesMint = address('So11111111111111111111111111111111111111112');
  const noMint = address('11111111111111111111111111111111');
  const yesId = new Uint8Array(32).fill(1);
  const noId = new Uint8Array(32).fill(2);
  const oracle = {
    isFinalized: true,
    outcomeIds: [yesId, noId],
    outcomeCount: 2,
    winningOutcomeId: yesId,
  };
  const market = { outcomeMints: [yesMint, noMint] };
  it('rejects the known loser before the market settlement resolves it', () => {
    expect(() =>
      assertPotentialPayoutCandidate(oracle, market, noMint)
    ).toThrow('losing outcome');
  });
  it('permits the actual winner and unresolved hypothetical candidates', () => {
    expect(() =>
      assertPotentialPayoutCandidate(oracle, market, yesMint)
    ).not.toThrow();
    expect(() =>
      assertPotentialPayoutCandidate(
        { ...oracle, isFinalized: false },
        market,
        noMint
      )
    ).not.toThrow();
  });
});
