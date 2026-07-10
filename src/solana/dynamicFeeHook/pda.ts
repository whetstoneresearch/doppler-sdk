import {
  type Address,
  type ProgramDerivedAddress,
  getProgramDerivedAddress,
} from '@solana/kit';

import {
  DYNAMIC_FEE_HOOK_PROGRAM_ID,
  SEED_DYNAMIC_FEE_HOOK_CONFIG,
} from './constants.js';

const textEncoder = new TextEncoder();

export async function getDynamicFeeHookConfigAddress(
  programId: Address = DYNAMIC_FEE_HOOK_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_DYNAMIC_FEE_HOOK_CONFIG)],
  });
}
