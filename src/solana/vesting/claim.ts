import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '../core/constants.js';
import {
  DOPPLER_VESTING_PROGRAM_ADDRESS,
  getClaimInstructionAsync,
} from '../generated/dopplerVesting/index.js';
import { MAX_VESTING_SCHEDULES } from './constants.js';
import {
  deriveVestingAddresses,
  getVestingBeneficiaryTokenAccountAddress,
  type VestingAddresses,
} from './pda.js';

const MAX_U64 = (1n << 64n) - 1n;

export type PrepareVestingClaimInput = {
  payer: TransactionSigner;
  beneficiary: Address;
  launch: Address;
  baseMint: Address;
  baseTokenProgram?: Address;
  scheduleId?: number | null;
  /** Zero or omitted claims every token currently available. */
  amount?: bigint;
  vestingProgram?: Address;
};

export type PrepareVestingClaimResult = VestingAddresses & {
  beneficiaryTokenAccount: Address;
  instruction: Instruction;
};

export async function prepareClaim(
  input: PrepareVestingClaimInput,
): Promise<PrepareVestingClaimResult> {
  if (input.beneficiary === SYSTEM_PROGRAM_ADDRESS) {
    throw new Error('beneficiary must not be the default address');
  }
  if (
    input.scheduleId !== undefined &&
    input.scheduleId !== null &&
    (!Number.isInteger(input.scheduleId) ||
      input.scheduleId < 0 ||
      input.scheduleId >= MAX_VESTING_SCHEDULES)
  ) {
    throw new Error(
      `scheduleId must be between 0 and ${MAX_VESTING_SCHEDULES - 1}`,
    );
  }
  const amount = input.amount ?? 0n;
  if (amount < 0n || amount > MAX_U64) {
    throw new Error('amount must fit in a u64');
  }

  const baseTokenProgram = input.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const vestingProgram =
    input.vestingProgram ?? DOPPLER_VESTING_PROGRAM_ADDRESS;
  const addresses = await deriveVestingAddresses(
    input.launch,
    input.baseMint,
    baseTokenProgram,
    vestingProgram,
  );
  const [beneficiaryTokenAccount] =
    await getVestingBeneficiaryTokenAccountAddress(
      input.beneficiary,
      input.baseMint,
      baseTokenProgram,
    );
  const instruction = await getClaimInstructionAsync(
    {
      payer: input.payer,
      beneficiary: input.beneficiary,
      launch: input.launch,
      vestingConfig: addresses.config,
      baseMint: input.baseMint,
      vestingVault: addresses.vault,
      beneficiaryTokenAccount,
      baseTokenProgram,
      scheduleId: input.scheduleId ?? null,
      amount,
    },
    { programAddress: vestingProgram },
  );

  return { ...addresses, beneficiaryTokenAccount, instruction };
}
