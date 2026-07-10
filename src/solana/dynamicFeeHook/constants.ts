import { address, type Address } from '@solana/kit';

/**
 * Default Doppler dynamic fee hook program for devnet deployments.
 */
export const DEVNET_DYNAMIC_FEE_HOOK_PROGRAM_ID: Address = address(
  'HVsPNZh98TgChUXHwKrUG47SUqvGQHxUy5wZwcQLFD4i',
);

export const DYNAMIC_FEE_HOOK_PROGRAM_ID = DEVNET_DYNAMIC_FEE_HOOK_PROGRAM_ID;

export const SEED_DYNAMIC_FEE_HOOK_CONFIG = 'cosigner_hook_config';
export const MAX_COSIGNERS = 32;

export const DYNAMIC_FEE_SCHEDULE_MAGIC = new Uint8Array([
  0x44, 0x46, 0x45, 0x45, 0x56, 0x31, 0x5f, 0x5f,
]);
export const DYNAMIC_FEE_SCHEDULE_VERSION = 1;
export const DYNAMIC_FEE_SCHEDULE_LEN = 32;
export const DYNAMIC_FEE_SCHEDULE_HEADER_LEN = 16;
export const DYNAMIC_FEE_SCHEDULE_MAX_BPS = 10_000;
