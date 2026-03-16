/**
 * Config fetching and utilities for the CPMM SDK
 */

import type { Address } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import type { AmmConfig } from '../core/types.js';
import { decodeAmmConfig } from '../core/codecs.js';
import { PROGRAM_ID } from '../core/constants.js';
import { getConfigAddress } from '../core/pda.js';

// Browser-compatible base64 decoding
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch and decode the AmmConfig account
 *
 * @param rpc - Solana RPC client
 * @param programId - Program ID (defaults to CPMM program)
 * @param commitment - Optional commitment level
 * @returns Decoded config data or null if not found
 */
export async function fetchConfig(
  rpc: Rpc<GetAccountInfoApi>,
  programId: Address = PROGRAM_ID,
  commitment?: 'processed' | 'confirmed' | 'finalized',
): Promise<AmmConfig | null> {
  const [configAddress] = await getConfigAddress(programId);
  const response = await rpc.getAccountInfo(configAddress, {
    encoding: 'base64',
    commitment,
  }).send();

  if (!response.value) {
    return null;
  }

  return decodeAmmConfig(base64ToBytes(response.value.data[0]));
}

/**
 * Fetch config with its PDA address
 */
export async function fetchConfigWithAddress(
  rpc: Rpc<GetAccountInfoApi>,
  programId: Address = PROGRAM_ID,
  commitment?: 'processed' | 'confirmed' | 'finalized',
): Promise<{ address: Address; account: AmmConfig } | null> {
  const [configAddress] = await getConfigAddress(programId);
  const account = await fetchConfig(rpc, programId, commitment);
  if (!account) {
    return null;
  }
  return { address: configAddress, account };
}
