import type { Address } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import {
  getCpmmMigratorStateDecoder,
  type CpmmMigratorState,
} from '../../generated/cpmmMigrator/accounts/cpmmMigratorState.js';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function fetchCpmmMigratorState(
  rpc: Rpc<GetAccountInfoApi>,
  address: Address,
): Promise<CpmmMigratorState | null> {
  const response = await rpc
    .getAccountInfo(address, { encoding: 'base64' })
    .send();
  if (!response.value) return null;
  return getCpmmMigratorStateDecoder().decode(
    base64ToBytes(response.value.data[0]),
  );
}
