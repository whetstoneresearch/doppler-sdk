import {
  getAddressCodec,
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from '@solana/kit';
import { TOKEN_METADATA_PROGRAM_ID } from './constants.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();

/**
 * Derive Metaplex Token Metadata PDA for a given mint.
 *
 * Seeds: ['metadata', token_metadata_program_id, mint]
 */
export async function getMetadataAddress(
  mint: Address,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ID,
    seeds: [
      textEncoder.encode('metadata'),
      addressCodec.encode(TOKEN_METADATA_PROGRAM_ID),
      addressCodec.encode(mint),
    ],
  });
}

