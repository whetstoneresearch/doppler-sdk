import {
  type Address,
  type ProgramDerivedAddress,
  getProgramDerivedAddress,
} from '@solana/kit';

import {
  DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID,
  SEED_DOPPLER_LAUNCH_HOOK_V1_CONFIG,
} from './constants.js';

const textEncoder = new TextEncoder();

export async function getDopplerLaunchHookV1ConfigAddress(
  programId: Address = DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_DOPPLER_LAUNCH_HOOK_V1_CONFIG)],
  });
}
