/**
 * Launch fetching functions for the Initializer SDK
 */

import { getAddressCodec, type Address } from '@solana/kit';
import type { ReadonlyUint8Array } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import type { GetProgramAccountsRpc } from '../../core/rpc.js';
import type { Base64EncodedBytes } from '@solana/kit';
import {
  getLaunchDecoder,
  type Launch,
} from '@whetstone-research/doppler-program-clients/initializer';
import {
  INITIALIZER_PROGRAM_ID,
  INITIALIZER_ACCOUNT_DISCRIMINATORS,
} from '../constants.js';
import { getLaunchAddress } from '../pda.js';

const addressCodec = getAddressCodec();

function bytesToBase64(bytes: ReadonlyUint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface FetchLaunchesConfig {
  programId?: Address;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface LaunchWithAddress {
  address: Address;
  account: Launch;
}

type ProgramAccount = Readonly<{
  pubkey: Address;
  account: Readonly<{ data: [string, 'base64'] }>;
}>;

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
      bytes: bytesToBase64(
        INITIALIZER_ACCOUNT_DISCRIMINATORS.Launch,
      ) as Base64EncodedBytes,
      encoding: 'base64' as const,
    },
  };

  const response = (await rpc
    .getProgramAccounts(programId, {
      encoding: 'base64',
      commitment: config?.commitment,
      filters: [discriminatorFilter],
    })
    .send()) as unknown;

  const accounts = (
    Array.isArray(response)
      ? response
      : (response as { value: ProgramAccount[] }).value
  ) as ProgramAccount[];

  const launches: LaunchWithAddress[] = [];
  const decoder = getLaunchDecoder();

  for (const account of accounts) {
    try {
      const launch = decoder.decode(base64ToBytes(account.account.data[0]));
      launches.push({ address: account.pubkey, account: launch });
    } catch {
      console.warn(`Failed to decode launch account: ${account.pubkey}`);
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
      bytes: bytesToBase64(
        INITIALIZER_ACCOUNT_DISCRIMINATORS.Launch,
      ) as Base64EncodedBytes,
      encoding: 'base64' as const,
    },
  };

  const authorityFilter = {
    memcmp: {
      offset: 8n,
      bytes: bytesToBase64(
        addressCodec.encode(authority),
      ) as Base64EncodedBytes,
      encoding: 'base64' as const,
    },
  };

  const response = (await rpc
    .getProgramAccounts(programId, {
      encoding: 'base64',
      commitment: config?.commitment,
      filters: [discriminatorFilter, authorityFilter],
    })
    .send()) as unknown;

  const accounts = (
    Array.isArray(response)
      ? response
      : (response as { value: ProgramAccount[] }).value
  ) as ProgramAccount[];

  const launches: LaunchWithAddress[] = [];
  const decoder = getLaunchDecoder();

  for (const account of accounts) {
    try {
      const launch = decoder.decode(base64ToBytes(account.account.data[0]));
      launches.push({ address: account.pubkey, account: launch });
    } catch {
      console.warn(`Failed to decode launch account: ${account.pubkey}`);
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
