import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import {
  getAddressFromAddressOrSigner,
  type AddressOrTransactionSigner,
} from '../core/accounts.js';
import { SYSTEM_PROGRAM_ADDRESS } from '../core/constants.js';
import {
  getInitializeVestingInstructionAsync,
  type VestingAllocationInputArgs,
  type VestingScheduleArgs,
} from '../generated/dopplerVesting/index.js';
import { getFundVestingInstructionAsync } from '../generated/initializer/index.js';
import {
  MAX_VESTED_BPS,
  MAX_VESTING_ALLOCATIONS,
  MAX_VESTING_SCHEDULES,
  MIN_VESTING_DURATION_SECONDS,
  VESTING_BPS_DENOMINATOR,
} from './constants.js';
import { deriveVestingAddresses, type VestingAddresses } from './pda.js';

const MAX_U64 = (1n << 64n) - 1n;

export type VestingPlan = {
  schedules: ReadonlyArray<VestingScheduleArgs>;
  allocations: ReadonlyArray<VestingAllocationInputArgs>;
};

type ValidatedVestingPlan = {
  schedules: Array<{ cliffSeconds: bigint; durationSeconds: bigint }>;
  allocations: Array<{
    beneficiary: Address;
    scheduleId: number;
    amount: bigint;
  }>;
  totalAllocation: bigint;
};

type PrepareVestingConfigurationInput = {
  payer: TransactionSigner;
  launch: Address;
  launchAuthority: Address;
  baseMint: TransactionSigner;
  baseVault: AddressOrTransactionSigner;
  baseTokenProgram: Address;
  initialSupply: number | bigint;
  plan: VestingPlan;
  vestingProgram: Address;
  initializerProgram: Address;
};

export type PreparedVestingConfiguration = {
  addresses: VestingAddresses;
  initialSupply: bigint;
  totalAllocation: bigint;
  initializeInstruction: Instruction;
  fundInstruction: Instruction;
};

export function normalizeU64(value: number | bigint, label: string): bigint {
  if (
    typeof value === 'number' &&
    (!Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  const normalized = BigInt(value);
  if (normalized < 0n || normalized > MAX_U64) {
    throw new Error(`${label} must fit in a u64`);
  }
  return normalized;
}

function validateVestingPlan(
  plan: VestingPlan,
  initialSupply: bigint,
  vestingConfig: Address,
): ValidatedVestingPlan {
  if (
    plan.schedules.length === 0 ||
    plan.schedules.length > MAX_VESTING_SCHEDULES
  ) {
    throw new Error(`vesting requires 1 to ${MAX_VESTING_SCHEDULES} schedules`);
  }
  if (
    plan.allocations.length === 0 ||
    plan.allocations.length > MAX_VESTING_ALLOCATIONS
  ) {
    throw new Error(
      `vesting requires 1 to ${MAX_VESTING_ALLOCATIONS} allocations`,
    );
  }

  const schedules = plan.schedules.map((schedule, index) => {
    const cliffSeconds = normalizeU64(
      schedule.cliffSeconds,
      `vesting schedule ${index} cliffSeconds`,
    );
    const durationSeconds = normalizeU64(
      schedule.durationSeconds,
      `vesting schedule ${index} durationSeconds`,
    );
    if (
      durationSeconds !== 0n &&
      durationSeconds < MIN_VESTING_DURATION_SECONDS
    ) {
      throw new Error(
        `vesting schedule ${index} duration must be zero or at least ${MIN_VESTING_DURATION_SECONDS} seconds`,
      );
    }
    if (cliffSeconds > durationSeconds) {
      throw new Error(
        `vesting schedule ${index} cliff cannot exceed its duration`,
      );
    }
    return { cliffSeconds, durationSeconds };
  });

  const beneficiaryTotals = new Map<Address, bigint>();
  let totalAllocation = 0n;
  const allocations = plan.allocations.map((allocation, index) => {
    if (
      allocation.beneficiary === SYSTEM_PROGRAM_ADDRESS ||
      allocation.beneficiary === vestingConfig
    ) {
      throw new Error(`vesting allocation ${index} has an invalid beneficiary`);
    }
    if (
      !Number.isInteger(allocation.scheduleId) ||
      allocation.scheduleId < 0 ||
      allocation.scheduleId >= schedules.length
    ) {
      throw new Error(
        `vesting allocation ${index} references an unknown schedule`,
      );
    }
    const amount = normalizeU64(
      allocation.amount,
      `vesting allocation ${index} amount`,
    );
    if (amount === 0n) {
      throw new Error(`vesting allocation ${index} amount must be positive`);
    }

    totalAllocation += amount;
    beneficiaryTotals.set(
      allocation.beneficiary,
      (beneficiaryTotals.get(allocation.beneficiary) ?? 0n) + amount,
    );
    return { ...allocation, amount };
  });

  const maximumAllocation =
    (initialSupply * MAX_VESTED_BPS) / VESTING_BPS_DENOMINATOR;
  if (totalAllocation > maximumAllocation) {
    throw new Error('total vesting allocation exceeds 80% of initial supply');
  }
  for (const [beneficiary, amount] of beneficiaryTotals) {
    if (amount > maximumAllocation) {
      throw new Error(
        `vesting allocation for ${beneficiary} exceeds 80% of initial supply`,
      );
    }
  }

  return { schedules, allocations, totalAllocation };
}

export async function prepareVestingConfiguration(
  input: PrepareVestingConfigurationInput,
): Promise<PreparedVestingConfiguration> {
  const initialSupply = normalizeU64(input.initialSupply, 'baseTotalSupply');
  if (initialSupply === 0n) {
    throw new Error('baseTotalSupply must be positive');
  }

  const addresses = await deriveVestingAddresses(
    input.launch,
    input.baseMint.address,
    input.baseTokenProgram,
    input.vestingProgram,
  );
  const plan = validateVestingPlan(input.plan, initialSupply, addresses.config);
  const initializeInstruction = await getInitializeVestingInstructionAsync(
    {
      payer: input.payer,
      launch: input.launch,
      baseMint: input.baseMint,
      baseTokenProgram: input.baseTokenProgram,
      vestingConfig: addresses.config,
      initialSupply,
      schedules: plan.schedules,
      allocations: plan.allocations,
    },
    { programAddress: input.vestingProgram },
  );
  const fundInstruction = await getFundVestingInstructionAsync(
    {
      launch: input.launch,
      launchAuthority: input.launchAuthority,
      vestingConfig: addresses.config,
      baseMint: input.baseMint.address,
      baseVault: getAddressFromAddressOrSigner(input.baseVault),
      vestingVault: addresses.vault,
      payer: input.payer,
      baseTokenProgram: input.baseTokenProgram,
    },
    { programAddress: input.initializerProgram },
  );

  return {
    addresses,
    initialSupply,
    totalAllocation: plan.totalAllocation,
    initializeInstruction,
    fundInstruction,
  };
}
