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
 * Hook program for CPMM-migrated launches.
 * Invoked during bonding curve swaps and previews as a pre/post-swap hook.
 *
 * Source of truth: programs/cpmm_hook/src/lib.rs
 */
export const CPMM_HOOK_PROGRAM_ID: Address = address(
  '2vJ1c62knEwZbxp3XdHB4RSmCfz55pA6tRkCho63gW7u',
);

/**
 * Hook program for prediction market launches.
 * Invoked during bonding curve swaps and previews as a pre/post-swap hook.
 *
 * Source of truth: programs/prediction_hook/src/lib.rs
 */
export const PREDICTION_HOOK_PROGRAM_ID: Address = address(
  '7QcQDANJVC17Jgc6KjjeagSkm2zAphgHVPK5agJzyihB',
);

// ============================================================================
// PDA Seeds (must match programs/initializer/src/constants.rs)
// ============================================================================

export const SEED_CONFIG = 'config';
export const SEED_LAUNCH = 'launch';
export const SEED_LAUNCH_AUTHORITY = 'launch_authority';
export const SEED_LAUNCH_FEE_STATE = 'launch_fee_state';

// ============================================================================
// Remaining Accounts Hash
// ============================================================================

/**
 * Commitment hash for an empty remaining-accounts list — keccak256 of [0,0,0,0].
 * Pass this for hookRemainingAccountsHash and migratorRemainingAccountsHash
 * when no extra accounts are needed at that hook's invocation time.
 */
export const EMPTY_REMAINING_ACCOUNTS_HASH = new Uint8Array([
  232, 231, 118, 38, 88, 111, 115, 185, 85, 54, 76, 123, 75, 191, 11, 183, 247,
  104, 94, 189, 64, 232, 82, 177, 100, 99, 58, 74, 203, 211, 36, 76,
]);

// ============================================================================
// Limits
// ============================================================================

export const MAX_MIGRATOR_ALLOWLIST = 32;
export const MAX_HOOK_ALLOWLIST = 32;
export const MAX_PAYLOAD = 256;

// ============================================================================
// Phases / Directions / Flags (must match programs/initializer/src/constants.rs)
// ============================================================================

export const PHASE_TRADING = 0;
export const PHASE_MIGRATED = 1;
export const PHASE_ABORTED = 2;

export const TRADE_DIRECTION_BUY = 0;
export const TRADE_DIRECTION_SELL = 1;

export const CURVE_KIND_XYK = 0;

export const CURVE_PARAMS_FORMAT_XYK_V0 = 0x00;

export const HF_BEFORE_SWAP = 1 << 0;
export const HF_AFTER_SWAP = 1 << 1;
export const HF_BEFORE_CREATE = 1 << 2;
export const HF_AFTER_CREATE = 1 << 3;
export const HF_BEFORE_MIGRATE = 1 << 4;
export const HF_AFTER_MIGRATE = 1 << 5;
export const HF_FORWARD_READONLY_SIGNERS = 1 << 6;

export const HOOK_NO_CHANGE = 0xffff;

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
  // SHA256("global:set_hook_allowlist")[0:8]
  setHookAllowlist: new Uint8Array([
    0xe8, 0x1c, 0x28, 0x8f, 0x79, 0xb6, 0x4d, 0x67,
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
  // SHA256("account:LaunchFeeState")[0:8]
  LaunchFeeState: new Uint8Array([
    0x01, 0x6a, 0x37, 0xf1, 0xb3, 0x12, 0xe6, 0xe8,
  ]),
} as const;
