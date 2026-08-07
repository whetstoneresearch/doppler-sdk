import {
  decodeEventLog,
  keccak256,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { airlockAbi } from '../abis';
import type {
  PreparedMulticurveCreate,
  SupportedChainId,
  V4PoolKey,
} from '../types';

export interface ParseAirlockCreateReceiptParams {
  receipt: TransactionReceipt;
  expectedAirlock: Address;
}

export interface AirlockCreateResult {
  airlock: Address;
  tokenAddress: Address;
  numeraire: Address;
  initializer: Address;
  poolOrHookAddress: Address;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
}

export type AirlockCreateReceiptErrorCode =
  | 'RECEIPT_FAILED'
  | 'WRONG_TRANSACTION_TARGET'
  | 'WRONG_TRANSACTION_SENDER'
  | 'MISSING_CREATE_EVENT'
  | 'MULTIPLE_CREATE_EVENTS'
  | 'TOKEN_MISMATCH'
  | 'NUMERAIRE_MISMATCH'
  | 'INITIALIZER_MISMATCH'
  | 'POOL_OR_HOOK_MISMATCH'
  | 'TRANSACTION_HASH_MISMATCH'
  | 'TRANSACTION_INPUT_MISMATCH'
  | 'TRANSACTION_VALUE_MISMATCH';

export class AirlockCreateReceiptError extends Error {
  readonly code: AirlockCreateReceiptErrorCode;
  readonly expected?: string | number;
  readonly actual?: string | number | null;

  constructor(
    code: AirlockCreateReceiptErrorCode,
    options: {
      expected?: string | number;
      actual?: string | number | null;
    } = {},
  ) {
    super(`Airlock Create receipt verification failed: ${code}`);
    this.name = 'AirlockCreateReceiptError';
    this.code = code;
    this.expected = options.expected;
    this.actual = options.actual;
  }
}

type DecodedAirlockCreate = {
  airlock: Address;
  tokenAddress: Address;
  numeraire: Address;
  initializer: Address;
  poolOrHookAddress: Address;
  logIndex: number;
};

function addressesEqual(left: Address | null, right: Address): boolean {
  return left?.toLowerCase() === right.toLowerCase();
}

function decodeAirlockCreateLogs(
  receipt: TransactionReceipt,
  expectedAirlock: Address,
): DecodedAirlockCreate[] {
  const matches: DecodedAirlockCreate[] = [];

  for (const log of receipt.logs) {
    if (!addressesEqual(log.address, expectedAirlock)) continue;

    try {
      const decoded = decodeEventLog({
        abi: airlockAbi,
        data: log.data,
        topics: log.topics,
        eventName: 'Create',
      });
      const args = decoded.args as {
        asset: Address;
        numeraire: Address;
        initializer: Address;
        poolOrHook: Address;
      };
      matches.push({
        airlock: log.address,
        tokenAddress: args.asset,
        numeraire: args.numeraire,
        initializer: args.initializer,
        poolOrHookAddress: args.poolOrHook,
        logIndex: log.logIndex,
      });
    } catch {
      // Logs emitted by the expected contract but belonging to other events are
      // intentionally ignored.
    }
  }

  return matches;
}

export function parseAirlockCreateReceipt({
  receipt,
  expectedAirlock,
}: ParseAirlockCreateReceiptParams): AirlockCreateResult | null {
  const matches = decodeAirlockCreateLogs(receipt, expectedAirlock);
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new AirlockCreateReceiptError('MULTIPLE_CREATE_EVENTS', {
      expected: 1,
      actual: matches.length,
    });
  }

  return {
    ...matches[0],
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  };
}

export interface PreparedMulticurveIdentity<
  C extends SupportedChainId = SupportedChainId,
> {
  chainId: C;
  tokenAddress: Address;
  poolOrHookAddress: Address;
  governanceAddress: Address;
  timelockAddress: Address;
  migrationPoolAddress: Address;
  poolKey: V4PoolKey;
  poolId: Hash;
  tokenIsCurrency0: boolean;
}

export interface VerifiedMulticurveCreate<
  C extends SupportedChainId = SupportedChainId,
> {
  receiptIdentity: AirlockCreateResult;
  preparedIdentity: PreparedMulticurveIdentity<C>;
}

export type PreparedCreateTransactionClient = {
  getTransaction(parameters: { hash: Hash }): Promise<{
    hash: Hash;
    from: Address;
    to: Address | null;
    input: Hex;
    value: bigint;
  }>;
};

function assertAddressMatch(
  code: AirlockCreateReceiptErrorCode,
  expected: Address,
  actual: Address | null,
): void {
  if (!addressesEqual(actual, expected)) {
    throw new AirlockCreateReceiptError(code, { expected, actual });
  }
}

/**
 * Verifies only facts available in a mined receipt: success, sender, target,
 * one matching Airlock Create event, and its emitted deployment identity.
 *
 * This synchronous check does not retrieve or verify the transaction input or
 * value. Prepared-only predictions remain separate from receipt-derived facts.
 */
export function verifyPreparedCreateReceipt<C extends SupportedChainId>({
  prepared,
  receipt,
}: {
  prepared: PreparedMulticurveCreate<C>;
  receipt: TransactionReceipt;
}): VerifiedMulticurveCreate<C> {
  if (receipt.status !== 'success') {
    throw new AirlockCreateReceiptError('RECEIPT_FAILED', {
      expected: 'success',
      actual: receipt.status,
    });
  }
  assertAddressMatch(
    'WRONG_TRANSACTION_TARGET',
    prepared.transaction.to,
    receipt.to,
  );
  assertAddressMatch(
    'WRONG_TRANSACTION_SENDER',
    prepared.account,
    receipt.from,
  );

  const receiptIdentity = parseAirlockCreateReceipt({
    receipt,
    expectedAirlock: prepared.airlock,
  });
  if (!receiptIdentity) {
    throw new AirlockCreateReceiptError('MISSING_CREATE_EVENT', {
      expected: prepared.airlock,
      actual: null,
    });
  }

  assertAddressMatch(
    'TOKEN_MISMATCH',
    prepared.prediction.tokenAddress,
    receiptIdentity.tokenAddress,
  );
  assertAddressMatch(
    'NUMERAIRE_MISMATCH',
    prepared.createParams.numeraire,
    receiptIdentity.numeraire,
  );
  assertAddressMatch(
    'INITIALIZER_MISMATCH',
    prepared.createParams.poolInitializer,
    receiptIdentity.initializer,
  );
  assertAddressMatch(
    'POOL_OR_HOOK_MISMATCH',
    prepared.prediction.poolOrHookAddress,
    receiptIdentity.poolOrHookAddress,
  );

  return {
    receiptIdentity,
    preparedIdentity: {
      chainId: prepared.chainId,
      tokenAddress: prepared.prediction.tokenAddress,
      poolOrHookAddress: prepared.prediction.poolOrHookAddress,
      governanceAddress: prepared.prediction.governanceAddress,
      timelockAddress: prepared.prediction.timelockAddress,
      migrationPoolAddress: prepared.prediction.migrationPoolAddress,
      poolKey: prepared.prediction.poolKey,
      poolId: prepared.prediction.poolId,
      tokenIsCurrency0: prepared.prediction.tokenIsCurrency0,
    },
  };
}

/**
 * Performs the receipt checks in {@link verifyPreparedCreateReceipt}, then
 * retrieves the mined transaction. Its hash must match the receipt, while its
 * sender, target, input, and value must match the prepared unsigned transaction.
 *
 * This stronger check requires one additional RPC request. It proves that the
 * prepared protocol call was mined, but does not turn simulation-only
 * predictions into receipt-derived facts.
 */
export async function verifyPreparedCreateExecution<
  C extends SupportedChainId,
>({
  prepared,
  receipt,
  publicClient,
}: {
  prepared: PreparedMulticurveCreate<C>;
  receipt: TransactionReceipt;
  publicClient: PreparedCreateTransactionClient;
}): Promise<VerifiedMulticurveCreate<C>> {
  const verified = verifyPreparedCreateReceipt({ prepared, receipt });
  const transaction = await publicClient.getTransaction({
    hash: receipt.transactionHash,
  });

  if (
    transaction.hash.toLowerCase() !== receipt.transactionHash.toLowerCase()
  ) {
    throw new AirlockCreateReceiptError('TRANSACTION_HASH_MISMATCH', {
      expected: receipt.transactionHash,
      actual: transaction.hash,
    });
  }
  assertAddressMatch(
    'WRONG_TRANSACTION_TARGET',
    prepared.transaction.to,
    transaction.to,
  );
  assertAddressMatch(
    'WRONG_TRANSACTION_SENDER',
    prepared.account,
    transaction.from,
  );
  if (
    transaction.input.toLowerCase() !== prepared.transaction.data.toLowerCase()
  ) {
    throw new AirlockCreateReceiptError('TRANSACTION_INPUT_MISMATCH', {
      expected: keccak256(prepared.transaction.data),
      actual: keccak256(transaction.input),
    });
  }
  if (transaction.value !== prepared.transaction.value) {
    throw new AirlockCreateReceiptError('TRANSACTION_VALUE_MISMATCH', {
      expected: prepared.transaction.value.toString(),
      actual: transaction.value.toString(),
    });
  }

  return verified;
}
