import {
  type Address,
  type ProgramDerivedAddress,
  getAddressCodec,
  getProgramDerivedAddress,
} from '@solana/kit';
import {
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  INITIALIZER_PROGRAM_ID,
  SEED_CONFIG,
  SEED_LAUNCH,
  SEED_LAUNCH_AUTHORITY,
} from './constants.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();

export function encodeU64LE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, value, true);
  return bytes;
}

/**
 * Derive the InitConfig PDA address.
 * Seeds: ['config_v3']
 */
export async function getConfigAddress(
  programId: Address = INITIALIZER_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_CONFIG)],
  });
}

/**
 * Derive the ProgramData PDA for an upgradeable program.
 * Seeds: [initializer_program_id] with program = BPFLoaderUpgradeable.
 */
export async function getProgramDataAddress(
  programId: Address = INITIALIZER_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
    seeds: [addressCodec.encode(programId)],
  });
}

/**
 * Derive the Launch PDA address.
 * Seeds: ['launch_v3', namespace, launch_id_bytes_32]
 */
export async function getLaunchAddress(
  namespace: Address,
  launchId: Uint8Array,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  if (launchId.length !== 32) {
    throw new Error('launchId must be 32 bytes');
  }
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode(SEED_LAUNCH),
      addressCodec.encode(namespace),
      launchId,
    ],
  });
}

/**
 * Derive the Launch authority PDA address.
 * Seeds: ['launch_authority_v3', launch]
 */
export async function getLaunchAuthorityAddress(
  launch: Address,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode(SEED_LAUNCH_AUTHORITY),
      addressCodec.encode(launch),
    ],
  });
}

/**
 * Convenience helper for the common pattern: embed a u64 into a 32-byte launch_id.
 */
export function launchIdFromU64(launchId: bigint): Uint8Array {
  const out = new Uint8Array(32);
  out.set(encodeU64LE(launchId), 0);
  return out;
}
