import {
  address,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import { getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';

import {
  SYSTEM_PROGRAM_ADDRESS,
  SYSVAR_RENT_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from './core/constants.js';
import type { SolanaCpmmDeployment } from './deployment.js';
import {
  CPMM_MIGRATOR_PROGRAM_ID,
  type CpmmMigrationRemainingAccounts,
  type RecipientArgs,
} from './migrators/cpmmMigrator/index.js';
import {
  INITIALIZER_PROGRAM_ID,
  createMigrateLaunchInstruction,
} from './initializer/index.js';

type TokenBalanceRpc = {
  getTokenAccountBalance(
    address: Address,
    config?: { commitment?: 'processed' | 'confirmed' | 'finalized' },
  ): {
    send(): Promise<{ value: { amount: string } }>;
  };
};

export type MigrateLaunchInput = {
  deployment?: Pick<
    SolanaCpmmDeployment,
    'initializerProgram' | 'initializerConfig' | 'cpmmMigratorProgram'
  >;
  programId?: Address;
  config?: Address;
  launch: Address;
  launchAuthority: Address;
  baseMint: Address;
  quoteMint: Address;
  baseVault: Address;
  quoteVault: Address;
  launchFeeState: Address;
  payer: TransactionSigner;
  cpmmMigration: CpmmMigrationRemainingAccounts;
  recipients?: ReadonlyArray<Pick<RecipientArgs, 'wallet'>>;
  computeUnitLimit?: number | false;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
  systemProgram?: Address;
  rent?: Address;
};

export type MigrateLaunchResult = {
  recipientAtaInstructions: Instruction[];
  computeUnitLimitInstruction?: Instruction;
  migrateInstruction: Instruction;
  instructions: Instruction[];
};

export type MigrationQuoteProgress = {
  quoteVaultAmount: bigint;
  pendingQuoteFees: bigint;
  migrationQuoteAmount: bigint;
};

const COMPUTE_BUDGET_PROGRAM_ID = address(
  'ComputeBudget111111111111111111111111111111',
);

function createSetComputeUnitLimitInstruction(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM_ID,
    accounts: [],
    data,
  };
}

function getDefaultComputeUnitLimit(
  cpmmMigration: CpmmMigrationRemainingAccounts,
): number {
  return cpmmMigration.recipientAtas.length > 0 ? 800_000 : 400_000;
}

export function migrateLaunch(input: MigrateLaunchInput): MigrateLaunchResult {
  const baseTokenProgram = input.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const quoteTokenProgram = input.quoteTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const recipients = input.recipients ? [...input.recipients] : [];
  if (
    recipients.length > 0 &&
    recipients.length !== input.cpmmMigration.recipientAtas.length
  ) {
    throw new Error(
      'recipients length must match cpmmMigration.recipientAtas length',
    );
  }
  const initializerConfig = input.config ?? input.deployment?.initializerConfig;
  if (!initializerConfig) {
    throw new Error('config or deployment.initializerConfig is required');
  }

  const recipientAtaInstructions = recipients.map((recipient, index) =>
    getCreateAssociatedTokenIdempotentInstruction({
      payer: input.payer,
      ata: input.cpmmMigration.recipientAtas[index],
      owner: recipient.wallet,
      mint: input.baseMint,
      tokenProgram: baseTokenProgram,
    }),
  );
  const migrateLaunchInstruction = createMigrateLaunchInstruction(
    {
      config: initializerConfig,
      launch: input.launch,
      launchAuthority: input.launchAuthority,
      baseMint: input.baseMint,
      quoteMint: input.quoteMint,
      baseVault: input.baseVault,
      quoteVault: input.quoteVault,
      launchFeeState: input.launchFeeState,
      migratorProgram:
        input.deployment?.cpmmMigratorProgram ?? CPMM_MIGRATOR_PROGRAM_ID,
      payer: input.payer,
      baseTokenProgram,
      quoteTokenProgram,
      systemProgram: input.systemProgram ?? SYSTEM_PROGRAM_ADDRESS,
      rent: input.rent ?? SYSVAR_RENT_ADDRESS,
    },
    input.programId ??
      input.deployment?.initializerProgram ??
      INITIALIZER_PROGRAM_ID,
  );
  const migrateInstruction = {
    ...migrateLaunchInstruction,
    accounts: [
      ...(migrateLaunchInstruction.accounts ?? []),
      ...input.cpmmMigration.metas,
    ],
  };
  const computeUnitLimit =
    input.computeUnitLimit === undefined
      ? getDefaultComputeUnitLimit(input.cpmmMigration)
      : input.computeUnitLimit;
  const computeUnitLimitInstruction =
    computeUnitLimit === false
      ? undefined
      : createSetComputeUnitLimitInstruction(computeUnitLimit);
  const instructions = [
    ...(computeUnitLimitInstruction ? [computeUnitLimitInstruction] : []),
    ...recipientAtaInstructions,
    migrateInstruction,
  ];

  return {
    recipientAtaInstructions,
    computeUnitLimitInstruction,
    migrateInstruction,
    instructions,
  };
}

export async function getMigrationQuoteProgress({
  rpc,
  quoteVault,
  pendingQuoteFees,
  commitment = 'confirmed',
}: {
  rpc: TokenBalanceRpc;
  quoteVault: Address;
  pendingQuoteFees: bigint;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}): Promise<MigrationQuoteProgress> {
  const vaultBalance = await rpc
    .getTokenAccountBalance(quoteVault, { commitment })
    .send();
  const quoteVaultAmount = BigInt(vaultBalance.value.amount);
  if (pendingQuoteFees > quoteVaultAmount) {
    throw new Error(
      'pendingQuoteFees cannot exceed the quote vault token balance',
    );
  }

  return {
    quoteVaultAmount,
    pendingQuoteFees,
    migrationQuoteAmount: quoteVaultAmount - pendingQuoteFees,
  };
}

export async function assertMigrationQuoteThreshold({
  rpc,
  quoteVault,
  pendingQuoteFees,
  minRaiseQuote,
  commitment = 'confirmed',
}: {
  rpc: TokenBalanceRpc;
  quoteVault: Address;
  pendingQuoteFees: bigint;
  minRaiseQuote: bigint;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}): Promise<MigrationQuoteProgress> {
  const progress = await getMigrationQuoteProgress({
    rpc,
    quoteVault,
    pendingQuoteFees,
    commitment,
  });

  if (progress.migrationQuoteAmount < minRaiseQuote) {
    throw new Error(
      `Quote available for migration ${progress.migrationQuoteAmount} is below minRaiseQuote ${minRaiseQuote}`,
    );
  }

  return progress;
}
