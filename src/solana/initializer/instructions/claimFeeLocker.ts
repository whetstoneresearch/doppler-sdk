import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getClaimFeeLockerInstructionDataEncoder } from '../../generated/initializer/index.js';

export interface ClaimFeeLockerAccounts {
  launch: Address;
  launchAuthority: Address;
  feeLocker: Address;
  baseMint: Address;
  quoteMint: Address;
  baseVault: Address;
  quoteVault: Address;
  beneficiary: Address;
  beneficiaryBaseAccount: Address;
  beneficiaryQuoteAccount: Address;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
}

export function createClaimFeeLockerInstruction(
  accounts: ClaimFeeLockerAccounts,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    launch,
    launchAuthority,
    feeLocker,
    baseMint,
    quoteMint,
    baseVault,
    quoteVault,
    beneficiary,
    beneficiaryBaseAccount,
    beneficiaryQuoteAccount,
    baseTokenProgram = TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram = TOKEN_PROGRAM_ADDRESS,
  } = accounts;

  const keys: AccountMeta[] = [
    { address: launch, role: AccountRole.READONLY },
    { address: launchAuthority, role: AccountRole.READONLY },
    { address: feeLocker, role: AccountRole.WRITABLE },
    { address: baseMint, role: AccountRole.READONLY },
    { address: quoteMint, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.WRITABLE },
    { address: quoteVault, role: AccountRole.WRITABLE },
    { address: beneficiary, role: AccountRole.READONLY },
    { address: beneficiaryBaseAccount, role: AccountRole.WRITABLE },
    { address: beneficiaryQuoteAccount, role: AccountRole.WRITABLE },
    { address: baseTokenProgram, role: AccountRole.READONLY },
    { address: quoteTokenProgram, role: AccountRole.READONLY },
  ];

  const data = new Uint8Array(
    getClaimFeeLockerInstructionDataEncoder().encode({}),
  );

  return { programAddress: programId, accounts: keys, data };
}
