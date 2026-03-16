import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { TransactionSigner, AccountSignerMeta } from '@solana/kit';
import {
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_WRITABLE_SIGNER,
} from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getSetSentinelAllowlistInstructionDataEncoder } from '../../generated/initializer/instructions/setSentinelAllowlist.js';

type AddressOrSigner = Address | TransactionSigner;

function isTransactionSigner(value: AddressOrSigner): value is TransactionSigner {
  return typeof value === 'object' && value !== null && 'address' in value && 'signTransactions' in value;
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

export interface SetSentinelAllowlistAccounts {
  admin: AddressOrSigner;
  config: Address;
}

export function createSetSentinelAllowlistInstruction(
  accounts: SetSentinelAllowlistAccounts,
  allowlist: Address[],
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const { admin, config } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    createSignerAccountMeta(admin, ACCOUNT_ROLE_WRITABLE_SIGNER),
    { address: config, role: ACCOUNT_ROLE_WRITABLE },
  ];

  const data = new Uint8Array(
    getSetSentinelAllowlistInstructionDataEncoder().encode({ allowlist }),
  );

  return { programAddress: programId, accounts: keys, data };
}
