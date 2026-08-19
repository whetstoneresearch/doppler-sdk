import { describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  zeroAddress,
  keccak256,
  type Address,
  type TransactionReceipt,
} from 'viem';
import { bundlerAbi } from '../../../../src/evm/abis';
import {
  AirlockCreateReceiptError,
  parseAirlockCreateReceipt,
  verifyPreparedCreateReceipt,
  verifyPreparedCreateExecution,
  type AirlockCreateReceiptErrorCode,
  type PreparedCreateTransactionClient,
} from '../../../../src/evm/utils/airlockCreateReceipt';
import type {
  PreparedMulticurveCreate,
  V4PoolKey,
} from '../../../../src/evm/types';
import {
  createMockCreateEventLog,
  createMockTransactionReceipt,
} from '../../setup/fixtures/clients';
import {
  mockAddresses,
  mockGovernanceAddress,
  mockPoolAddress,
  mockTimelockAddress,
  mockTokenAddress,
  mockV2PoolAddress,
} from '../../setup/fixtures/addresses';

const account = getAddress('0xa000000000000000000000000000000000000001');
const wrongAddress = getAddress('0xb000000000000000000000000000000000000002');
const poolInitializer = getAddress(
  '0x7100000000000000000000000000000000000007',
);
interface TestEventLog {
  address: Address;
  data: `0x${string}`;
  topics: `0x${string}`[];
  logIndex: number;
}

interface BundledLogOptions {
  emitter?: Address;
  recipient?: Address;
  amountIn?: bigint;
  amountOut?: bigint;
  poolKey?: V4PoolKey;
}

interface VestingCreatedLogOptions {
  emitter?: Address;
  asset?: Address;
  recipient?: Address;
  permissionlessClaim?: boolean;
  totalAmount?: bigint;
  start?: bigint;
  cliffDuration?: bigint;
  vestingDuration?: bigint;
}

function createLog(
  options: {
    emitter?: Address;
    token?: Address;
    numeraire?: Address;
    initializer?: Address;
    poolOrHook?: Address;
    logIndex?: number;
  } = {},
) {
  return {
    ...createMockCreateEventLog(
      options.token ?? mockTokenAddress,
      options.poolOrHook ?? mockPoolAddress,
      options.numeraire ?? mockAddresses.weth,
      options.initializer ?? poolInitializer,
    ),
    address: options.emitter ?? mockAddresses.airlock,
    logIndex: options.logIndex ?? 7,
  };
}

function createReceipt(
  logs: TestEventLog[] = [createLog()],
  overrides: Partial<TransactionReceipt> = {},
): TransactionReceipt {
  const receipt = {
    ...createMockTransactionReceipt(logs),
    from: account,
    to: mockAddresses.airlock,
    ...overrides,
  };
  return receipt;
}

const prepared = {
  chainId: 1,
  account,
  airlock: mockAddresses.airlock,
  createParams: {
    initialSupply: 1_000n,
    numTokensToSell: 400n,
    numeraire: mockAddresses.weth,
    tokenFactory: mockAddresses.tokenFactory,
    tokenFactoryData: '0x',
    governanceFactory: mockAddresses.governanceFactory,
    governanceFactoryData: '0x',
    poolInitializer,
    poolInitializerData: '0x',
    liquidityMigrator: mockAddresses.v2Migrator,
    liquidityMigratorData: '0x',
    integrator: mockAddresses.airlock,
    salt: `0x${'11'.repeat(32)}`,
  },
  prediction: {
    tokenAddress: mockTokenAddress,
    poolOrHookAddress: mockPoolAddress,
    governanceAddress: mockGovernanceAddress,
    timelockAddress: mockTimelockAddress,
    migrationPoolAddress: mockV2PoolAddress,
    poolKey: {
      currency0: mockTokenAddress,
      currency1: mockAddresses.weth,
      fee: 3000,
      tickSpacing: 60,
      hooks: poolInitializer,
    },
    poolId: `0x${'22'.repeat(32)}`,
    tokenIsCurrency0: true,
  },
  transaction: {
    to: mockAddresses.airlock,
    data: '0x1234',
    value: 0n,
  },
  gasEstimate: { status: 'unavailable' },
} satisfies PreparedMulticurveCreate<1>;

function expectReceiptError(
  run: () => unknown,
  code: AirlockCreateReceiptErrorCode,
): void {
  try {
    run();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AirlockCreateReceiptError);
    if (!(error instanceof AirlockCreateReceiptError)) throw error;
    expect(error.code).toBe(code);
  }
}

async function expectAsyncReceiptError(
  run: () => Promise<unknown>,
  code: AirlockCreateReceiptErrorCode,
): Promise<void> {
  try {
    await run();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AirlockCreateReceiptError);
    if (!(error instanceof AirlockCreateReceiptError)) throw error;
    expect(error.code).toBe(code);
  }
}

const devPoolKey: V4PoolKey = {
  currency0: mockTokenAddress,
  currency1: mockAddresses.weth,
  fee: 3000,
  tickSpacing: 60,
  hooks: poolInitializer,
};
function poolIdFor(poolKey: V4PoolKey) {
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' },
          ],
        },
      ],
      [poolKey],
    ),
  );
}

const devPoolId = poolIdFor(devPoolKey);
const nativePoolKey = { ...devPoolKey, currency1: zeroAddress };
const nativePoolId = poolIdFor(nativePoolKey);

function bundledLog(options: BundledLogOptions = {}): TestEventLog {
  return {
    address: options.emitter ?? mockAddresses.bundler!,
    topics: encodeEventTopics({
      abi: bundlerAbi,
      eventName: 'Bundled',
      args: { recipient: options.recipient ?? account },
    }) as `0x${string}`[],
    data: encodeAbiParameters(
      [
        { type: 'uint128' },
        { type: 'uint128' },
        {
          type: 'tuple',
          components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' },
          ],
        },
      ],
      [
        options.amountIn ?? 25n,
        options.amountOut ?? 100n,
        options.poolKey ?? devPoolKey,
      ],
    ),
    logIndex: 8,
  };
}

function vestingCreatedLog(
  options: VestingCreatedLogOptions = {},
): TestEventLog {
  return {
    address: options.emitter ?? mockAddresses.bundler!,
    topics: encodeEventTopics({
      abi: bundlerAbi,
      eventName: 'VestingCreated',
      args: {
        asset: options.asset ?? mockTokenAddress,
        recipient: options.recipient ?? account,
      },
    }) as `0x${string}`[],
    data: encodeAbiParameters(
      [
        { type: 'bool' },
        { type: 'uint128' },
        { type: 'uint64' },
        { type: 'uint64' },
        { type: 'uint64' },
      ],
      [
        options.permissionlessClaim ?? true,
        options.totalAmount ?? 100n,
        options.start ?? 1_000n,
        options.cliffDuration ?? 10n,
        options.vestingDuration ?? 100n,
      ],
    ),
    logIndex: 9,
  };
}

function devPrepared(vestingDuration = 0n): PreparedMulticurveCreate<1> {
  return {
    ...prepared,
    prediction: {
      ...prepared.prediction,
      poolOrHookAddress: poolInitializer,
      migrationPoolAddress: undefined,
      poolKey: devPoolKey,
      poolId: devPoolId,
    },
    transaction: {
      to: mockAddresses.bundler!,
      data: '0x1234',
      value: 0n,
    },
    devBuy: {
      exactAmountIn: 25n,
      recipient: account,
      vesting: {
        permissionlessClaim: vestingDuration !== 0n,
        vestingDuration,
        cliffDuration: vestingDuration === 0n ? 0n : 10n,
      },
      bundler: mockAddresses.bundler!,
      simulatedAmountOut: 90n,
    },
  };
}

describe('parseAirlockCreateReceipt', () => {
  it('ignores a valid same-signature event emitted by another address', () => {
    const result = parseAirlockCreateReceipt({
      receipt: createReceipt([createLog({ emitter: wrongAddress })]),
      expectedAirlock: mockAddresses.airlock,
    });

    expect(result).toBeNull();
  });

  it('returns every emitted Create field and receipt metadata', () => {
    const receipt = createReceipt();
    const result = parseAirlockCreateReceipt({
      receipt,
      expectedAirlock: mockAddresses.airlock,
    });

    expect(result).toEqual({
      airlock: mockAddresses.airlock,
      tokenAddress: mockTokenAddress,
      numeraire: mockAddresses.weth,
      initializer: poolInitializer,
      poolOrHookAddress: mockPoolAddress,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      logIndex: 7,
    });
  });

  it('returns null for no match and rejects multiple expected-Airlock events', () => {
    expect(
      parseAirlockCreateReceipt({
        receipt: createReceipt([]),
        expectedAirlock: mockAddresses.airlock,
      }),
    ).toBeNull();

    expectReceiptError(
      () =>
        parseAirlockCreateReceipt({
          receipt: createReceipt([createLog(), createLog({ logIndex: 8 })]),
          expectedAirlock: mockAddresses.airlock,
        }),
      'MULTIPLE_CREATE_EVENTS',
    );
  });
});

describe('verifyPreparedCreateReceipt', () => {
  it('returns separate receipt-derived and prepared-derived identities', () => {
    const verified = verifyPreparedCreateReceipt({
      prepared,
      receipt: createReceipt(),
    });

    expect(verified.receiptIdentity).toMatchObject({
      airlock: mockAddresses.airlock,
      tokenAddress: mockTokenAddress,
      numeraire: mockAddresses.weth,
      initializer: poolInitializer,
      poolOrHookAddress: mockPoolAddress,
    });
    expect(verified.preparedIdentity).toEqual({
      chainId: 1,
      ...prepared.prediction,
    });
    expect(verified.receiptIdentity).not.toHaveProperty('chainId');
    expect(verified.receiptIdentity).not.toHaveProperty('governanceAddress');
  });

  it('rejects every stable receipt mismatch code', () => {
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt(undefined, { status: 'reverted' }),
        }),
      'RECEIPT_FAILED',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt(undefined, { to: wrongAddress }),
        }),
      'WRONG_TRANSACTION_TARGET',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt(undefined, { from: wrongAddress }),
        }),
      'WRONG_TRANSACTION_SENDER',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({ prepared, receipt: createReceipt([]) }),
      'MISSING_CREATE_EVENT',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt([createLog(), createLog({ logIndex: 8 })]),
        }),
      'MULTIPLE_CREATE_EVENTS',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt([createLog({ token: wrongAddress })]),
        }),
      'TOKEN_MISMATCH',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt([createLog({ numeraire: wrongAddress })]),
        }),
      'NUMERAIRE_MISMATCH',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt([createLog({ initializer: wrongAddress })]),
        }),
      'INITIALIZER_MISMATCH',
    );
    expectReceiptError(
      () =>
        verifyPreparedCreateReceipt({
          prepared,
          receipt: createReceipt([createLog({ poolOrHook: wrongAddress })]),
        }),
      'POOL_OR_HOOK_MISMATCH',
    );
  });

  it('compares emitter and identity addresses case-insensitively', () => {
    const lowercasePrepared = {
      ...prepared,
      account: prepared.account.toLowerCase() as Address,
      airlock: prepared.airlock.toLowerCase() as Address,
      createParams: {
        ...prepared.createParams,
        numeraire: prepared.createParams.numeraire.toLowerCase() as Address,
        poolInitializer:
          prepared.createParams.poolInitializer.toLowerCase() as Address,
      },
      prediction: {
        ...prepared.prediction,
        tokenAddress: prepared.prediction.tokenAddress.toLowerCase() as Address,
        poolOrHookAddress:
          prepared.prediction.poolOrHookAddress.toLowerCase() as Address,
      },
      transaction: {
        ...prepared.transaction,
        to: prepared.transaction.to.toLowerCase() as Address,
      },
    } satisfies PreparedMulticurveCreate<1>;

    expect(
      verifyPreparedCreateReceipt({
        prepared: lowercasePrepared,
        receipt: createReceipt(),
      }).receiptIdentity.tokenAddress,
    ).toBe(mockTokenAddress);
  });
});

it('verifies Bundled output and permits direct delivery without vesting', () => {
  const dev = devPrepared();
  const verified = verifyPreparedCreateReceipt({
    prepared: dev,
    receipt: createReceipt(
      [createLog({ poolOrHook: poolInitializer }), bundledLog()],
      { to: mockAddresses.bundler },
    ),
  });
  expect(verified.devBuy).toEqual({ amountOut: 100n });
  expect(verified.preparedIdentity.migrationPoolAddress).toBeUndefined();
});

it('requires matching vesting creation when custody is enabled', () => {
  const dev = devPrepared(100n);
  const receipt = createReceipt(
    [
      createLog({ poolOrHook: poolInitializer }),
      bundledLog(),
      vestingCreatedLog(),
    ],
    { to: mockAddresses.bundler },
  );
  expect(
    verifyPreparedCreateReceipt({ prepared: dev, receipt }).devBuy,
  ).toEqual({ amountOut: 100n });

  expectReceiptError(
    () =>
      verifyPreparedCreateReceipt({
        prepared: dev,
        receipt: createReceipt(
          [createLog({ poolOrHook: poolInitializer }), bundledLog()],
          { to: mockAddresses.bundler },
        ),
      }),
    'MISSING_VESTING_EVENT',
  );
});

it('rejects invalid Bundled event correlation', () => {
  const direct = devPrepared();
  const baseCreate = createLog({ poolOrHook: poolInitializer });
  const verify = (logs: TestEventLog[]) =>
    verifyPreparedCreateReceipt({
      prepared: direct,
      receipt: createReceipt([baseCreate, ...logs], {
        to: mockAddresses.bundler,
      }),
    });

  expectReceiptError(() => verify([]), 'MISSING_BUNDLED_EVENT');
  expectReceiptError(
    () => verify([bundledLog(), bundledLog()]),
    'MULTIPLE_BUNDLED_EVENTS',
  );
  expectReceiptError(
    () => verify([bundledLog({ emitter: wrongAddress })]),
    'MISSING_BUNDLED_EVENT',
  );
  expectReceiptError(
    () => verify([bundledLog({ recipient: wrongAddress })]),
    'BUNDLED_RECIPIENT_MISMATCH',
  );
  expectReceiptError(
    () => verify([bundledLog({ amountIn: 24n })]),
    'BUNDLED_INPUT_MISMATCH',
  );
  expectReceiptError(
    () => verify([bundledLog({ poolKey: { ...devPoolKey, fee: 500 } })]),
    'BUNDLED_POOL_KEY_MISMATCH',
  );
  expectReceiptError(
    () =>
      verifyPreparedCreateReceipt({
        prepared: direct,
        receipt: createReceipt(
          [baseCreate, bundledLog(), vestingCreatedLog()],
          { to: mockAddresses.bundler },
        ),
      }),
    'UNEXPECTED_VESTING_EVENT',
  );
});

it('rejects duplicate and mismatched VestingCreated events', () => {
  const vested = devPrepared(100n);
  const baseCreate = createLog({ poolOrHook: poolInitializer });
  const verify = (vestingLogs: TestEventLog[]) =>
    verifyPreparedCreateReceipt({
      prepared: vested,
      receipt: createReceipt([baseCreate, bundledLog(), ...vestingLogs], {
        to: mockAddresses.bundler,
      }),
    });

  expectReceiptError(
    () => verify([vestingCreatedLog(), vestingCreatedLog()]),
    'MULTIPLE_VESTING_EVENTS',
  );
  const mismatches: VestingCreatedLogOptions[] = [
    { asset: wrongAddress },
    { recipient: wrongAddress },
    { permissionlessClaim: false },
    { totalAmount: 99n },
    { cliffDuration: 11n },
    { vestingDuration: 101n },
  ];
  for (const mismatch of mismatches) {
    expectReceiptError(
      () => verify([vestingCreatedLog(mismatch)]),
      'VESTING_MISMATCH',
    );
  }
});

describe('verifyPreparedCreateExecution', () => {
  function createClient(
    receipt: TransactionReceipt,
    overrides: Partial<{
      hash: `0x${string}`;
      from: Address;
      to: Address | null;
      input: `0x${string}`;
      value: bigint;
    }> = {},
  ) {
    const getTransaction = vi.fn().mockResolvedValue({
      hash: receipt.transactionHash,
      from: prepared.account,
      to: prepared.transaction.to,
      input: prepared.transaction.data,
      value: prepared.transaction.value,
      ...overrides,
    });
    return {
      getTransaction,
      publicClient: {
        getTransaction,
      } satisfies PreparedCreateTransactionClient,
    };
  }

  it('fetches and verifies the mined transaction after receipt verification', async () => {
    const receipt = createReceipt();
    const { publicClient, getTransaction } = createClient(receipt);

    const verified = await verifyPreparedCreateExecution({
      prepared,
      receipt,
      publicClient,
    });

    expect(getTransaction).toHaveBeenCalledWith({
      hash: receipt.transactionHash,
    });
    expect(verified.receiptIdentity.transactionHash).toBe(
      receipt.transactionHash,
    );
    expect(verified.preparedIdentity).toEqual({
      chainId: 1,
      ...prepared.prediction,
    });
  });

  it('rejects an invalid receipt before retrieving the transaction', async () => {
    const receipt = createReceipt(undefined, { status: 'reverted' });
    const { publicClient, getTransaction } = createClient(receipt);

    await expectAsyncReceiptError(
      () =>
        verifyPreparedCreateExecution({
          prepared,
          receipt,
          publicClient,
        }),
      'RECEIPT_FAILED',
    );
    expect(getTransaction).not.toHaveBeenCalled();
  });

  it('rejects missing native value for a prepared dev buy', async () => {
    const nativePrepared = {
      ...devPrepared(),
      createParams: {
        ...prepared.createParams,
        numeraire: zeroAddress,
      },
      prediction: {
        ...devPrepared().prediction,
        poolKey: nativePoolKey,
        poolId: nativePoolId,
      },
      transaction: {
        ...devPrepared().transaction,
        value: 25n,
      },
    } satisfies PreparedMulticurveCreate<1>;
    const receipt = createReceipt(
      [
        createLog({
          numeraire: zeroAddress,
          poolOrHook: poolInitializer,
        }),
        bundledLog({ poolKey: nativePoolKey }),
      ],
      { to: mockAddresses.bundler },
    );
    const { publicClient } = createClient(receipt, {
      to: nativePrepared.transaction.to,
      input: nativePrepared.transaction.data,
      value: 0n,
    });

    await expectAsyncReceiptError(
      () =>
        verifyPreparedCreateExecution({
          prepared: nativePrepared,
          receipt,
          publicClient,
        }),
      'TRANSACTION_VALUE_MISMATCH',
    );
  });

  it.each([
    [
      'hash',
      { hash: `0x${'33'.repeat(32)}` as const },
      'TRANSACTION_HASH_MISMATCH',
    ],
    ['target', { to: wrongAddress }, 'WRONG_TRANSACTION_TARGET'],
    ['sender', { from: wrongAddress }, 'WRONG_TRANSACTION_SENDER'],
    ['input', { input: '0xabcd' as const }, 'TRANSACTION_INPUT_MISMATCH'],
    ['value', { value: 1n }, 'TRANSACTION_VALUE_MISMATCH'],
  ] as const)(
    'rejects a mismatched transaction %s',
    async (_field, overrides, code) => {
      const receipt = createReceipt();
      const { publicClient } = createClient(receipt, overrides);

      await expectAsyncReceiptError(
        () =>
          verifyPreparedCreateExecution({
            prepared,
            receipt,
            publicClient,
          }),
        code,
      );
    },
  );
});
