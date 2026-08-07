import { describe, expect, it } from 'vitest';
import { getAddress, type Address, type TransactionReceipt } from 'viem';
import {
  AirlockCreateReceiptError,
  parseAirlockCreateReceipt,
  verifyPreparedCreateReceipt,
  type AirlockCreateReceiptErrorCode,
} from '../../../../src/evm/utils/airlockCreateReceipt';
import type { PreparedMulticurveCreate } from '../../../../src/evm/types';
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

function createLog(options: {
  emitter?: Address;
  token?: Address;
  numeraire?: Address;
  initializer?: Address;
  poolOrHook?: Address;
  logIndex?: number;
} = {}) {
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
  logs = [createLog()],
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
        tokenAddress:
          prepared.prediction.tokenAddress.toLowerCase() as Address,
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
