import { address, type Address } from '@solana/kit';

// Source of truth: programs/cpmm_migrator/src/lib.rs
export const CPMM_MIGRATOR_PROGRAM_ID: Address = address(
  'CpmmMig1111111111111111111111111111111111111'
);

export const SEED_STATE = 'state';

// Source of truth: programs/cpmm_migrator/src/constants.rs
export const MAX_RECIPIENTS = 2;

export const CPMM_MIGRATOR_INSTRUCTION_DISCRIMINATORS = {
  // SHA256("global:register_launch")[0:8]
  registerLaunch: new Uint8Array([0x72, 0x72, 0x43, 0x17, 0x29, 0x46, 0x00, 0xe1]),
  // SHA256("global:migrate")[0:8]
  migrate: new Uint8Array([0x9b, 0xea, 0xe7, 0x92, 0xec, 0x9e, 0xa2, 0x1e]),
} as const;

export const CPMM_MIGRATOR_ACCOUNT_DISCRIMINATORS = {
  // SHA256("account:CpmmMigratorState")[0:8]
  CpmmMigratorState: new Uint8Array([0xa9, 0x56, 0xff, 0xbb, 0x25, 0xf8, 0x0b, 0xb0]),
} as const;

