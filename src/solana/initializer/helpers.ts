import { getAddressEncoder, type Address } from '@solana/kit';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { PHASE_TRADING, PHASE_MIGRATED, PHASE_ABORTED } from './constants.js';

/**
 * Compute the remaining-accounts commitment hash used by the Initializer program.
 *
 * Algorithm: keccak256(u32_len_le || pubkey_0 || ... || pubkey_n)
 *
 * This matches compute_remaining_accounts_hash in
 * programs/initializer/src/instructions/launch_common.rs.
 *
 * Commit the result as sentinelRemainingAccountsHash or migratorRemainingAccountsHash
 * when calling initializeLaunch. At migrate_launch (or sentinel invoke) time, pass the
 * same accounts in the same order as remaining accounts — the program verifies they match.
 *
 * For an empty account list use EMPTY_REMAINING_ACCOUNTS_HASH instead.
 */
export function computeRemainingAccountsHash(addresses: Address[]): Uint8Array {
  const addressEncoder = getAddressEncoder();
  // 4-byte LE count followed by 32 bytes per pubkey
  const buf = new Uint8Array(4 + addresses.length * 32);
  new DataView(buf.buffer).setUint32(0, addresses.length, true);
  for (let i = 0; i < addresses.length; i++) {
    buf.set(addressEncoder.encode(addresses[i]), 4 + i * 32);
  }
  return keccak_256(buf);
}

/**
 * Returns a human-readable label for a launch phase value.
 * Falls back to the numeric string for any unrecognised phase.
 */
export function phaseLabel(phase: number): string {
  switch (phase) {
    case PHASE_TRADING:
      return 'TRADING';
    case PHASE_MIGRATED:
      return 'MIGRATED';
    case PHASE_ABORTED:
      return 'ABORTED';
    default:
      return String(phase);
  }
}
