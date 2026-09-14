import { describe, expect, it } from 'vitest';
import * as pm from '@/solana/predictionMarkets/index.js';
import * as oracleClient from '@/solana/trustedOracle/index.js';
import * as prediction from '@/solana/migrators/predictionMigrator/index.js';
import * as initializer from '@/solana/initializer/index.js';
import * as generated from '@/solana/generated/initializer/index.js';
import {
  fixture,
  buyFixture,
  encoded,
  ZERO,
  mints,
  payer,
  ids,
} from '../fixtures/prediction.js';

describe('prediction buy quotes from serialized accounts', () => {
  it('excludes distribution, liquidity and pending beneficiary/protocol fees', async () => {
    const f = await buyFixture();
    const quote = await pm.fetchPredictionBuyQuote(f.rpc, f.input);
    // Executable XYK: (650 real + 1000 virtual) * 99 net / (500 + 1000 + 99).
    expect(quote).toMatchObject({
      amountOut: 102n,
      feeAmount: 1n,
      minAmountOut: 101n,
      pendingBaseFees: 50n,
      pendingQuoteFees: 25n,
    });
  });
  it('keeps reserved base fees in the hypothetical surviving supply', async () => {
    const f = await buyFixture([1, 2]);
    const estimate = await pm.fetchPotentialPayoutIfWinner(f.rpc, {
      market: f.market,
      candidateMint: mints[0],
      tokenAmount: 9050n,
    });
    expect(estimate).toMatchObject({
      claimableSupplyUsed: 9050n,
      unsettledContributions: 500n,
      payoutQuoteForTokenAmount: 500n,
    });
  });
  it('rejects inconsistent base fees in the hypothetical payout', async () => {
    const f = await buyFixture([1, 2]);
    f.feeData.distributedProtocolBaseFees = 1000n;
    f.update();
    await expect(
      pm.fetchPotentialPayoutIfWinner(f.rpc, {
        market: f.market,
        candidateMint: mints[0],
        tokenAmount: 1n,
      }),
    ).rejects.toThrow('Inconsistent candidate base fees');
  });
  it('rejects inactive launches and unsupported curves', async () => {
    for (const change of [
      { phase: initializer.PHASE_MIGRATED },
      { allowBuy: 0 },
      { curveKind: 1 },
    ]) {
      const f = await buyFixture();
      Object.assign(f.launchData, change);
      f.update();
      await expect(
        pm.fetchPredictionBuyQuote(f.rpc, f.input),
      ).rejects.toThrow();
    }
  });
  it('rejects allocations plus fees that exceed the base vault', async () => {
    const f = await buyFixture();
    f.launchData.baseForDistribution = 900n;
    f.update();
    await expect(pm.fetchPredictionBuyQuote(f.rpc, f.input)).rejects.toThrow(
      'Inconsistent reserve/fee snapshot',
    );
  });
  it('rejects negative pending fees and mismatched fee rates', async () => {
    for (const field of [
      'distributedProtocolBaseFees',
      'distributedProtocolQuoteFees',
    ] as const) {
      const f = await buyFixture();
      f.feeData[field] = 1000n;
      f.update();
      await expect(pm.fetchPredictionBuyQuote(f.rpc, f.input)).rejects.toThrow(
        'Inconsistent reserve/fee snapshot',
      );
    }
    const f = await buyFixture();
    f.feeData.swapFeeBps = 200;
    f.update();
    await expect(pm.fetchPredictionBuyQuote(f.rpc, f.input)).rejects.toThrow(
      'swap fee state',
    );
  });
});

describe('payout estimates across changing RPC state', () => {
  it.each([
    { totalPot: 1n },
    { totalClaimed: 1n },
    { isResolved: true },
    { isVoid: true },
  ])('rejects a market change between reads: %s', async (patch) => {
    const f = await buyFixture();
    f.readHook.current = (key, count) => {
      if (key !== f.market || count !== 2) return;
      const current = f.accounts.get(key)!;
      const data = prediction
        .getMarketDecoder()
        .decode(Buffer.from(current.data[0], 'base64'));
      f.accounts.set(
        key,
        encoded(
          prediction.getMarketEncoder().encode({ ...data, ...patch }),
          current.owner,
        ),
      );
    };
    await expect(
      pm.fetchPotentialPayoutIfWinner(f.rpc, {
        market: f.market,
        candidateMint: mints[0],
        tokenAmount: 1n,
      }),
    ).rejects.toThrow('Market changed while estimating payout');
  });
  it('rejects an entry settling between the two snapshots', async () => {
    const f = await buyFixture();
    const [entry] = await prediction.getPredictionEntryAddress(
      f.market,
      mints[0],
    );
    f.readHook.current = (key, count) => {
      if (key !== f.market || count !== 2) return;
      const current = f.accounts.get(entry)!;
      const data = prediction
        .getEntryDecoder()
        .decode(Buffer.from(current.data[0], 'base64'));
      f.accounts.set(
        entry,
        encoded(
          prediction.getEntryEncoder().encode({ ...data, isMigrated: true }),
          current.owner,
        ),
      );
    };
    await expect(
      pm.fetchPotentialPayoutIfWinner(f.rpc, {
        market: f.market,
        candidateMint: mints[0],
        tokenAmount: 1n,
      }),
    ).rejects.toThrow('Market changed while estimating payout');
  });
  it('rechecks oracle finalization before returning an estimate', async () => {
    const f = await buyFixture();
    f.readHook.current = (key, count) => {
      if (key !== f.oracle || count !== 2) return;
      const current = f.accounts.get(key)!;
      const data = oracleClient
        .getOracleStateDecoder()
        .decode(Buffer.from(current.data[0], 'base64'));
      f.accounts.set(
        key,
        encoded(
          oracleClient
            .getOracleStateEncoder()
            .encode({ ...data, isFinalized: true, winningOutcomeId: ids[1] }),
          current.owner,
        ),
      );
    };
    await expect(
      pm.fetchPotentialPayoutIfWinner(f.rpc, {
        market: f.market,
        candidateMint: mints[0],
        tokenAmount: 1n,
      }),
    ).rejects.toThrow('losing outcome');
  });
  it('returns a quote for an unchanged snapshot', async () => {
    const f = await buyFixture();
    expect(
      await pm.fetchPotentialPayoutIfWinner(f.rpc, {
        market: f.market,
        candidateMint: mints[0],
        tokenAmount: 9050n,
      }),
    ).toMatchObject({
      unsettledContributions: 500n,
      claimableSupplyUsed: 9050n,
    });
  });
});

describe('prediction market resume from serialized chain state', () => {
  it('recovers launch and derived settlement bindings without a saved manifest', async () => {
    const f = await fixture();
    const view = await pm.fetchPredictionMarketWithLaunches(f.rpc, f.market);
    expect(view.outcomes.map((o) => o.entry.data.baseMint)).toEqual(mints);
    for (const outcome of view.outcomes) {
      expect(outcome.launchAuthority).toBe(
        (
          await initializer.getLaunchAuthorityAddress(outcome.launch.address)
        )[0],
      );
      expect(outcome.launchFeeState).toBe(
        (await initializer.getLaunchFeeStateAddress(outcome.launch.address))[0],
      );
      expect(outcome.config).toBe((await initializer.getConfigAddress())[0]);
    }
  });
  it('skips confirmed settled entries and puts the un-settled winner first', async () => {
    const f = await fixture();
    const plans = await pm.prepareRemainingSettlements(f.rpc, {
      market: f.market,
      payer,
    });
    expect(plans.map((p) => p.baseMint)).toEqual([mints[2], mints[1]]);
    expect(plans.map((p) => p.instructions[0].accounts?.[3].address)).toEqual([
      mints[2],
      mints[1],
    ]);
    expect(
      (
        await pm.prepareRemainingSettlements(f.rpc, {
          market: f.market,
          payer,
          winnerFirst: false,
        })
      ).map((p) => p.baseMint),
    ).toEqual([mints[1], mints[2]]);
  });
  it('returns no settlement transactions after every entry is confirmed', async () => {
    const f = await fixture({ migrated: [0, 1, 2] });
    expect(
      await pm.prepareRemainingSettlements(f.rpc, { market: f.market, payer }),
    ).toEqual([]);
  });
  it('rejects settlement before finalization or with missing outcomes', async () => {
    for (const options of [{ finalized: false }, { bitmap: 1 }]) {
      const f = await fixture(options);
      await expect(
        pm.prepareRemainingSettlements(f.rpc, { market: f.market, payer }),
      ).rejects.toThrow('Settlement requires');
    }
  });
  it('fails discovery on missing, ambiguous and noncanonical launch bindings', async () => {
    const missing = await fixture();
    missing.launches.pop();
    await expect(
      pm.fetchPredictionMarketWithLaunches(missing.rpc, missing.market),
    ).rejects.toThrow('found 0');
    const ambiguous = await fixture();
    ambiguous.launches.push(ambiguous.launches[0]);
    await expect(
      pm.fetchPredictionMarketWithLaunches(ambiguous.rpc, ambiguous.market),
    ).rejects.toThrow('found 2');
    const wrong = await fixture();
    wrong.launches[0] = { ...wrong.launches[0], pubkey: ZERO };
    await expect(
      pm.fetchPredictionMarketWithLaunches(wrong.rpc, wrong.market),
    ).rejects.toThrow('Invalid launch PDA');
  });
  it('ignores same-mint launches with the wrong hook or migrator', async () => {
    const f = await fixture();
    const original = f.launches[0];
    const data = generated
      .getLaunchDecoder()
      .decode(Buffer.from(original.account.data[0], 'base64'));
    for (const change of [{ hookProgram: ZERO }, { migratorProgram: ZERO }]) {
      f.launches.unshift({
        pubkey: ZERO,
        account: encoded(
          generated.getLaunchEncoder().encode({ ...data, ...change }),
          initializer.INITIALIZER_PROGRAM_ID,
        ),
      });
    }
    const view = await pm.fetchPredictionMarketWithLaunches(f.rpc, f.market);
    expect(view.outcomes[0].launch.address).toBe(original.pubkey);
  });
  it('resumes only unregistered outcomes without duplicating a confirmed registration', async () => {
    const f = await fixture({ bitmap: 1, finalized: false, migrated: [] });
    const plans = await pm.prepareMissingOutcomeLaunches(f.rpc, {
      market: f.market,
      outcomes: f.inputs,
    });
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.entry)).toEqual(
      await Promise.all(
        mints
          .slice(1)
          .map(
            async (mint) =>
              (await prediction.getPredictionEntryAddress(f.market, mint))[0],
          ),
      ),
    );
    expect(
      await pm.prepareMissingOutcomeLaunches(f.rpc, {
        market: f.market,
        outcomes: [f.inputs[0]],
      }),
    ).toEqual([]);
  });
  it('rejects wrong creator, quote and oracle even on an already registered outcome', async () => {
    const f = await fixture({ bitmap: 1, finalized: false, migrated: [] });
    const valid = f.inputs[0];
    for (const invalid of [
      { ...valid, creator: payer },
      { ...valid, oracle: ZERO },
      {
        ...valid,
        launch: {
          ...valid.launch,
          launchAccounts: { ...valid.launch.launchAccounts, quoteMint: ZERO },
        },
      },
    ]) {
      await expect(
        pm.prepareMissingOutcomeLaunches(f.rpc, {
          market: f.market,
          outcomes: [invalid],
        }),
      ).rejects.toThrow('does not belong');
    }
  });
  it('rejects unknown and repeated outcome IDs before returning registration plans', async () => {
    const f = await fixture({ bitmap: 1, finalized: false, migrated: [] });
    await expect(
      pm.prepareMissingOutcomeLaunches(f.rpc, {
        market: f.market,
        outcomes: [
          { ...f.inputs[1], outcomeId: pm.outcomeIdFromLabel('UNKNOWN') },
        ],
      }),
    ).rejects.toThrow('Unknown or duplicate');
    await expect(
      pm.prepareMissingOutcomeLaunches(f.rpc, {
        market: f.market,
        outcomes: [f.inputs[0], f.inputs[0]],
      }),
    ).rejects.toThrow('Unknown or duplicate');
    await expect(
      pm.prepareMissingOutcomeLaunches(f.rpc, {
        market: f.market,
        outcomes: [f.inputs[1], f.inputs[1]],
      }),
    ).rejects.toThrow('Unknown or duplicate');
  });
  it('rejects registration resume after oracle finalization', async () => {
    const f = await fixture({ bitmap: 1 });
    await expect(
      pm.prepareMissingOutcomeLaunches(f.rpc, {
        market: f.market,
        outcomes: f.inputs,
      }),
    ).rejects.toThrow('after oracle finalization');
  });
});
