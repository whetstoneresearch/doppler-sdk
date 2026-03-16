import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { TransactionSigner, AccountSignerMeta } from '@solana/kit';
import {
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_SIGNER,
  ACCOUNT_ROLE_WRITABLE,
  TOKEN_PROGRAM_ID,
} from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getCurveSwapExactInInstructionDataEncoder } from '../../generated/initializer/instructions/curveSwapExactIn.js';

type AddressOrSigner = Address | TransactionSigner;

function isTransactionSigner(value: AddressOrSigner): value is TransactionSigner {
  return typeof value === 'object' && value !== null && 'address' in value && 'signTransactions' in value;
}

function createAccountMeta(
  value: AddressOrSigner,
  role: typeof ACCOUNT_ROLE_READONLY | typeof ACCOUNT_ROLE_WRITABLE | typeof ACCOUNT_ROLE_SIGNER,
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
    sentinelProgram,
    tokenProgram = TOKEN_PROGRAM_ID,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: launch, role: ACCOUNT_ROLE_WRITABLE },
    { address: launchAuthority, role: ACCOUNT_ROLE_READONLY },
    { address: baseVault, role: ACCOUNT_ROLE_WRITABLE },
    { address: quoteVault, role: ACCOUNT_ROLE_WRITABLE },
    { address: userBaseAccount, role: ACCOUNT_ROLE_WRITABLE },
    { address: userQuoteAccount, role: ACCOUNT_ROLE_WRITABLE },
    { address: baseMint, role: ACCOUNT_ROLE_READONLY },
    { address: quoteMint, role: ACCOUNT_ROLE_READONLY },
    createAccountMeta(user, ACCOUNT_ROLE_SIGNER),
  ];

  if (sentinelProgram) {
    keys.push({ address: sentinelProgram, role: ACCOUNT_ROLE_READONLY });
  }

  keys.push({ address: tokenProgram, role: ACCOUNT_ROLE_READONLY });

  const data = new Uint8Array(getCurveSwapExactInInstructionDataEncoder().encode(args));

  return { programAddress: programId, accounts: keys, data };
}
