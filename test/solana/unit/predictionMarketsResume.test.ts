import { describe, expect, it } from 'vitest';
import {
  address,
  createNoopSigner,
  type Address,
  type Rpc,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  getMintEncoder,
  getMintDecoder,
  getMintSize,
  getTokenEncoder,
  getTokenDecoder,
  getTokenSize,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import * as pm from '@/solana/predictionMarkets/index.js';
import * as prediction from '@/solana/migrators/predictionMigrator/index.js';
import * as oracleClient from '@/solana/trustedOracle/index.js';
import * as initializer from '@/solana/initializer/index.js';
import * as generated from '@/solana/generated/initializer/index.js';
import { bytesToBase64 } from '@/solana/core/accounts.js';

const ZERO = address('11111111111111111111111111111111');
const QUOTE = address('So11111111111111111111111111111111111111112');
const mints = [
  address('SysvarC1ock11111111111111111111111111111111'),
  address('SysvarS1otHashes111111111111111111111111111'),
  address('ComputeBudget111111111111111111111111111111'),
];
const creator = createNoopSigner(mints[0]);
const payer = createNoopSigner(mints[1]);
const ids = ['YES', 'NO', 'OTHER'].map(pm.outcomeIdFromLabel);
type RpcValue = {
  data: [string, 'base64'];
  owner: Address;
  executable: boolean;
  lamports: bigint;
  rentEpoch: bigint;
  space: bigint;
};
function encoded(bytes: ReadonlyUint8Array, owner: Address): RpcValue {
  return {
    data: [bytesToBase64(bytes), 'base64'],
    owner,
    executable: false,
    lamports: 1n,
    rentEpoch: 0n,
    space: BigInt(bytes.length),
  };
}

// Serialize real generated account layouts and serve them through the RPC boundary.
// No lifecycle functions or instruction builders are mocked.
async function fixture({
  bitmap = 7,
  finalized = true,
  migrated = [0],
}: { bitmap?: number; finalized?: boolean; migrated?: number[] } = {}) {
  const [oracle, oracleBump] = await oracleClient.getOracleStateAddress(
    creator.address,
    73n,
  );
  const [market, bump] = await prediction.getPredictionMarketAddress(
    oracle,
    QUOTE,
    creator.address,
  );
  const [potVault] = await prediction.getPredictionPotVaultAddress(market);
  const [, marketAuthorityBump] =
    await prediction.getPredictionMarketAuthorityAddress(market);
  const accounts = new Map<Address, RpcValue>();
  accounts.set(
    oracle,
    encoded(
      oracleClient
        .getOracleStateEncoder()
        .encode({
          oracleAuthority: creator.address,
          nonce: 73n,
          bump: oracleBump,
          outcomeCount: 3,
          outcomeIds: [
            ...ids,
            ...Array.from({ length: 5 }, () => new Uint8Array(32)),
          ],
          isFinalized: finalized,
          winningOutcomeId: finalized ? ids[2] : new Uint8Array(32),
        }),
      oracleClient.TRUSTED_ORACLE_PROGRAM_ADDRESS,
    ),
  );
  accounts.set(
    market,
    encoded(
      prediction
        .getMarketEncoder()
        .encode({
          oracle,
          quoteMint: QUOTE,
          creator: creator.address,
          potVault,
          bump,
          marketAuthorityBump,
          outcomeCount: 3,
          registeredBitmap: bitmap,
          outcomeMints: [
            ...mints.map((mint, i) => (bitmap & (1 << i) ? mint : ZERO)),
            ...Array(5).fill(ZERO),
          ],
          isResolved: false,
          isVoid: false,
          winningOutcomeId: new Uint8Array(32),
          winnerMint: ZERO,
          totalPot: 0n,
          totalClaimed: 0n,
          claimableSupply: 0n,
        }),
      prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
    ),
  );
  const launches: Array<{ pubkey: Address; account: RpcValue }> = [];
  for (let i = 0; i < 3; i++) {
    if (!(bitmap & (1 << i))) continue;
    const [entry, entryBump] = await prediction.getPredictionEntryAddress(
      market,
      mints[i],
    );
    accounts.set(
      entry,
      encoded(
        prediction
          .getEntryEncoder()
          .encode({
            market,
            baseMint: mints[i],
            bump: entryBump,
            isMigrated: migrated.includes(i),
            contribution: 0n,
            refundSupply: 0n,
            refundedQuote: 0n,
          }),
        prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
      ),
    );
    const [launch, launchBump] = await initializer.getLaunchAddress(
      oracle,
      ids[i],
    );
    const [, launchAuthorityBump] =
      await initializer.getLaunchAuthorityAddress(launch);
    const empty = generated
      .getLaunchDecoder()
      .decode(new Uint8Array(generated.getLaunchSize()));
    const data = generated
      .getLaunchEncoder()
      .encode({
        ...empty,
        authority: creator.address,
        namespace: oracle,
        launchId: ids[i],
        bump: launchBump,
        launchAuthorityBump,
        baseMint: mints[i],
        quoteMint: QUOTE,
        baseVault: mints[i],
        quoteVault: QUOTE,
        phase: migrated.includes(i)
          ? initializer.PHASE_MIGRATED
          : initializer.PHASE_TRADING,
        allowBuy: 1,
        allowSell: 0,
        hookProgram: initializer.PREDICTION_HOOK_PROGRAM_ID,
        hookFlags: 130,
        migratorProgram: prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
      });
    launches.push({
      pubkey: launch,
      account: encoded(data, initializer.INITIALIZER_PROGRAM_ID),
    });
  }
  const rpc = {
    getAccountInfo: (key: Address) => ({
      send: async () => ({
        context: { slot: 1n },
        value: accounts.get(key) ?? null,
      }),
    }),
    getMultipleAccounts: (keys: Address[]) => ({
      send: async () => ({
        context: { slot: 1n },
        value: keys.map((key) => accounts.get(key) ?? null),
      }),
    }),
    getProgramAccounts: () => ({ send: async () => launches }),
  } as unknown as Rpc<
    GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi
  >;
  const inputs: pm.PrepareOutcomeLaunchInput[] = ids.map((outcomeId, i) => ({
    oracle,
    creator,
    outcomeId,
    launch: {
      config: ZERO,
      launchId: outcomeId,
      launchAccounts: {
        baseMint: createNoopSigner(mints[i]),
        quoteMint: QUOTE,
        baseVault: payer,
        quoteVault: payer,
      },
      payer,
      supply: {
        baseDecimals: 6,
        baseTotalSupply: 1000000n,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: 1000000n,
        curveVirtualQuote: 1000000n,
        swapFeeBps: 100,
      },
    },
  }));
  return { rpc, market, oracle, accounts, launches, inputs };
}

async function buyFixture(migrated: number[] = []) {
  const f = await fixture({ finalized: false, migrated });
  const launch = f.launches[0].pubkey;
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
  const [feeAddress] = await initializer.getLaunchFeeStateAddress(launch);
  const [baseVault] = await prediction.getPredictionPotVaultAddress(f.market);
  const [quoteVault] = await prediction.getPredictionMarketAuthorityAddress(
    f.market,
  );
  const launchData = {
    ...generated
      .getLaunchDecoder()
      .decode(Buffer.from(f.launches[0].account.data[0], 'base64')),
    baseVault,
    quoteVault,
    baseForDistribution: 200n,
    baseForLiquidity: 100n,
    curveVirtualBase: 1000n,
    curveVirtualQuote: 1000n,
    swapFeeBps: 100,
  };
  const feeData = {
    ...generated
      .getLaunchFeeStateDecoder()
      .decode(new Uint8Array(generated.getLaunchFeeStateSize())),
    launch,
    beneficiaryLen: 1,
    swapFeeBps: 100,
    cumulatedBaseFees: 100n,
    cumulatedQuoteFees: 50n,
    distributedProtocolBaseFees: 20n,
    distributedProtocolQuoteFees: 10n,
    distributedBaseByBeneficiary: [30n, ...Array(7).fill(0n)],
    distributedQuoteByBeneficiary: [15n, ...Array(7).fill(0n)],
  };
  function update() {
    f.launches[0].account = encoded(
      generated.getLaunchEncoder().encode(launchData),
      initializer.INITIALIZER_PROGRAM_ID,
    );
    f.accounts.set(
      feeAddress,
      encoded(
        generated.getLaunchFeeStateEncoder().encode(feeData),
        initializer.INITIALIZER_PROGRAM_ID,
      ),
    );
  }
  update();
  for (const mint of [mints[0], QUOTE]) {
    f.accounts.set(
      mint,
      encoded(
        getMintEncoder().encode({
          ...getMintDecoder().decode(new Uint8Array(getMintSize())),
          isInitialized: true,
          decimals: 6,
          supply: 10000n,
        }),
        TOKEN_PROGRAM_ADDRESS,
      ),
    );
  }
  for (const [vault, mint, amount] of [
    [baseVault, mints[0], 1000n],
    [quoteVault, QUOTE, 525n],
  ] as const) {
    f.accounts.set(
      vault,
      encoded(
        getTokenEncoder().encode({
          ...getTokenDecoder().decode(new Uint8Array(getTokenSize())),
          mint,
          owner: launchAuthority,
          amount,
          state: 1,
        }),
        TOKEN_PROGRAM_ADDRESS,
      ),
    );
  }
  const input = { market: f.market, baseMint: mints[0], amountIn: 100n };
  return { ...f, input, launchData, feeData, update };
}

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
