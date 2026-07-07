import type {
  Address,
  Instruction,
  AccountMeta,
  AccountSignerMeta,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '../../core/constants.js';
import {
  createAccountMeta,
  type AddressOrTransactionSigner,
} from '../../core/accounts.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import type { InitializeConfigArgsArgs } from '../../generated/initializer/index.js';
import { getInitializeConfigInstructionDataEncoder } from '../../generated/initializer/index.js';

type AddressOrSigner = AddressOrTransactionSigner;

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
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    createAccountMeta(admin, AccountRole.WRITABLE_SIGNER),
    { address: config, role: AccountRole.WRITABLE },
    { address: programData, role: AccountRole.READONLY },
    { address: systemProgram, role: AccountRole.READONLY },
  ];

  const data = new Uint8Array(
    getInitializeConfigInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: keys, data };
}
