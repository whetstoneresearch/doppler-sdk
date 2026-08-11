import {
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from '@solana/kit';

import {
  DOPPLER_LAUNCH_HOOK_V2_CONFIG_SEED,
  DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID,
} from './constants.js';

const textEncoder = new TextEncoder();

export async function getDopplerLaunchHookV2ConfigAddress(
  programId: Address = DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(DOPPLER_LAUNCH_HOOK_V2_CONFIG_SEED)],
  });
}
