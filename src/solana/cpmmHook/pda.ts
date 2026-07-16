import {
  type Address,
  type ProgramDerivedAddress,
  getProgramDerivedAddress,
} from '@solana/kit';

import { CPMM_HOOK_PROGRAM_ID, SEED_CPMM_HOOK_CONFIG } from './constants.js';

const textEncoder = new TextEncoder();

export async function getCpmmHookConfigAddress(
  programId: Address = CPMM_HOOK_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_CPMM_HOOK_CONFIG)],
  });
}
