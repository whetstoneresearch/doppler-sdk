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
  SYSVAR_INSTRUCTIONS_ADDRESS,
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
  role: typeof AccountRole.WRITABLE_SIGNER,
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
  instructionsSysvar?: Address;
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
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
    instructionsSysvar = SYSVAR_INSTRUCTIONS_ADDRESS,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    createSignerAccountMeta(admin, AccountRole.WRITABLE_SIGNER),
    { address: config, role: AccountRole.WRITABLE },
    { address: programData, role: AccountRole.READONLY },
    { address: systemProgram, role: AccountRole.READONLY },
    { address: instructionsSysvar, role: AccountRole.READONLY },
  ];

  const data = new Uint8Array(
    getInitializeConfigInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: keys, data };
}
