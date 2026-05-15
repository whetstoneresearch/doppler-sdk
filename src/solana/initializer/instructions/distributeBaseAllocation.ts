import type {
  Address,
  Instruction,
  AccountMeta,
  AccountSignerMeta,
  TransactionSigner,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getDistributeBaseAllocationInstructionDataEncoder } from '../../generated/initializer/index.js';

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
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return {
      address: value.address,
      role: AccountRole.READONLY_SIGNER,
      signer: value,
    };
  }
  return { address: value, role: AccountRole.READONLY_SIGNER };
}

export interface DistributeBaseAllocationAccounts {
  config: Address;
  launch: Address;
  launchAuthority: Address;
  baseMint: Address;
  baseVault: Address;
  recipientBaseAccount: Address;
  distributionAuthority: AddressOrSigner;
  baseTokenProgram?: Address;
}

export function createDistributeBaseAllocationInstruction(
  accounts: DistributeBaseAllocationAccounts,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    config,
    launch,
    launchAuthority,
    baseMint,
    baseVault,
    recipientBaseAccount,
    distributionAuthority,
    baseTokenProgram = TOKEN_PROGRAM_ADDRESS,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: AccountRole.READONLY },
    { address: launch, role: AccountRole.WRITABLE },
    { address: launchAuthority, role: AccountRole.READONLY },
    { address: baseMint, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.WRITABLE },
    { address: recipientBaseAccount, role: AccountRole.WRITABLE },
    createSignerAccountMeta(distributionAuthority),
    { address: baseTokenProgram, role: AccountRole.READONLY },
  ];

  const data = new Uint8Array(
    getDistributeBaseAllocationInstructionDataEncoder().encode({}),
  );

  return { programAddress: programId, accounts: keys, data };
}
