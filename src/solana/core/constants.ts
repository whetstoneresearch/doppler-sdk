import { address, type Address } from '@solana/kit';
export {
  TOKEN_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
export { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
export { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

export const TOKEN_2022_PROGRAM_ADDRESS: Address = address(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
);
export const SYSVAR_INSTRUCTIONS_ADDRESS: Address = address(
  'Sysvar1nstructions1111111111111111111111111',
);

/**
 * CPMM AMM program ID for the default devnet deployment.
 */
export const DEVNET_CPMM_PROGRAM_ID: Address = address(
  '9PSxVPoPfnbZ8Q1uQhgS6ZxvBjFboZtebNsu34umxkgQ',
);

export const MAINNET_CPMM_PROGRAM_ID: Address = address(
  '5pXzd9UiWrVxATCYWmgo5EbfxzXqHYhfSKGdCPXPz7vK',
);

/**
 * @deprecated Use DEVNET_CPMM_PROGRAM_ID or pass an explicit deployment.
 */
export const CPMM_PROGRAM_ID = DEVNET_CPMM_PROGRAM_ID;

/**
 * Metaplex Token Metadata Program ID
 */
export const TOKEN_METADATA_PROGRAM_ID: Address = address(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

// ============================================================================
// Math Constants
// ============================================================================

/** Basis points denominator (10,000 = 100%) */
export const BPS_DENOM = 10_000n;

/** Q64.64 fixed-point representation of 1.0 (2^64) */
export const Q64_ONE = 1n << 64n;

/** Current account version */
export const ACCOUNT_VERSION = 1;

// ============================================================================
// Array Size Constants
// ============================================================================

/** Maximum number of programs in hook allowlist */
export const MAX_HOOK_ALLOWLIST = 32;

/** Maximum number of oracle observations (TWAP buffer size) */
export const MAX_ORACLE_OBSERVATIONS = 64;

// ============================================================================
// PDA Seeds
// ============================================================================

/** Seed for AmmConfig PDA: ['config'] */
export const SEED_CONFIG = 'config';

/** Seed prefix for launch-migrated Pool PDA: ['pool', token0_mint, token1_mint] */
export const SEED_POOL = 'pool';

/** Seed prefix for spot Pool PDA: ['spot_pool', token0_mint, token1_mint, swap_fee_bps] */
export const SEED_SPOT_POOL = 'spot_pool';

/** Seed prefix for pool authority PDA: ['authority', pool] */
export const SEED_AUTHORITY = 'authority';

/** Seed prefix for token0 vault PDA: ['vault0', pool] */
export const SEED_VAULT0 = 'vault0';

/** Seed prefix for token1 vault PDA: ['vault1', pool] */
export const SEED_VAULT1 = 'vault1';

/** Seed prefix for Position PDA: ['position', pool, owner, position_id] */
export const SEED_POSITION = 'position';

/** Seed prefix for OracleState PDA: ['oracle', pool] */
export const SEED_ORACLE = 'oracle';

/** Seed prefix for protocol fee owner PDA: ['protocol_fee_owner', pool] */
export const SEED_PROTOCOL_FEE_OWNER = 'protocol_fee_owner';

// ============================================================================
// Hook Flags
// ============================================================================

/** Hook: called before swap */
export const HF_BEFORE_SWAP = 1 << 0;

/** Hook: called after swap */
export const HF_AFTER_SWAP = 1 << 1;

/** Hook: called before add liquidity */
export const HF_BEFORE_ADD_LIQ = 1 << 2;

/** Hook: called after add liquidity */
export const HF_AFTER_ADD_LIQ = 1 << 3;

/** Hook: called before remove liquidity */
export const HF_BEFORE_REMOVE_LIQ = 1 << 4;

/** Hook: called after remove liquidity */
export const HF_AFTER_REMOVE_LIQ = 1 << 5;

/** Require an oracle account when invoking hooks */
export const HF_REQUIRE_ORACLE = 1 << 6;

/** Preserve readonly signer metas when forwarding remaining accounts to hooks */
export const HF_FORWARD_READONLY_SIGNERS = 1 << 7;

/** Hook return value indicating "no change" to fee parameter */
export const HOOK_NO_CHANGE = 0xffff;

// ============================================================================
// Instruction Discriminators (Anchor 8-byte hashes)
// ============================================================================

/**
 * Anchor instruction discriminator (first 8 bytes of SHA256("global:<instruction_name>"))
 * These are computed at build time from the instruction names.
 */
export const INSTRUCTION_DISCRIMINATORS = {
  // SHA256("global:initialize_config")[0:8]
  initializeConfig: new Uint8Array([
    0xd0, 0x7f, 0x15, 0x01, 0xc2, 0xbe, 0xc4, 0x46,
  ]),
  // SHA256("global:initialize_pool")[0:8]
  initializePool: new Uint8Array([
    0x5f, 0xb4, 0x0a, 0xac, 0x54, 0xae, 0xe8, 0x28,
  ]),
  // SHA256("global:initialize_oracle")[0:8]
  initializeOracle: new Uint8Array([
    0x90, 0xdf, 0x83, 0x78, 0xc4, 0xfd, 0xb5, 0x63,
  ]),
  // SHA256("global:create_position")[0:8]
  createPosition: new Uint8Array([
    0x30, 0xd7, 0xc5, 0x99, 0x60, 0xcb, 0xb4, 0x85,
  ]),
  // SHA256("global:add_liquidity")[0:8]
  addLiquidity: new Uint8Array([
    0xb5, 0x9d, 0x59, 0x43, 0x8f, 0xb6, 0x34, 0x48,
  ]),
  // SHA256("global:remove_liquidity")[0:8]
  removeLiquidity: new Uint8Array([
    0x50, 0x55, 0xd1, 0x48, 0x18, 0xce, 0xb1, 0x6c,
  ]),
  // SHA256("global:swap_exact_in")[0:8]
  swapExactIn: new Uint8Array([0x68, 0x68, 0x83, 0x56, 0xa1, 0xbd, 0xb4, 0xd8]),
  // SHA256("global:collect_fees")[0:8]
  collectFees: new Uint8Array([0xa4, 0x98, 0xcf, 0x63, 0x1e, 0xba, 0x13, 0xb6]),
  // SHA256("global:collect_protocol_fees")[0:8]
  collectProtocolFees: new Uint8Array([
    0x16, 0x43, 0x17, 0x62, 0x96, 0xb2, 0x46, 0xdc,
  ]),
  // SHA256("global:close_position")[0:8]
  closePosition: new Uint8Array([
    0x7b, 0x86, 0x51, 0x00, 0x31, 0x44, 0x62, 0x62,
  ]),
  // SHA256("global:oracle_update")[0:8]
  oracleUpdate: new Uint8Array([
    0x55, 0xd1, 0xf8, 0x8e, 0xba, 0xf9, 0x78, 0xef,
  ]),
  // SHA256("global:oracle_consult")[0:8]
  oracleConsult: new Uint8Array([
    0xef, 0xed, 0xff, 0xb1, 0x8e, 0x48, 0x60, 0xaf,
  ]),
  // SHA256("global:set_hook")[0:8]
  setHook: new Uint8Array([0xaf, 0x10, 0xbb, 0xfc, 0x13, 0x36, 0x6f, 0xdd]),
  // SHA256("global:set_fees")[0:8]
  setFees: new Uint8Array([0x89, 0xb2, 0x31, 0x3a, 0x00, 0xf5, 0xf2, 0xbe]),
  // SHA256("global:transfer_admin")[0:8]
  transferAdmin: new Uint8Array([
    0x2a, 0xf2, 0x42, 0x6a, 0xe4, 0x0a, 0x6f, 0x9c,
  ]),
  // SHA256("global:pause")[0:8]
  pause: new Uint8Array([0xd3, 0x16, 0xdd, 0xfb, 0x4a, 0x79, 0xc1, 0x2f]),
  // SHA256("global:unpause")[0:8]
  unpause: new Uint8Array([0xa9, 0x90, 0x04, 0x26, 0x0a, 0x8d, 0xbc, 0xff]),
  // SHA256("global:withdraw_vault_excess")[0:8]
  withdrawVaultExcess: new Uint8Array([
    0xeb, 0xc5, 0xf7, 0xb1, 0x89, 0x48, 0x87, 0x71,
  ]),
} as const;

// ============================================================================
// Account Discriminators (Anchor 8-byte hashes)
// ============================================================================

/**
 * Anchor account discriminator (first 8 bytes of SHA256("account:<AccountName>"))
 */
export const ACCOUNT_DISCRIMINATORS = {
  // SHA256("account:AmmConfig")[0:8]
  AmmConfig: new Uint8Array([0xda, 0xf4, 0x21, 0x68, 0xcb, 0xcb, 0x2b, 0x6f]),
  // SHA256("account:Pool")[0:8]
  Pool: new Uint8Array([0xf1, 0x9a, 0x6d, 0x04, 0x11, 0xb1, 0x6d, 0xbc]),
  // SHA256("account:Position")[0:8]
  Position: new Uint8Array([0xaa, 0xbc, 0x8f, 0xe4, 0x7a, 0x40, 0xf7, 0xd0]),
  // SHA256("account:OracleState")[0:8]
  OracleState: new Uint8Array([0x61, 0x9c, 0x9d, 0xbd, 0xc2, 0x49, 0x08, 0x0f]),
} as const;
