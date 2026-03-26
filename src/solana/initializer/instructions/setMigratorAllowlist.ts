import type {
  Address,
  Instruction,
  AccountMeta,
  TransactionSigner,
  AccountSignerMeta,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {} from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getSetMigratorAllowlistInstructionDataEncoder } from '../../generated/initializer/index.js';

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
    createSignerAccountMeta(admin, AccountRole.WRITABLE_SIGNER),
    { address: config, role: AccountRole.WRITABLE },
  ];

  const data = new Uint8Array(
    getSetMigratorAllowlistInstructionDataEncoder().encode({ allowlist }),
  );

  return { programAddress: programId, accounts: keys, data };
}
