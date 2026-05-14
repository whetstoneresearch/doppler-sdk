import {
  type Address,
  type ProgramDerivedAddress,
  getProgramDerivedAddress,
} from '@solana/kit';

import {
  COSIGNER_HOOK_PROGRAM_ID,
  SEED_COSIGNER_HOOK_CONFIG,
} from './constants.js';

const textEncoder = new TextEncoder();

export async function getCosignerHookConfigAddress(
  programId: Address = COSIGNER_HOOK_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_COSIGNER_HOOK_CONFIG)],
  });
}
