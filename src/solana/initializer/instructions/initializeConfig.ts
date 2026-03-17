import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { TransactionSigner, AccountSignerMeta } from '@solana/kit';
import {
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_WRITABLE_SIGNER,
  SYSTEM_PROGRAM_ID,
} from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import type { InitializeConfigArgsArgs } from '../../generated/initializer/index.js';
import { getInitializeConfigInstructionDataEncoder } from '../../generated/initializer/index.js';

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

function createSignerAccountMeta(
  value: AddressOrSigner,
  role: typeof ACCOUNT_ROLE_WRITABLE_SIGNER,
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return { address: value.address, role, signer: value };
  }
  return { address: value, role };
}

export interface InitializeConfigAccounts {
  admin: AddressOrSigner;
  config: Address;
  programData: Address;
  systemProgram?: Address;
}

export function createInitializeConfigInstruction(
  accounts: InitializeConfigAccounts,
  args: InitializeConfigArgsArgs,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    admin,
    config,
    programData,
    systemProgram = SYSTEM_PROGRAM_ID,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    createSignerAccountMeta(admin, ACCOUNT_ROLE_WRITABLE_SIGNER),
    { address: config, role: ACCOUNT_ROLE_WRITABLE },
    { address: programData, role: ACCOUNT_ROLE_READONLY },
    { address: systemProgram, role: ACCOUNT_ROLE_READONLY },
  ];

  const data = new Uint8Array(
    getInitializeConfigInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: keys, data };
}
