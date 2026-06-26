import { address, type Address } from '@solana/kit';

/**
 * Default Doppler native cosigner hook program for devnet deployments.
 *
 * The generated COSIGNER_HOOK_PROGRAM_ADDRESS reflects the IDL's generic
 * cosigner hook deployment. Pass an explicit programAddress to generated
 * instructions when targeting a custom/integrator hook deployment.
 */
export const DOPPLER_NATIVE_COSIGNER_HOOK_PROGRAM_ID: Address = address(
  '5iWYdN9SEDeF3FTjKB48XYyCFAcVDuYHsz31Z4Wmq7Ch',
);

export const COSIGNER_HOOK_PROGRAM_ID = DOPPLER_NATIVE_COSIGNER_HOOK_PROGRAM_ID;

export const SEED_COSIGNER_HOOK_CONFIG = 'cosigner_hook_config';
export const MAX_COSIGNERS = 32;
export const GATE_EXPIRY_DISABLED = 0;
export const GATE_EXPIRY_UNIX_TIMESTAMP = 1;
export const GATE_EXPIRY_SLOT = 2;
export const GATE_EXPIRY_PAYLOAD_VERSION = 1;
export const GATE_EXPIRY_HEADER_LEN = 10;
export const GATE_EXPIRY_PAYLOAD_LEN = 42;
