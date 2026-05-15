import type {
  AccountMeta,
  AccountSignerMeta,
  Address,
  Instruction,
  TransactionSigner,
} from '@solana/kit';
import { getStructCodec, getU64Codec, AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getPreviewSwapExactInInstructionDataEncoder } from '../../generated/initializer/index.js';

type RemainingAccount =
  | Address
  | AccountMeta
  | AccountSignerMeta
  | TransactionSigner;

function isTransactionSigner(value: unknown): value is TransactionSigner {
  return (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    'signTransactions' in value
  );
}

function createRemainingAccountMeta(
  value: RemainingAccount,
): AccountMeta | AccountSignerMeta {
  if (typeof value === 'string') {
    return { address: value, role: AccountRole.READONLY };
  }
  if (isTransactionSigner(value)) {
    return {
      address: value.address,
      role: AccountRole.READONLY_SIGNER,
      signer: value,
    };
  }
  return value;
}

export interface PreviewSwapExactInResult {
  amountOut: bigint;
  feePaid: bigint;
}

const previewSwapExactInResultCodec = getStructCodec([
  ['amountOut', getU64Codec()],
  ['feePaid', getU64Codec()],
]);

export interface PreviewSwapExactInAccounts {
  launch: Address;
  baseVault: Address;
  quoteVault: Address;
  hookProgram?: Address;
  feeLocker: Address;
  remainingAccounts?: RemainingAccount[];
}

export function createPreviewSwapExactInInstruction(
  accounts: PreviewSwapExactInAccounts,
  args: { amountIn: bigint; tradeDirection: number },
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    launch,
    baseVault,
    quoteVault,
    hookProgram = SYSTEM_PROGRAM_ADDRESS,
    feeLocker,
    remainingAccounts = [],
  } = accounts;

  const keys = [
    { address: launch, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.READONLY },
    { address: quoteVault, role: AccountRole.READONLY },
  ] as const;

  const accountsWithRemaining = [
    ...keys,
    { address: hookProgram, role: AccountRole.READONLY },
    { address: feeLocker, role: AccountRole.READONLY },
    ...remainingAccounts.map(createRemainingAccountMeta),
  ];

  const data = new Uint8Array(
    getPreviewSwapExactInInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: accountsWithRemaining, data };
}

export function decodePreviewSwapExactInResult(
  data: Uint8Array,
): PreviewSwapExactInResult {
  return previewSwapExactInResultCodec.decode(data);
}
