import { fixtureAddress } from '../fixtures/prediction.js';
import { describe, expect, it, vi } from 'vitest';
import {
  address,
  createNoopSigner,
  AccountRole,
  type Address,
  type Rpc,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
  type ReadonlyUint8Array,
} from '@solana/kit';
import * as pm from '@/solana/predictionMarkets/index.js';
import * as prediction from '@/solana/migrators/predictionMigrator/index.js';
import * as oracleClient from '@/solana/trustedOracle/index.js';
import {
  computeRemainingAccountsHash,
  INITIALIZER_PROGRAM_ID,
  PREDICTION_HOOK_PROGRAM_ID,
} from '@/solana/initializer/index.js';
import { getInitializeLaunchInstructionDataDecoder } from '@/solana/generated/initializer/index.js';
import { bytesToBase64 } from '@/solana/core/accounts.js';

const ZERO = address('11111111111111111111111111111111');
const QUOTE = address('So11111111111111111111111111111111111111112');
const BASE = address('SysvarC1ock11111111111111111111111111111111');
const OTHER = address('SysvarS1otHashes111111111111111111111111111');
const creator = createNoopSigner(fixtureAddress(71));
const payer = createNoopSigner(fixtureAddress(72));
const ids = [pm.outcomeIdFromLabel('YES'), pm.outcomeIdFromLabel('NO')];

async function fixture() {
  const [oracle, oracleBump] = await oracleClient.getOracleStateAddress(
    creator.address,
    17n,
  );
  const [market, bump] = await prediction.getPredictionMarketAddress(
    oracle,
    QUOTE,
    creator.address,
  );
  const [potVault] = await prediction.getPredictionPotVaultAddress(market);
  const [, marketAuthorityBump] =
    await prediction.getPredictionMarketAuthorityAddress(market);
  const oracleData: oracleClient.OracleState = {
    discriminator: oracleClient.ORACLE_STATE_DISCRIMINATOR,
    oracleAuthority: creator.address,
    isFinalized: false,
    winningOutcomeId: new Uint8Array(32),
    nonce: 17n,
    bump: oracleBump,
    outcomeCount: 2,
    outcomeIds: [
      ...ids,
      ...Array.from({ length: 6 }, () => new Uint8Array(32)),
    ],
  };
  const marketData: prediction.Market = {
    discriminator: prediction.MARKET_DISCRIMINATOR,
    oracle,
    quoteMint: QUOTE,
    potVault,
    totalPot: 0n,
    totalClaimed: 0n,
    winningOutcomeId: new Uint8Array(32),
    winnerMint: ZERO,
    claimableSupply: 0n,
    isResolved: false,
    bump,
    marketAuthorityBump,
    creator: creator.address,
    outcomeCount: 2,
    registeredBitmap: 0,
    isVoid: false,
    outcomeMints: Array(8).fill(ZERO),
  };
  return { oracle, market, oracleData, marketData };
}
function rpcAccount(bytes: ReadonlyUint8Array, owner: Address) {
  return {
    data: [bytesToBase64(bytes), 'base64'],
    owner,
    executable: false,
    lamports: 1n,
    rentEpoch: 0n,
    space: BigInt(bytes.length),
  };
}
async function readFixture(
  options: {
    owner?: Address;
    corruptDiscriminator?: boolean;
    truncate?: boolean;
    trailing?: boolean;
  } = {},
) {
  const f = await fixture();
  let bytes = Uint8Array.from(
    prediction.getMarketEncoder().encode(f.marketData),
  );
  if (options.corruptDiscriminator) bytes[0] ^= 255;
  if (options.truncate) bytes = bytes.slice(0, -1);
  if (options.trailing) bytes = Uint8Array.from([...bytes, 0, 0]);
  const accounts = new Map([
    [
      f.market,
      rpcAccount(
        bytes,
        options.owner ?? prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
      ),
    ],
    [
      f.oracle,
      rpcAccount(
        oracleClient.getOracleStateEncoder().encode(f.oracleData),
        oracleClient.TRUSTED_ORACLE_PROGRAM_ADDRESS,
      ),
    ],
  ]);
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
  } as unknown as Rpc<GetAccountInfoApi & GetMultipleAccountsApi>;
  return { ...f, rpc };
}

describe('prediction market independent regression review', () => {
  it('settles through Initializer with a writable burn mint and the exact module suffix', async () => {
    const f = await fixture();
    const input = {
      oracle: f.oracle,
      market: f.market,
      config: fixtureAddress(61),
      launch: fixtureAddress(62),
      launchAuthority: fixtureAddress(63),
      baseMint: BASE,
      quoteMint: QUOTE,
      baseVault: fixtureAddress(64),
      quoteVault: fixtureAddress(65),
      launchFeeState: fixtureAddress(66),
      payer,
    };
    const result = await pm.prepareSettlement(input);
    const ix = result.instructions[0];
    expect(ix.programAddress).toBe(INITIALIZER_PROGRAM_ID);
    expect(ix.accounts?.slice(0, 10).map((a) => a.address)).toEqual([
      input.config,
      input.launch,
      input.launchAuthority,
      input.baseMint,
      input.quoteMint,
      input.baseVault,
      input.quoteVault,
      input.launchFeeState,
      prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
      payer.address,
    ]);
    expect(ix.accounts?.[3].role).toBe(AccountRole.WRITABLE);
    const [potVault] = await prediction.getPredictionPotVaultAddress(f.market);
    const [marketAuthority] =
      await prediction.getPredictionMarketAuthorityAddress(f.market);
    const [entry] = await prediction.getPredictionEntryAddress(
      f.market,
      input.baseMint,
    );
    // Protocol CPI order, independently specified rather than copied from the builder.
    expect(ix.accounts?.slice(14)).toEqual([
      { address: f.oracle, role: AccountRole.READONLY },
      { address: f.market, role: AccountRole.WRITABLE },
      { address: potVault, role: AccountRole.WRITABLE },
      { address: marketAuthority, role: AccountRole.READONLY },
      { address: entry, role: AccountRole.WRITABLE },
    ]);
    expect(ix.accounts?.[7].role).toBe(AccountRole.WRITABLE);
    expect(ix.accounts?.[9]).toMatchObject({
      role: AccountRole.WRITABLE_SIGNER,
      signer: payer,
    });
  });

  it('commits the actual account addresses for each distinct CPI path', async () => {
    const f = await fixture();
    const result = await pm.prepareOutcomeLaunch({
      oracle: f.oracle,
      creator,
      outcomeId: ids[0],
      launch: {
        config: ZERO,
        launchId: ids[1],
        launchAccounts: {
          baseMint: createNoopSigner(BASE),
          quoteMint: QUOTE,
          baseVault: createNoopSigner(fixtureAddress(67)),
          quoteVault: createNoopSigner(fixtureAddress(68)),
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
    });
    const data = getInitializeLaunchInstructionDataDecoder().decode(
      result.instruction.data!,
    );
    const [entry] = await prediction.getPredictionEntryAddress(
      result.market,
      BASE,
    );
    const [potVault] = await prediction.getPredictionPotVaultAddress(
      result.market,
    );
    const [marketAuthority] =
      await prediction.getPredictionMarketAuthorityAddress(result.market);
    expect(data.hookRemainingAccountsHash).toEqual(
      computeRemainingAccountsHash([f.oracle, result.market]),
    );
    expect(data.migratorInitRemainingAccountsHash).toEqual(
      computeRemainingAccountsHash([f.oracle, result.market, entry]),
    );
    expect(data.migratorRemainingAccountsHash).toEqual(
      computeRemainingAccountsHash([
        f.oracle,
        result.market,
        potVault,
        marketAuthority,
        entry,
      ]),
    );
    expect(result.instruction.accounts?.slice(-3)).toEqual([
      { address: f.oracle, role: AccountRole.READONLY },
      { address: result.market, role: AccountRole.WRITABLE },
      { address: entry, role: AccountRole.WRITABLE },
    ]);
  });

  it('keeps a sponsored WSOL buyer as token authority while payer funds the wrapped input', async () => {
    const f = await fixture();
    const plan = await pm.prepareBuy({
      oracle: f.oracle,
      market: f.market,
      launch: BASE,
      launchAuthority: OTHER,
      baseMint: BASE,
      quoteMint: QUOTE,
      baseVault: BASE,
      quoteVault: OTHER,
      launchFeeState: ZERO,
      payer,
      user: creator,
      amountIn: 100n,
      minAmountOut: 1n,
    });
    expect(plan.setupInstructions).toHaveLength(4);
    expect(plan.setupInstructions[2].accounts?.[0]).toMatchObject({
      address: payer.address,
      signer: payer,
    });
    expect(plan.setupInstructions[2].accounts?.[1].address).toBe(
      plan.userQuoteAccount,
    );
    expect(
      plan.swapInstruction.accounts?.find(
        (a) => a.address === creator.address && 'signer' in a,
      ),
    ).toMatchObject({ signer: creator });
    expect(
      plan.swapInstruction.accounts?.slice(-2).map((a) => a.address),
    ).toEqual([f.oracle, f.market]);
    expect(
      plan.swapInstruction.accounts?.some(
        (a) => a.address === PREDICTION_HOOK_PROGRAM_ID,
      ),
    ).toBe(true);
  });

  it('does not wrap or debit payer when the buyer uses an existing quote balance', async () => {
    const f = await fixture();
    const plan = await pm.prepareBuy({
      oracle: f.oracle,
      market: f.market,
      launch: BASE,
      launchAuthority: OTHER,
      baseMint: BASE,
      quoteMint: QUOTE,
      baseVault: BASE,
      quoteVault: OTHER,
      launchFeeState: ZERO,
      payer,
      user: creator,
      amountIn: 100n,
      minAmountOut: 1n,
      wrapSol: false,
    });
    expect(plan.setupInstructions).toHaveLength(2);
  });

  it('does not wrap SOL for a classic SPL quote mint', async () => {
    const f = await fixture();
    const plan = await pm.prepareBuy({
      oracle: f.oracle,
      market: f.market,
      launch: BASE,
      launchAuthority: OTHER,
      baseMint: BASE,
      quoteMint: OTHER,
      baseVault: BASE,
      quoteVault: OTHER,
      launchFeeState: ZERO,
      payer,
      amountIn: 100n,
      minAmountOut: 1n,
    });
    expect(plan.setupInstructions).toHaveLength(2);
    expect(
      plan.setupInstructions.every((ix) => ix.programAddress !== ZERO),
    ).toBe(true);
  });

  it('distinguishes registration, unbounded trading, pending settlement, claims and voids', async () => {
    const { marketData: m, oracleData: o } = await fixture();
    expect(pm.getPredictionMarketStatus(m, o).missingOutcomeIndexes).toEqual([
      0, 1,
    ]);
    const complete = {
      ...m,
      registeredBitmap: 3,
      outcomeMints: [BASE, OTHER, ...Array(6).fill(ZERO)],
    };
    expect(pm.getPredictionMarketStatus(complete, o)).toMatchObject({
      phase: 'trading',
      canBuy: true,
      canSettle: false,
    });
    const finalized = { ...o, isFinalized: true, winningOutcomeId: ids[0] };
    expect(pm.getPredictionMarketStatus(complete, finalized)).toMatchObject({
      phase: 'settling',
      canBuy: false,
      canSettle: true,
      canClaim: false,
    });
    expect(
      pm.getPredictionMarketStatus(
        { ...complete, isResolved: true, claimableSupply: 10n },
        finalized,
      ),
    ).toMatchObject({ phase: 'claimable', canClaim: true });
    expect(
      pm.getPredictionMarketStatus(
        { ...complete, isResolved: true, isVoid: true },
        finalized,
      ),
    ).toMatchObject({ phase: 'void', canClaim: false, canRefund: true });
  });

  it('reads a canonical empty market and rejects wrong owner, discriminator and truncation', async () => {
    const valid = await readFixture();
    expect(
      (await pm.fetchPredictionMarket(valid.rpc, valid.market)).entries,
    ).toEqual([]);
    for (const options of [
      { owner: ZERO },
      { corruptDiscriminator: true },
      { truncate: true },
      { corruptDiscriminator: true, trailing: true },
    ]) {
      const bad = await readFixture(options);
      await expect(
        pm.fetchPredictionMarket(bad.rpc, bad.market),
      ).rejects.toThrow();
    }
  });

  it('discovers using exact Rust layout offsets and drops wrong discriminators', async () => {
    const f = await fixture();
    const valid = prediction.getMarketEncoder().encode(f.marketData);
    const invalid = Uint8Array.from(valid);
    invalid[0] ^= 255;
    const getProgramAccounts = vi.fn(() => ({
      send: async () => [
        {
          pubkey: f.market,
          account: rpcAccount(
            valid,
            prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
          ),
        },
        {
          pubkey: BASE,
          account: rpcAccount(
            invalid,
            prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
          ),
        },
      ],
    }));
    const rpc = { getProgramAccounts } as unknown as Rpc<GetProgramAccountsApi>;
    const markets = await pm.listPredictionMarkets(rpc, {
      creator: creator.address,
      oracle: f.oracle,
    });
    expect(markets.map((m) => m.address)).toEqual([f.market]);
    const [, config] = getProgramAccounts.mock.calls[0] as unknown as [
      Address,
      { filters: Array<{ dataSize?: bigint; memcmp?: { offset: bigint } }> },
    ];
    expect(config.filters[0]).toEqual({ dataSize: 486n });
    expect(config.filters.slice(1).map((v) => v.memcmp?.offset)).toEqual([
      8n,
      195n,
    ]);
  });
});
