import { mergeBytes } from '@solana/kit';
import {
  getRegisterLaunchArgsEncoder,
  getMigrateArgsEncoder,
  getCreateSpotPoolArgsEncoder,
  type RegisterLaunchArgsArgs,
  type MigrateArgsArgs,
  type CreateSpotPoolArgsArgs,
} from '../../generated/cpmmMigrator/index.js';
import { CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS } from './constants.js';
import { assertSafeInteger } from './spotPool.js';

export {
  CPMM_MIGRATOR_PROGRAM_ID,
  SEED_STATE,
  SEED_MIGRATION_AUTHORITY,
  MAX_RECIPIENTS,
  CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS,
  CPMM_MIGRATOR_ACCOUNT_DISCRIMINATORS,
} from './constants.js';

export type {
  Recipient,
  RecipientArgs,
  RegisterLaunchArgs,
  RegisterLaunchArgsArgs,
  MigratedPoolHookConfig,
  MigratedPoolHookConfigArgs,
  MigrateArgs,
  MigrateArgsArgs,
  CreateSpotPoolArgs,
  CreateSpotPoolArgsArgs,
  CpmmMigratorState,
  CpmmMigratorStateArgs,
  SpotPoolCreated,
  SpotPoolCreatedArgs,
} from '../../generated/cpmmMigrator/index.js';

export {
  getCreateSpotPoolInstruction,
  getCreateSpotPoolInstructionAsync,
  getCreateSpotPoolInstructionDataEncoder,
  getCreateSpotPoolInstructionDataDecoder,
  getCreateSpotPoolInstructionDataCodec,
  getCreateSpotPoolArgsEncoder,
  getCreateSpotPoolArgsDecoder,
  getCreateSpotPoolArgsCodec,
  getRecipientEncoder,
  getRecipientDecoder,
  getRecipientCodec,
  getRegisterLaunchArgsEncoder,
  getRegisterLaunchArgsDecoder,
  getRegisterLaunchArgsCodec,
  getMigrateArgsEncoder,
  getMigrateArgsDecoder,
  getMigrateArgsCodec,
  getCpmmMigratorStateEncoder,
  getCpmmMigratorStateDecoder,
  getCpmmMigratorStateCodec,
} from '../../generated/cpmmMigrator/index.js';

export {
  getCpmmMigrationAuthorityAddress,
  getCpmmMigratorStateAddress,
} from './pda.js';

export { fetchCpmmMigratorState } from './client.js';
export {
  deriveSpotPoolAccounts,
  createSpotPoolInstruction,
  type DeriveSpotPoolAccountsInput,
  type SpotPoolAccounts,
  type AddressOrSigner,
  type CreateSpotPoolInstruction,
  type CreateSpotPoolInstructionInput,
} from './spotPool.js';

export {
  buildCpmmMigrationRemainingAccounts,
  buildCpmmMigrationRemainingAccountsHash,
  type CpmmMigrationRemainingAccounts,
  type CpmmMigrationRemainingAccountsInput,
} from './remainingAccounts.js';

export type RegisterLaunchPayloadArgs = Omit<
  RegisterLaunchArgsArgs,
  'migratedPoolHookConfig'
> &
  Partial<Pick<RegisterLaunchArgsArgs, 'migratedPoolHookConfig'>>;

export function encodeCreateSpotPoolPayload(
  args: CreateSpotPoolArgsArgs,
): Uint8Array {
  assertSafeInteger('positionId', args.positionId);
  assertSafeInteger('amount0Max', args.amount0Max);
  assertSafeInteger('amount1Max', args.amount1Max);
  assertSafeInteger('minSharesOut', args.minSharesOut);
  const encoded = new Uint8Array(getCreateSpotPoolArgsEncoder().encode(args));
  return mergeBytes([
    CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.createSpotPool,
    encoded,
  ]);
}

export function encodeRegisterLaunchPayload(
  args: RegisterLaunchPayloadArgs,
): Uint8Array {
  const encoded = new Uint8Array(
    getRegisterLaunchArgsEncoder().encode({
      ...args,
      migratedPoolHookConfig: args.migratedPoolHookConfig ?? null,
    }),
  );
  return mergeBytes([
    CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.registerLaunch,
    encoded,
  ]);
}

export function encodeMigratePayload(args: MigrateArgsArgs): Uint8Array {
  const encoded = new Uint8Array(getMigrateArgsEncoder().encode(args));
  return mergeBytes([
    CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.migrate,
    encoded,
  ]);
}
