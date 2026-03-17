import { mergeBytes } from '@solana/kit';
import {
  getRegisterLaunchArgsEncoder,
  getMigrateArgsEncoder,
  type RegisterLaunchArgsArgs,
  type MigrateArgsArgs,
} from '../../generated/cpmmMigrator/index.js';
import { CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS } from './constants.js';

export {
  CPMM_MIGRATOR_PROGRAM_ID,
  SEED_STATE,
  MAX_RECIPIENTS,
  CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS,
  CPMM_MIGRATOR_ACCOUNT_DISCRIMINATORS,
} from './constants.js';

export type {
  Recipient,
  RecipientArgs,
  RegisterLaunchArgs,
  RegisterLaunchArgsArgs,
  MigrateArgs,
  MigrateArgsArgs,
  CpmmMigratorState,
  CpmmMigratorStateArgs,
} from '../../generated/cpmmMigrator/index.js';

export {
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

export { getCpmmMigratorStateAddress } from './pda.js';

export { fetchCpmmMigratorState } from './client.js';

export function encodeRegisterLaunchCalldata(
  args: RegisterLaunchArgsArgs,
): Uint8Array {
  const encoded = new Uint8Array(getRegisterLaunchArgsEncoder().encode(args));
  return mergeBytes([
    CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.registerLaunch,
    encoded,
  ]);
}

export function encodeMigrateCalldata(args: MigrateArgsArgs): Uint8Array {
  const encoded = new Uint8Array(getMigrateArgsEncoder().encode(args));
  return mergeBytes([
    CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS.migrate,
    encoded,
  ]);
}
