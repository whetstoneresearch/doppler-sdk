import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { TransactionSigner, AccountSignerMeta } from '@solana/kit';
import {
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_SIGNER,
  ACCOUNT_ROLE_WRITABLE,
  TOKEN_PROGRAM_ID,
} from '../../core/constants.js';
import {
  INITIALIZER_INSTRUCTION_DISCRIMINATORS,
  INITIALIZER_PROGRAM_ID,
} from '../constants.js';
import { encodeInstructionData } from '../../core/codecs.js';

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
    | typeof ACCOUNT_ROLE_READONLY
    | typeof ACCOUNT_ROLE_WRITABLE
    | typeof ACCOUNT_ROLE_SIGNER,
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return { address: value.address, role, signer: value };
  }
  return { address: value, role };
}

export interface AbortLaunchAccounts {
  config: Address;
  launch: Address;
  launchAuthority: Address;
  baseVault: Address;
  quoteVault: Address;
  authority: AddressOrSigner;
  authorityBaseAccount: Address;
  baseMint: Address;
  tokenProgram?: Address;
}

export function createAbortLaunchInstruction(
  accounts: AbortLaunchAccounts,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    config,
    launch,
    launchAuthority,
    baseVault,
    quoteVault,
    authority,
    authorityBaseAccount,
    baseMint,
    tokenProgram = TOKEN_PROGRAM_ID,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: launch, role: ACCOUNT_ROLE_WRITABLE },
    { address: launchAuthority, role: ACCOUNT_ROLE_READONLY },
    { address: baseVault, role: ACCOUNT_ROLE_WRITABLE },
    { address: quoteVault, role: ACCOUNT_ROLE_READONLY },
    createAccountMeta(authority, ACCOUNT_ROLE_SIGNER),
    { address: authorityBaseAccount, role: ACCOUNT_ROLE_WRITABLE },
    { address: baseMint, role: ACCOUNT_ROLE_READONLY },
    { address: tokenProgram, role: ACCOUNT_ROLE_READONLY },
  ];

  const data = encodeInstructionData(
    INITIALIZER_INSTRUCTION_DISCRIMINATORS.abortLaunch,
  );

  return { programAddress: programId, accounts: keys, data };
}
