import { address, type Address } from '@solana/kit';

/**
 * Program ID for the Initializer program.
 *
 * Source of truth: programs/initializer/src/lib.rs
 */
export const INITIALIZER_PROGRAM_ID: Address = address(
  '4h3Dqyo5qmteJoMxXt3tdtfXELDB6pdRTPU9mWruiKp1',
);

export const BPF_LOADER_UPGRADEABLE_PROGRAM_ID: Address = address(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);

/**
 * Sentinel program for CPMM-migrated launches.
 * Invoked during bonding curve swaps and previews as a pre/post-swap hook.
 *
 * Source of truth: programs/cpmm_sentinel/src/lib.rs
 */
export const CPMM_SENTINEL_PROGRAM_ID: Address = address(
  '2vJ1c62knEwZbxp3XdHB4RSmCfz55pA6tRkCho63gW7u',
);

/**
 * Sentinel program for prediction market launches.
 * Invoked during bonding curve swaps and previews as a pre/post-swap hook.
 *
 * Source of truth: programs/prediction_sentinel/src/lib.rs
 */
export const PREDICTION_SENTINEL_PROGRAM_ID: Address = address(
  '7QcQDANJVC17Jgc6KjjeagSkm2zAphgHVPK5agJzyihB',
);

// ============================================================================
// PDA Seeds (must match programs/initializer/src/constants.rs)
// ============================================================================

export const SEED_CONFIG = 'config_v3';
export const SEED_LAUNCH = 'launch_v3';
export const SEED_LAUNCH_AUTHORITY = 'launch_authority_v3';

// ============================================================================
// Remaining Accounts Hash
// ============================================================================

/**
 * Commitment hash for an empty remaining-accounts list — keccak256 of [0,0,0,0].
 * Pass this for sentinelRemainingAccountsHash and migratorRemainingAccountsHash
 * when no extra accounts are needed at that hook's invocation time.
 */
export const EMPTY_REMAINING_ACCOUNTS_HASH = new Uint8Array([
  232, 231, 118, 38, 88, 111, 115, 185, 85, 54, 76, 123, 75, 191, 11, 183, 247,
  104, 94, 189, 64, 232, 82, 177, 100, 99, 58, 74, 203, 211, 36, 76,
]);

// ============================================================================
// Address Lookup Tables
// ============================================================================

/**
 * Devnet ALT containing static accounts shared by every initializeLaunch tx.
 * Indices: 0=TOKEN_PROGRAM, 1=SYSTEM_PROGRAM, 2=SYSVAR_RENT,
 *          3=INITIALIZER_PROGRAM, 4=TOKEN_METADATA_PROGRAM,
 *          5=CPMM_MIGRATOR_PROGRAM, 6=WSOL_MINT, 7=config PDA
 */
export const DOPPLER_DEVNET_ALT: Address = address(
  '7r5rdLkGMzTq5Q2kBhkePw4ZTeZEooHgTXktYoamNmVq',
);

// ============================================================================
// Limits
// ============================================================================

export const MAX_MIGRATOR_ALLOWLIST = 32;
export const MAX_SENTINEL_ALLOWLIST = 32;
export const MAX_CALLDATA = 256;

// ============================================================================
// Phases / Directions / Flags (must match programs/initializer/src/constants.rs)
// ============================================================================

export const PHASE_TRADING = 0;
export const PHASE_MIGRATED = 1;
export const PHASE_ABORTED = 2;

export const DIRECTION_BUY = 0;
export const DIRECTION_SELL = 1;

export const CURVE_KIND_XYK = 0;

export const CURVE_PARAMS_FORMAT_XYK_V0 = 0x00;

export const SF_BEFORE_SWAP = 1 << 0;
export const SF_AFTER_SWAP = 1 << 1;

export const SENTINEL_NO_CHANGE = 0xffff;

// ============================================================================
// Instruction Discriminators (Anchor 8-byte hashes)
// ============================================================================

export const INITIALIZER_INSTRUCTION_DISCRIMINATORS = {
  // SHA256("global:initialize_config")[0:8]
  initializeConfig: new Uint8Array([
    0xd0, 0x7f, 0x15, 0x01, 0xc2, 0xbe, 0xc4, 0x46,
  ]),
  // SHA256("global:set_migrator_allowlist")[0:8]
  setMigratorAllowlist: new Uint8Array([
    0xd1, 0x5a, 0xb5, 0x68, 0x63, 0x6c, 0xe9, 0xa8,
  ]),
  // SHA256("global:set_sentinel_allowlist")[0:8]
  setSentinelAllowlist: new Uint8Array([
    0xe9, 0x48, 0xb4, 0xf6, 0xab, 0x75, 0x15, 0x32,
  ]),
  // SHA256("global:initialize_launch")[0:8]
  initializeLaunch: new Uint8Array([
    0x5a, 0xc9, 0xdc, 0x8e, 0x70, 0xfd, 0x64, 0x0d,
  ]),
  // SHA256("global:curve_swap_exact_in")[0:8]
  curveSwapExactIn: new Uint8Array([
    0xc4, 0xf7, 0xc3, 0x7e, 0xe3, 0x1b, 0xa6, 0x5d,
  ]),
  // SHA256("global:migrate_launch")[0:8]
  migrateLaunch: new Uint8Array([
    0x13, 0xc7, 0x77, 0x67, 0x0d, 0x1e, 0x0c, 0xcd,
  ]),
  // SHA256("global:preview_swap_exact_in")[0:8]
  previewSwapExactIn: new Uint8Array([
    0x32, 0x82, 0x1f, 0x45, 0x93, 0x3a, 0xde, 0xb2,
  ]),
  // SHA256("global:preview_migration")[0:8]
  previewMigration: new Uint8Array([
    0xd8, 0xb4, 0xd1, 0x70, 0x3e, 0x10, 0x0f, 0x3f,
  ]),
} as const;

// ============================================================================
// Account Discriminators (Anchor 8-byte hashes)
// ============================================================================

export const INITIALIZER_ACCOUNT_DISCRIMINATORS = {
  // SHA256("account:InitConfig")[0:8]
  InitConfig: new Uint8Array([0x61, 0xa6, 0x23, 0x07, 0x14, 0x02, 0xa4, 0x7e]),
  // SHA256("account:Launch")[0:8]
  Launch: new Uint8Array([0x90, 0x33, 0x33, 0xa3, 0xce, 0x55, 0xd5, 0x26]),
} as const;
