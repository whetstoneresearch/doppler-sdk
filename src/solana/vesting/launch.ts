import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import { getAddressFromAddressOrSigner } from '../core/accounts.js';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '../core/constants.js';
import {
  DOPPLER_VESTING_PROGRAM_ADDRESS,
  getInitializeVestingInstructionAsync,
  type VestingAllocationInputArgs,
  type VestingScheduleArgs,
} from '../generated/dopplerVesting/index.js';
import { getFundVestingInstructionAsync } from '../generated/initializer/index.js';
import {
  createLaunch,
  createLaunchId,
  deriveCreateLaunchAddresses,
  type CreateLaunchAccountSigners,
  type CreateLaunchAddresses,
  type CreateLaunchInput,
  type LaunchSupply,
} from '../initializer/createLaunch.js';
import { INITIALIZER_PROGRAM_ID } from '../initializer/constants.js';
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

type VestingLaunchSupply = Omit<LaunchSupply, 'baseForDistribution'>;

export type PrepareVestingLaunchInput = Omit<
  CreateLaunchInput,
  'launchAccounts' | 'migration' | 'payer' | 'supply' | 'vestingConfig'
> & {
  launchAccounts: Omit<CreateLaunchAccountSigners, 'baseMint'> & {
    baseMint: TransactionSigner;
  };
  payer: TransactionSigner;
  supply: VestingLaunchSupply;
  vesting: VestingPlan;
  /** Vesting launches are non-migrating unless a migration is explicitly supplied. */
  migration?: CreateLaunchInput['migration'];
  vestingProgram?: Address;
};

export type PrepareVestingLaunchResult = {
  namespace: Address;
  launchId: Uint8Array;
  launchAddresses: CreateLaunchAddresses;
  vestingAddresses: VestingAddresses;
  totalAllocation: bigint;
  initializeVestingInstruction: Instruction;
  initializeLaunchInstruction: Instruction;
  fundVestingInstruction: Instruction;
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

function asU64(value: number | bigint, label: string): bigint {
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
    const cliffSeconds = asU64(
      schedule.cliffSeconds,
      `vesting schedule ${index} cliffSeconds`,
    );
    const durationSeconds = asU64(
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
    const amount = asU64(
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

export async function prepareLaunch(
  input: PrepareVestingLaunchInput,
): Promise<PrepareVestingLaunchResult> {
  const {
    vesting: vestingPlan,
    vestingProgram: vestingProgramOverride,
    ...launchInput
  } = input;
  const initialSupply = asU64(input.supply.baseTotalSupply, 'baseTotalSupply');
  if (initialSupply === 0n) {
    throw new Error('baseTotalSupply must be positive');
  }
  const baseForLiquidity = asU64(
    input.supply.baseForLiquidity,
    'baseForLiquidity',
  );
  const migration = input.migration ?? false;
  if ((migration === false || migration === null) && baseForLiquidity !== 0n) {
    throw new Error('non-migrating launches require zero baseForLiquidity');
  }
  const launchId = input.launchId ?? createLaunchId();
  const namespace = input.namespace ?? SYSTEM_PROGRAM_ADDRESS;
  const launchAddresses =
    input.addresses ??
    (await deriveCreateLaunchAddresses({
      deployment: input.deployment,
      programId: input.programId,
      config: input.config,
      namespace,
      launchId,
      baseMint: input.launchAccounts.baseMint,
      metadata: input.metadata,
    }));
  const baseTokenProgram =
    input.tokenPrograms?.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const vestingProgram =
    vestingProgramOverride ?? DOPPLER_VESTING_PROGRAM_ADDRESS;
  const vestingAddresses = await deriveVestingAddresses(
    launchAddresses.launch,
    input.launchAccounts.baseMint.address,
    baseTokenProgram,
    vestingProgram,
  );
  const plan = validateVestingPlan(
    vestingPlan,
    initialSupply,
    vestingAddresses.config,
  );
  if (plan.totalAllocation + baseForLiquidity >= initialSupply) {
    throw new Error(
      'vesting and liquidity allocations must leave base tokens for the bonding curve',
    );
  }

  const initializeVestingInstruction =
    await getInitializeVestingInstructionAsync(
      {
        payer: input.payer,
        launch: launchAddresses.launch,
        baseMint: input.launchAccounts.baseMint,
        baseTokenProgram,
        vestingConfig: vestingAddresses.config,
        initialSupply,
        schedules: plan.schedules,
        allocations: plan.allocations,
      },
      { programAddress: vestingProgram },
    );
  const launch = await createLaunch({
    ...launchInput,
    namespace,
    launchId,
    addresses: launchAddresses,
    supply: {
      ...input.supply,
      baseTotalSupply: initialSupply,
      baseForDistribution: plan.totalAllocation,
      baseForLiquidity,
    },
    migration,
    vestingConfig: vestingAddresses.config,
  });
  const initializerProgram =
    input.programId ??
    input.deployment?.initializerProgram ??
    INITIALIZER_PROGRAM_ID;
  const fundVestingInstruction = await getFundVestingInstructionAsync(
    {
      launch: launchAddresses.launch,
      launchAuthority: launchAddresses.launchAuthority,
      vestingConfig: vestingAddresses.config,
      baseMint: input.launchAccounts.baseMint.address,
      baseVault: getAddressFromAddressOrSigner(input.launchAccounts.baseVault),
      vestingVault: vestingAddresses.vault,
      payer: input.payer,
      baseTokenProgram,
    },
    { programAddress: initializerProgram },
  );

  return {
    namespace,
    launchId,
    launchAddresses,
    vestingAddresses,
    totalAllocation: plan.totalAllocation,
    initializeVestingInstruction,
    initializeLaunchInstruction: launch.instruction,
    fundVestingInstruction,
  };
}
