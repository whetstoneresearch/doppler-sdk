import {
  address,
  createNoopSigner,
  getAddressDecoder,
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

export const ZERO = address('11111111111111111111111111111111');
export const QUOTE = address('So11111111111111111111111111111111111111112');
// Distinct deterministic addresses; no mint/vault/signer aliasing.
export const fixtureAddress = (n: number) =>
  getAddressDecoder().decode(new Uint8Array(32).fill(n));
export const TOKEN_QUOTE = fixtureAddress(51);
export const mints = [
  fixtureAddress(11),
  fixtureAddress(12),
  fixtureAddress(13),
];
export const baseVaults = [
  fixtureAddress(21),
  fixtureAddress(22),
  fixtureAddress(23),
];
export const quoteVaults = [
  fixtureAddress(31),
  fixtureAddress(32),
  fixtureAddress(33),
];
export const creator = createNoopSigner(fixtureAddress(41));
export const payer = createNoopSigner(fixtureAddress(42));
export const ids = ['YES', 'NO', 'OTHER'].map(pm.outcomeIdFromLabel);
export type RpcValue = {
  data: [string, 'base64'];
  owner: Address;
  executable: boolean;
  lamports: bigint;
  rentEpoch: bigint;
  space: bigint;
};
export function encoded(bytes: ReadonlyUint8Array, owner: Address): RpcValue {
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
export async function fixture({
  bitmap = 7,
  finalized = true,
  migrated = [0],
  quoteMint = QUOTE,
  winnerIndex = 2,
}: {
  bitmap?: number;
  finalized?: boolean;
  migrated?: number[];
  quoteMint?: Address;
  winnerIndex?: number;
} = {}) {
  const [oracle, oracleBump] = await oracleClient.getOracleStateAddress(
    creator.address,
    73n,
  );
  const [market, bump] = await prediction.getPredictionMarketAddress(
    oracle,
    quoteMint,
    creator.address,
  );
  const [potVault] = await prediction.getPredictionPotVaultAddress(market);
  const [, marketAuthorityBump] =
    await prediction.getPredictionMarketAuthorityAddress(market);
  const accounts = new Map<Address, RpcValue>();
  accounts.set(
    oracle,
    encoded(
      oracleClient.getOracleStateEncoder().encode({
        oracleAuthority: creator.address,
        nonce: 73n,
        bump: oracleBump,
        outcomeCount: 3,
        outcomeIds: [
          ...ids,
          ...Array.from({ length: 5 }, () => new Uint8Array(32)),
        ],
        isFinalized: finalized,
        winningOutcomeId: finalized ? ids[winnerIndex] : new Uint8Array(32),
      }),
      oracleClient.TRUSTED_ORACLE_PROGRAM_ADDRESS,
    ),
  );
  accounts.set(
    market,
    encoded(
      prediction.getMarketEncoder().encode({
        oracle,
        quoteMint,
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
        prediction.getEntryEncoder().encode({
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
    const [launchAuthority, launchAuthorityBump] =
      await initializer.getLaunchAuthorityAddress(launch);
    const empty = generated
      .getLaunchDecoder()
      .decode(new Uint8Array(generated.getLaunchSize()));
    const data = generated.getLaunchEncoder().encode({
      ...empty,
      authority: creator.address,
      namespace: oracle,
      launchId: ids[i],
      bump: launchBump,
      launchAuthorityBump,
      baseMint: mints[i],
      quoteMint,
      baseVault: baseVaults[i],
      quoteVault: quoteVaults[i],
      phase: migrated.includes(i)
        ? initializer.PHASE_MIGRATED
        : initializer.PHASE_TRADING,
      curveVirtualBase: 1000000n,
      curveVirtualQuote: 1000000n,
      swapFeeBps: 100,
      allowBuy: 1,
      allowSell: 0,
      hookProgram: initializer.PREDICTION_HOOK_PROGRAM_ID,
      hookFlags: initializer.HF_BEFORE_SWAP | initializer.HF_LAUNCH_CONTEXT_V2,
      migratorProgram: prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
    });
    // Populate actual mint, vault and fee-state account layouts for every outcome.
    const [feeAddress] = await initializer.getLaunchFeeStateAddress(launch);
    const emptyFee = generated
      .getLaunchFeeStateDecoder()
      .decode(new Uint8Array(generated.getLaunchFeeStateSize()));
    accounts.set(
      feeAddress,
      encoded(
        generated.getLaunchFeeStateEncoder().encode({
          ...emptyFee,
          launch,
          beneficiaryLen: 1,
          swapFeeBps: 100,
          beneficiaries: [
            {
              wallet: creator.address,
              shareBps: 10000,
              pad: new Uint8Array(6),
            },
            ...emptyFee.beneficiaries.slice(1),
          ],
        }),
        initializer.INITIALIZER_PROGRAM_ID,
      ),
    );
    accounts.set(
      mints[i],
      encoded(
        getMintEncoder().encode({
          ...getMintDecoder().decode(new Uint8Array(getMintSize())),
          isInitialized: true,
          decimals: 6,
          supply: migrated.includes(i) ? 0n : 1000000n,
        }),
        TOKEN_PROGRAM_ADDRESS,
      ),
    );
    for (const [vault, mint, amount] of [
      [baseVaults[i], mints[i], migrated.includes(i) ? 0n : 1000000n],
      [quoteVaults[i], quoteMint, 0n],
    ] as const) {
      accounts.set(
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
    launches.push({
      pubkey: launch,
      account: encoded(data, initializer.INITIALIZER_PROGRAM_ID),
    });
  }
  const readCounts = new Map<Address, number>();
  const readHook: { current?: (key: Address, count: number) => void } = {};
  const rpc = {
    getAccountInfo: (key: Address) => ({
      send: async () => {
        const count = (readCounts.get(key) ?? 0) + 1;
        readCounts.set(key, count);
        readHook.current?.(key, count);
        return {
          context: { slot: BigInt(count) },
          value: accounts.get(key) ?? null,
        };
      },
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
        quoteMint,
        baseVault: createNoopSigner(baseVaults[i]),
        quoteVault: createNoopSigner(quoteVaults[i]),
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
  return { rpc, market, oracle, accounts, launches, inputs, readHook };
}

export async function buyFixture(
  migrated: number[] = [],
  quoteMint: Address = QUOTE,
) {
  const f = await fixture({
    finalized: migrated.length > 0,
    migrated,
    quoteMint,
    winnerIndex: 0,
  });
  const launch = f.launches[0].pubkey;
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
  const [feeAddress] = await initializer.getLaunchFeeStateAddress(launch);
  const baseVault = baseVaults[0];
  const quoteVault = quoteVaults[0];
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
    beneficiaries: [
      { wallet: creator.address, shareBps: 10000, pad: new Uint8Array(6) },
      ...Array.from({ length: 7 }, () => ({
        wallet: ZERO,
        shareBps: 0,
        pad: new Uint8Array(6),
      })),
    ],
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
  for (const mint of [mints[0], quoteMint]) {
    f.accounts.set(
      mint,
      encoded(
        getMintEncoder().encode({
          ...getMintDecoder().decode(new Uint8Array(getMintSize())),
          isInitialized: true,
          decimals: mint === QUOTE ? 9 : 6,
          supply: 10000n,
        }),
        TOKEN_PROGRAM_ADDRESS,
      ),
    );
  }
  for (const [vault, mint, amount] of [
    [baseVault, mints[0], 1000n],
    [quoteVault, quoteMint, 525n],
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
