import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '../core/constants.js';
import { DOPPLER_VESTING_PROGRAM_ADDRESS } from '../generated/dopplerVesting/index.js';
import {
  createLaunch,
  createLaunchId,
  deriveCreateLaunchAddresses,
  type CreateLaunchAccountSigners,
  type CreateLaunchAddresses,
  type CreateLaunchCpmmMigrationConfig,
  type CreateLaunchInput,
  type LaunchSupply,
} from '../initializer/createLaunch.js';
import { INITIALIZER_PROGRAM_ID } from '../initializer/constants.js';
import {
  normalizeU64,
  prepareVestingConfiguration,
  type VestingPlan,
} from './internal.js';
import type { VestingAddresses } from './pda.js';

export type { VestingPlan } from './internal.js';

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

function resolveVestingMigration(
  migration: PrepareVestingLaunchInput['migration'],
  baseForLiquidity: bigint,
): CreateLaunchInput['migration'] {
  if (migration === undefined || migration === false || migration === null) {
    return false;
  }
  if (migration === true) {
    throw new Error(
      'vesting migration requires an explicit CPMM config with a positive minRaiseQuote',
    );
  }
  if (migration.kind === 'custom') {
    return migration;
  }

  const cpmmMigration: CreateLaunchCpmmMigrationConfig = migration;
  if (
    (cpmmMigration.recipients?.length ?? 0) !== 0 ||
    (cpmmMigration.recipientAtas?.length ?? 0) !== 0
  ) {
    throw new Error(
      'vesting CPMM migration does not support migration recipients',
    );
  }
  const minRaiseQuote = normalizeU64(
    cpmmMigration.minRaiseQuote ?? 0n,
    'migration minRaiseQuote',
  );
  if (minRaiseQuote === 0n) {
    throw new Error('vesting CPMM migration requires a positive minRaiseQuote');
  }
  const baseForDistribution = normalizeU64(
    cpmmMigration.baseForDistribution ?? 0n,
    'migration baseForDistribution',
  );
  if (baseForDistribution !== 0n) {
    throw new Error('vesting CPMM migration requires zero baseForDistribution');
  }
  const migrationBaseForLiquidity = normalizeU64(
    cpmmMigration.baseForLiquidity ?? baseForLiquidity,
    'migration baseForLiquidity',
  );
  if (migrationBaseForLiquidity !== baseForLiquidity) {
    throw new Error(
      'vesting CPMM migration baseForLiquidity must match the launch supply',
    );
  }

  return {
    ...cpmmMigration,
    minRaiseQuote,
    recipients: [],
    recipientAtas: [],
    baseForDistribution: 0n,
    baseForLiquidity,
  };
}

export async function prepareLaunch(
  input: PrepareVestingLaunchInput,
): Promise<PrepareVestingLaunchResult> {
  const {
    vesting: vestingPlan,
    vestingProgram: vestingProgramOverride,
    migration: requestedMigration,
    ...launchInput
  } = input;
  const baseForLiquidity = normalizeU64(
    input.supply.baseForLiquidity,
    'baseForLiquidity',
  );
  if (
    (requestedMigration === undefined ||
      requestedMigration === false ||
      requestedMigration === null) &&
    baseForLiquidity !== 0n
  ) {
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
  const initializerProgram =
    input.programId ??
    input.deployment?.initializerProgram ??
    INITIALIZER_PROGRAM_ID;
  const preparedVesting = await prepareVestingConfiguration({
    payer: input.payer,
    launch: launchAddresses.launch,
    launchAuthority: launchAddresses.launchAuthority,
    baseMint: input.launchAccounts.baseMint,
    baseVault: input.launchAccounts.baseVault,
    baseTokenProgram,
    initialSupply: input.supply.baseTotalSupply,
    plan: vestingPlan,
    vestingProgram,
    initializerProgram,
  });
  if (
    preparedVesting.totalAllocation + baseForLiquidity >=
    preparedVesting.initialSupply
  ) {
    throw new Error(
      'vesting and liquidity allocations must leave base tokens for the bonding curve',
    );
  }
  const migration = resolveVestingMigration(
    requestedMigration,
    baseForLiquidity,
  );
  const launch = await createLaunch({
    ...launchInput,
    namespace,
    launchId,
    addresses: launchAddresses,
    supply: {
      ...input.supply,
      baseTotalSupply: preparedVesting.initialSupply,
      baseForDistribution: preparedVesting.totalAllocation,
      baseForLiquidity,
    },
    migration,
    vestingConfig: preparedVesting.addresses.config,
  });

  return {
    namespace,
    launchId,
    launchAddresses,
    vestingAddresses: preparedVesting.addresses,
    totalAllocation: preparedVesting.totalAllocation,
    initializeVestingInstruction: preparedVesting.initializeInstruction,
    initializeLaunchInstruction: launch.instruction,
    fundVestingInstruction: preparedVesting.fundInstruction,
  };
}
