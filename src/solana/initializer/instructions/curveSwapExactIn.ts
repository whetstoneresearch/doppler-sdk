import type {
  Address,
  Instruction,
  AccountMeta,
  TransactionSigner,
  AccountSignerMeta,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getCurveSwapExactInInstructionDataEncoder } from '../../generated/initializer/index.js';

type AddressOrSigner = Address | TransactionSigner;

function isTransactionSigner(
  value: AddressOrSigner,
): value is TransactionSigner {
  return (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    'signTransactions' in value
  );
}

function createAccountMeta(
  value: AddressOrSigner,
  role:
    | typeof AccountRole.READONLY
    | typeof AccountRole.WRITABLE
    | typeof AccountRole.READONLY_SIGNER,
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return { address: value.address, role, signer: value };
  }
  return { address: value, role };
}

export interface CurveSwapExactInAccounts {
  config: Address;
  launch: Address;
  launchAuthority: Address;
  baseVault: Address;
  quoteVault: Address;
  userBaseAccount: Address;
  userQuoteAccount: Address;
  baseMint: Address;
  quoteMint: Address;
  user: AddressOrSigner;
  /** Pass the actual sentinel program address, or omit to use System Program as a no-op placeholder. */
  sentinelProgram?: Address;
  tokenProgram?: Address;
}

export function createCurveSwapExactInInstruction(
  accounts: CurveSwapExactInAccounts,
  args: { amountIn: bigint; minAmountOut: bigint; direction: number },
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    config,
    launch,
    launchAuthority,
    baseVault,
    quoteVault,
    userBaseAccount,
    userQuoteAccount,
    baseMint,
    quoteMint,
    user,
    sentinelProgram = SYSTEM_PROGRAM_ADDRESS,
    tokenProgram = TOKEN_PROGRAM_ADDRESS,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: AccountRole.READONLY },
    { address: launch, role: AccountRole.WRITABLE },
    { address: launchAuthority, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.WRITABLE },
    { address: quoteVault, role: AccountRole.WRITABLE },
    { address: userBaseAccount, role: AccountRole.WRITABLE },
    { address: userQuoteAccount, role: AccountRole.WRITABLE },
    { address: baseMint, role: AccountRole.READONLY },
    { address: quoteMint, role: AccountRole.READONLY },
    createAccountMeta(user, AccountRole.READONLY_SIGNER),
    // sentinel_program is Optional in the on-chain struct but still occupies a fixed
    // slot (token_program follows it).  Always emit it — use SYSTEM_PROGRAM_ADDRESS as the
    // no-op placeholder when no real sentinel is configured.
    { address: sentinelProgram, role: AccountRole.READONLY },
    { address: tokenProgram, role: AccountRole.READONLY },
  ];

  const data = new Uint8Array(
    getCurveSwapExactInInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: keys, data };
}
