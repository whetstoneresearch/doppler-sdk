import type {
  Address,
  Instruction,
  AccountMeta,
  TransactionSigner,
  AccountSignerMeta,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '../../core/constants.js';
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
    | typeof AccountRole.READONLY
    | typeof AccountRole.WRITABLE
    | typeof AccountRole.READONLY_SIGNER,
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
    tokenProgram = TOKEN_PROGRAM_ADDRESS,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: AccountRole.READONLY },
    { address: launch, role: AccountRole.WRITABLE },
    { address: launchAuthority, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.WRITABLE },
    { address: quoteVault, role: AccountRole.READONLY },
    createAccountMeta(authority, AccountRole.READONLY_SIGNER),
    { address: authorityBaseAccount, role: AccountRole.WRITABLE },
    { address: baseMint, role: AccountRole.READONLY },
    { address: tokenProgram, role: AccountRole.READONLY },
  ];

  const data = encodeInstructionData(
    INITIALIZER_INSTRUCTION_DISCRIMINATORS.abortLaunch,
  );

  return { programAddress: programId, accounts: keys, data };
}
