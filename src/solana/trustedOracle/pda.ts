import {
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address,
  type ProgramDerivedAddress,
} from '@solana/kit';
import { TRUSTED_ORACLE_PROGRAM_ADDRESS } from '../generated/trustedOracle/programs/trustedOracle.js';

/**
 * Derive the OracleState PDA address.
 * Seeds: ["oracle", oracleAuthority, nonce_le_u64]
 *
 * The nonce allows a single authority to create multiple independent oracles.
 * Use Date.now() or any unique u64 value.
 */
export async function getOracleStateAddress(
  oracleAuthority: Address,
  nonce: bigint,
): Promise<ProgramDerivedAddress> {
  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, nonce, true);

  return getProgramDerivedAddress({
    programAddress: TRUSTED_ORACLE_PROGRAM_ADDRESS,
    seeds: [
      new TextEncoder().encode('oracle'),
      getAddressEncoder().encode(oracleAuthority),
      nonceBytes,
    ],
  });
}
