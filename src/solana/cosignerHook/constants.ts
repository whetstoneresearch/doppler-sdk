import { COSIGNER_HOOK_PROGRAM_ADDRESS } from '../generated/cosignerHook/programs/index.js';

export const COSIGNER_HOOK_PROGRAM_ID = COSIGNER_HOOK_PROGRAM_ADDRESS;

export const SEED_COSIGNER_HOOK_CONFIG = 'cosigner_hook_config';
export const MAX_COSIGNERS = 32;
export const GATE_EXPIRY_DISABLED = 0;
export const GATE_EXPIRY_UNIX_TIMESTAMP = 1;
export const GATE_EXPIRY_SLOT = 2;
export const GATE_EXPIRY_PAYLOAD_VERSION = 1;
export const GATE_EXPIRY_HEADER_LEN = 10;
export const GATE_EXPIRY_PAYLOAD_LEN = 42;
