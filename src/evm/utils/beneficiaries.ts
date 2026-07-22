import { isAddress, zeroAddress, type Address } from 'viem';
import { WAD } from '../constants';

/**
 * Sort beneficiaries by address (ascending) as required by the pool contract,
 * rejecting duplicate addresses up-front.
 *
 * The pool/migrator contracts enforce strictly ascending beneficiary addresses
 * and revert with `UnorderedBeneficiaries()` when two entries share an address.
 * Two equal addresses are not strictly ascending, so the transaction reverts and
 * the integrator only finds out after spending gas, with an opaque error.
 *
 * Catching the duplicate here — at the encode layer that every create/migration
 * path funnels through — surfaces a readable error before the transaction is
 * broadcast. Address comparison is case-insensitive, so the same address supplied
 * with different checksum casing is also caught.
 *
 * Generic over the beneficiary shape so it can be reused across the differently
 * typed beneficiary lists (pool initializer, streamable fees, doppler hook).
 */
export function sortBeneficiaries<T extends { beneficiary: Address }>(
  beneficiaries: readonly T[],
): T[] {
  const sorted = [...beneficiaries].sort((a, b) => {
    const aAddr = a.beneficiary.toLowerCase();
    const bAddr = b.beneficiary.toLowerCase();
    return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
  });

  for (let i = 1; i < sorted.length; i++) {
    if (
      sorted[i].beneficiary.toLowerCase() ===
      sorted[i - 1].beneficiary.toLowerCase()
    ) {
      throw new Error(
        `Duplicate beneficiary address: ${sorted[i].beneficiary}. ` +
          'Each beneficiary address must be unique — the contract requires ' +
          'strictly ascending addresses and reverts with ' +
          'UnorderedBeneficiaries() otherwise. Merge the entries into a ' +
          'single beneficiary with the combined shares.',
      );
    }
  }

  return sorted;
}

export function normalizeBeneficiaries<
  T extends { beneficiary: Address; shares: bigint },
>(beneficiaries: readonly T[], label: string): [T, ...T[]] {
  const sorted = sortBeneficiaries(beneficiaries);
  if (!isNonEmpty(sorted)) {
    throw new Error(`${label} list must not be empty`);
  }

  let totalShares = 0n;

  for (const beneficiary of sorted) {
    if (!isAddress(beneficiary.beneficiary, { strict: false })) {
      throw new Error(
        `${label} address is invalid: ${beneficiary.beneficiary}`,
      );
    }
    if (beneficiary.beneficiary.toLowerCase() === zeroAddress) {
      throw new Error(`${label} address cannot be the zero address`);
    }
    if (beneficiary.shares <= 0n) {
      throw new Error(`${label} shares must be positive`);
    }
    totalShares += beneficiary.shares;
  }

  if (totalShares !== WAD) {
    throw new Error(
      `${label} shares must sum to ${WAD} (100%), but got ${totalShares}`,
    );
  }

  return sorted;
}

function isNonEmpty<T>(values: T[]): values is [T, ...T[]] {
  return values.length > 0;
}
