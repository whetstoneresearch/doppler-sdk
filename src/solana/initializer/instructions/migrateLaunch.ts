import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { TransactionSigner, AccountSignerMeta } from '@solana/kit';
import {
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_WRITABLE_SIGNER,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../../core/constants.js';
import {
  INITIALIZER_INSTRUCTION_DISCRIMINATORS,
  INITIALIZER_PROGRAM_ID,
} from '../constants.js';
import { encodeInstructionData } from '../../core/codecs.js';

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

export interface MigrateLaunchAccounts {
  config: Address;
  launch: Address;
  launchAuthority: Address;
  baseMint: Address;
  quoteMint: Address;
  baseVault: Address;
  quoteVault: Address;
  migratorProgram: Address;
  payer: AddressOrSigner;
  tokenProgram?: Address;
  systemProgram?: Address;
  rent: Address;
}

export function createMigrateLaunchInstruction(
  accounts: MigrateLaunchAccounts,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    config,
    launch,
    launchAuthority,
    baseMint,
    quoteMint,
    baseVault,
    quoteVault,
    migratorProgram,
    payer,
    tokenProgram = TOKEN_PROGRAM_ID,
    systemProgram = SYSTEM_PROGRAM_ID,
    rent,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: launch, role: ACCOUNT_ROLE_WRITABLE },
    { address: launchAuthority, role: ACCOUNT_ROLE_READONLY },
    { address: baseMint, role: ACCOUNT_ROLE_READONLY },
    { address: quoteMint, role: ACCOUNT_ROLE_READONLY },
    { address: baseVault, role: ACCOUNT_ROLE_WRITABLE },
    { address: quoteVault, role: ACCOUNT_ROLE_WRITABLE },
    { address: migratorProgram, role: ACCOUNT_ROLE_READONLY },
    createSignerAccountMeta(payer, ACCOUNT_ROLE_WRITABLE_SIGNER),
    { address: tokenProgram, role: ACCOUNT_ROLE_READONLY },
    { address: systemProgram, role: ACCOUNT_ROLE_READONLY },
    { address: rent, role: ACCOUNT_ROLE_READONLY },
  ];

  const data = encodeInstructionData(
    INITIALIZER_INSTRUCTION_DISCRIMINATORS.migrateLaunch,
  );

  return { programAddress: programId, accounts: keys, data };
}

