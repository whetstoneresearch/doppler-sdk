import { address, type Address } from '@solana/kit';

// Source of truth: programs/cpmm_migrator/src/lib.rs
export const DEVNET_CPMM_MIGRATOR_PROGRAM_ID: Address = address(
  '7WMUTNC41eMCo6eGH5Sy2xbgE3AycvLbFPo95AU9CSUd',
);

export const MAINNET_CPMM_MIGRATOR_PROGRAM_ID: Address = address(
  'H71WD4tsiCCipro4urykWHySH1ryvLTmqEdNbHTGwb3o',
);

export const CPMM_MIGRATOR_PROGRAM_ID = DEVNET_CPMM_MIGRATOR_PROGRAM_ID;

export const SEED_STATE = 'state';
export const SEED_MIGRATION_AUTHORITY = 'migration_authority';

// Source of truth: programs/cpmm_migrator/src/constants.rs
export const MAX_RECIPIENTS = 2;

export const CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS = {
  // SHA256("global:create_spot_pool")[0:8]
  createSpotPool: new Uint8Array([
    0x0d, 0x89, 0x10, 0x1a, 0x28, 0x24, 0x6e, 0x1a,
  ]),
  // SHA256("global:register_launch")[0:8]
  registerLaunch: new Uint8Array([
    0x72, 0x72, 0x43, 0x17, 0x29, 0x46, 0x00, 0xe1,
  ]),
  // SHA256("global:migrate")[0:8]
  migrate: new Uint8Array([0x9b, 0xea, 0xe7, 0x92, 0xec, 0x9e, 0xa2, 0x1e]),
} as const;

export const CPMM_MIGRATOR_ACCOUNT_DISCRIMINATORS = {
  // SHA256("account:CpmmMigratorState")[0:8]
  CpmmMigratorState: new Uint8Array([
    0xa9, 0x56, 0xff, 0xbb, 0x25, 0xf8, 0x0b, 0xb0,
  ]),
} as const;
