/**
 * Launch fetching functions for the Initializer SDK
 */

import { getAddressCodec, type Address } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import type { GetProgramAccountsRpc } from '../../core/rpc.js';
import {
  getLaunchDecoder,
  type Launch,
} from '../../generated/initializer/index.js';
import {
  base64ToBytes,
  bytesToBase64EncodedBytes,
  normalizeProgramAccountsResponse,
  warnAccountDecodeFailure,
} from '../../core/accounts.js';
import {
  INITIALIZER_PROGRAM_ID,
  INITIALIZER_ACCOUNT_DISCRIMINATORS,
} from '../constants.js';
import { getLaunchAddress } from '../pda.js';

const addressCodec = getAddressCodec();

export interface FetchLaunchesConfig {
  programId?: Address;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface LaunchWithAddress {
  address: Address;
  account: Launch;
}

export async function fetchLaunch(
  rpc: Rpc<GetAccountInfoApi>,
  address: Address,
  config?: FetchLaunchesConfig,
): Promise<Launch | null> {
  const response = await rpc
    .getAccountInfo(address, {
      encoding: 'base64',
      commitment: config?.commitment,
    })
    .send();

  if (!response.value) {
    return null;
  }

  return getLaunchDecoder().decode(base64ToBytes(response.value.data[0]));
}

export async function fetchAllLaunches(
  rpc: GetProgramAccountsRpc,
  config?: FetchLaunchesConfig,
): Promise<LaunchWithAddress[]> {
  const programId = config?.programId ?? INITIALIZER_PROGRAM_ID;

  const discriminatorFilter = {
    memcmp: {
      offset: 0n,
      bytes: bytesToBase64EncodedBytes(
        INITIALIZER_ACCOUNT_DISCRIMINATORS.Launch,
      ),
      encoding: 'base64' as const,
    },
  };

  const response = await rpc
    .getProgramAccounts(programId, {
      encoding: 'base64',
      commitment: config?.commitment,
      filters: [discriminatorFilter],
    })
    .send();
  const accounts = normalizeProgramAccountsResponse(response);

  const launches: LaunchWithAddress[] = [];
  const decoder = getLaunchDecoder();

  for (const account of accounts) {
    try {
      const launch = decoder.decode(base64ToBytes(account.account.data[0]));
      launches.push({ address: account.pubkey, account: launch });
    } catch {
      warnAccountDecodeFailure('launch', account.pubkey);
    }
  }

  return launches;
}

/**
 * Fetch launches filtered by Launch.authority (offset 8).
 * Note: Permissionless launches have authority == Pubkey::default().
 */
export async function fetchLaunchesByAuthority(
  rpc: GetProgramAccountsRpc,
  authority: Address,
  config?: FetchLaunchesConfig,
): Promise<LaunchWithAddress[]> {
  const programId = config?.programId ?? INITIALIZER_PROGRAM_ID;

  const discriminatorFilter = {
    memcmp: {
      offset: 0n,
      bytes: bytesToBase64EncodedBytes(
        INITIALIZER_ACCOUNT_DISCRIMINATORS.Launch,
      ),
      encoding: 'base64' as const,
    },
  };

  const authorityFilter = {
    memcmp: {
      offset: 8n,
      bytes: bytesToBase64EncodedBytes(addressCodec.encode(authority)),
      encoding: 'base64' as const,
    },
  };

  const response = await rpc
    .getProgramAccounts(programId, {
      encoding: 'base64',
      commitment: config?.commitment,
      filters: [discriminatorFilter, authorityFilter],
    })
    .send();
  const accounts = normalizeProgramAccountsResponse(response);

  const launches: LaunchWithAddress[] = [];
  const decoder = getLaunchDecoder();

  for (const account of accounts) {
    try {
      const launch = decoder.decode(base64ToBytes(account.account.data[0]));
      launches.push({ address: account.pubkey, account: launch });
    } catch {
      warnAccountDecodeFailure('launch', account.pubkey);
    }
  }

  return launches;
}

export async function launchExists(
  rpc: Rpc<GetAccountInfoApi>,
  namespace: Address,
  launchId: Uint8Array,
  config?: FetchLaunchesConfig,
): Promise<boolean> {
  const programId = config?.programId ?? INITIALIZER_PROGRAM_ID;
  const [launchAddress] = await getLaunchAddress(
    namespace,
    launchId,
    programId,
  );
  const launch = await fetchLaunch(rpc, launchAddress, config);
  return launch !== null;
}
