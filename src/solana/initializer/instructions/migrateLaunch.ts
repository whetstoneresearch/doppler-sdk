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
  TOKEN_PROGRAM_ADDRESS,
  SYSVAR_INSTRUCTIONS_ADDRESS,
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

function createSignerAccountMeta(
  value: AddressOrSigner,
  role: typeof AccountRole.WRITABLE_SIGNER,
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
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
  systemProgram?: Address;
  rent: Address;
  instructionsSysvar?: Address;
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
    baseTokenProgram = TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram = TOKEN_PROGRAM_ADDRESS,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
    rent,
    instructionsSysvar = SYSVAR_INSTRUCTIONS_ADDRESS,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: AccountRole.READONLY },
    { address: launch, role: AccountRole.WRITABLE },
    { address: launchAuthority, role: AccountRole.READONLY },
    { address: baseMint, role: AccountRole.READONLY },
    { address: quoteMint, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.WRITABLE },
    { address: quoteVault, role: AccountRole.WRITABLE },
    { address: migratorProgram, role: AccountRole.READONLY },
    createSignerAccountMeta(payer, AccountRole.WRITABLE_SIGNER),
    { address: baseTokenProgram, role: AccountRole.READONLY },
    { address: quoteTokenProgram, role: AccountRole.READONLY },
    { address: systemProgram, role: AccountRole.READONLY },
    { address: rent, role: AccountRole.READONLY },
    { address: instructionsSysvar, role: AccountRole.READONLY },
  ];

  const data = encodeInstructionData(
    INITIALIZER_INSTRUCTION_DISCRIMINATORS.migrateLaunch,
  );

  return { programAddress: programId, accounts: keys, data };
}
