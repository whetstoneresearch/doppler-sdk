import type { Address } from '@solana/kit';
import {
  getAddressFromAddressOrSigner,
  type AddressOrTransactionSigner,
} from '../core/accounts.js';
import { getBaseVaultAddress, getQuoteVaultAddress } from './pda.js';

/** Resolve new-launch vaults without silently falling back to keypair addresses. */
export async function resolveLaunchVaults({
  launch,
  programId,
  baseVault,
  quoteVault,
  vaultMode = 'deterministic',
}: {
  launch: Address;
  programId: Address;
  baseVault?: AddressOrTransactionSigner;
  quoteVault?: AddressOrTransactionSigner;
  vaultMode?: 'legacy' | 'deterministic';
}): Promise<{ baseVault: Address; quoteVault: Address }> {
  const suppliedBase = baseVault && getAddressFromAddressOrSigner(baseVault);
  const suppliedQuote = quoteVault && getAddressFromAddressOrSigner(quoteVault);
  if (vaultMode === 'legacy') {
    if (!suppliedBase || !suppliedQuote) {
      throw new Error(
        'Legacy launches require baseVault and quoteVault signers',
      );
    }
    return { baseVault: suppliedBase, quoteVault: suppliedQuote };
  }
  const [[canonicalBase], [canonicalQuote]] = await Promise.all([
    getBaseVaultAddress(launch, programId),
    getQuoteVaultAddress(launch, programId),
  ]);
  if (
    (suppliedBase && suppliedBase !== canonicalBase) ||
    (suppliedQuote && suppliedQuote !== canonicalQuote)
  ) {
    throw new Error(
      'V2 vaults must match the canonical launch vault PDAs. Omit baseVault and quoteVault to derive them, or select legacy mode for keypair vaults.',
    );
  }
  return { baseVault: canonicalBase, quoteVault: canonicalQuote };
}
