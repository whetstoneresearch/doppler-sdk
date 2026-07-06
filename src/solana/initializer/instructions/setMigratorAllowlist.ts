import type {
  Address,
  Instruction,
  AccountMeta,
  AccountSignerMeta,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  createAccountMeta,
  type AddressOrTransactionSigner,
} from '../../core/accounts.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getSetMigratorAllowlistInstructionDataEncoder } from '../../generated/initializer/index.js';

type AddressOrSigner = AddressOrTransactionSigner;

export interface SetMigratorAllowlistAccounts {
  admin: AddressOrSigner;
  config: Address;
}

export function createSetMigratorAllowlistInstruction(
  accounts: SetMigratorAllowlistAccounts,
  allowlist: Address[],
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const { admin, config } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    createAccountMeta(admin, AccountRole.WRITABLE_SIGNER),
    { address: config, role: AccountRole.WRITABLE },
  ];

  const data = new Uint8Array(
    getSetMigratorAllowlistInstructionDataEncoder().encode({ allowlist }),
  );

  return { programAddress: programId, accounts: keys, data };
}
