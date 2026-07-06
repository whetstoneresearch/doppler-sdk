import type { Address } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import { base64ToBytes } from '../../core/accounts.js';
import {
  getCpmmMigratorStateDecoder,
  type CpmmMigratorState,
} from '../../generated/cpmmMigrator/index.js';

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
