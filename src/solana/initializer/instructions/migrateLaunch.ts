import type {
  Address,
  Instruction,
  AccountMeta,
  AccountSignerMeta,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '../../core/constants.js';
import {
  createAccountMeta,
  type AddressOrTransactionSigner,
} from '../../core/accounts.js';
import {
  INITIALIZER_INSTRUCTION_DISCRIMINATORS,
  INITIALIZER_PROGRAM_ID,
} from '../constants.js';
import { encodeInstructionData } from '../../core/codecs.js';

type AddressOrSigner = AddressOrTransactionSigner;

export interface MigrateLaunchAccounts {
  config: Address;
  launch: Address;
  launchAuthority: Address;
  baseMint: Address;
  quoteMint: Address;
  baseVault: Address;
  quoteVault: Address;
  launchFeeState: Address;
  migratorProgram: Address;
  payer: AddressOrSigner;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
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
    launchFeeState,
    migratorProgram,
    payer,
    baseTokenProgram = TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram = TOKEN_PROGRAM_ADDRESS,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
    rent,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: AccountRole.READONLY },
    { address: launch, role: AccountRole.WRITABLE },
    { address: launchAuthority, role: AccountRole.READONLY },
    { address: baseMint, role: AccountRole.READONLY },
    { address: quoteMint, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.WRITABLE },
    { address: quoteVault, role: AccountRole.WRITABLE },
    { address: launchFeeState, role: AccountRole.READONLY },
    { address: migratorProgram, role: AccountRole.READONLY },
    createAccountMeta(payer, AccountRole.WRITABLE_SIGNER),
    { address: baseTokenProgram, role: AccountRole.READONLY },
    { address: quoteTokenProgram, role: AccountRole.READONLY },
    { address: systemProgram, role: AccountRole.READONLY },
    { address: rent, role: AccountRole.READONLY },
  ];

  const data = encodeInstructionData(
    INITIALIZER_INSTRUCTION_DISCRIMINATORS.migrateLaunch,
  );

  return { programAddress: programId, accounts: keys, data };
}
