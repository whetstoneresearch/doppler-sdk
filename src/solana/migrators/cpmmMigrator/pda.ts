import {
  type Address,
  type ProgramDerivedAddress,
  getAddressCodec,
  getProgramDerivedAddress,
} from '@solana/kit';
import { CPMM_MIGRATOR_PROGRAM_ID, SEED_STATE } from './constants.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();

export async function getCpmmMigratorStateAddress(
  launch: Address,
  programId: Address = CPMM_MIGRATOR_PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode(SEED_STATE),
      addressCodec.encode(launch),
    ],
  });
}

