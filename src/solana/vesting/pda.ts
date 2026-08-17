import { findAssociatedTokenPda } from '@solana-program/token';
import {
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from '@solana/kit';

import { DOPPLER_VESTING_PROGRAM_ADDRESS } from '../generated/dopplerVesting/index.js';

const VESTING_CONFIG_SEED = new TextEncoder().encode('vesting_config');

export function getVestingConfigAddress(
  launch: Address,
  baseMint: Address,
  programId: Address = DOPPLER_VESTING_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  const addressEncoder = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      VESTING_CONFIG_SEED,
      addressEncoder.encode(launch),
      addressEncoder.encode(baseMint),
    ],
  });
}

export function getVestingVaultAddress(
  vestingConfig: Address,
  baseMint: Address,
  baseTokenProgram: Address,
): Promise<ProgramDerivedAddress> {
  return findAssociatedTokenPda({
    owner: vestingConfig,
    mint: baseMint,
    tokenProgram: baseTokenProgram,
  });
}

export function getVestingBeneficiaryTokenAccountAddress(
  beneficiary: Address,
  baseMint: Address,
  baseTokenProgram: Address,
): Promise<ProgramDerivedAddress> {
  return findAssociatedTokenPda({
    owner: beneficiary,
    mint: baseMint,
    tokenProgram: baseTokenProgram,
  });
}

export type VestingAddresses = {
  config: Address;
  vault: Address;
};

export async function deriveVestingAddresses(
  launch: Address,
  baseMint: Address,
  baseTokenProgram: Address,
  programId: Address = DOPPLER_VESTING_PROGRAM_ADDRESS,
): Promise<VestingAddresses> {
  const [config] = await getVestingConfigAddress(launch, baseMint, programId);
  const [vault] = await getVestingVaultAddress(
    config,
    baseMint,
    baseTokenProgram,
  );
  return { config, vault };
}
