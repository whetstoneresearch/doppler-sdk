import { type Address } from '@solana/kit';

import {
  DEVNET_CPMM_PROGRAM_ID,
  MAINNET_CPMM_PROGRAM_ID,
  getConfigAddress as getCpmmConfigAddress,
} from './core/index.js';
import {
  DEVNET_INITIALIZER_PROGRAM_ID,
  MAINNET_INITIALIZER_PROGRAM_ID,
  getConfigAddress as getInitializerConfigAddress,
} from './initializer/index.js';
import {
  DEVNET_CPMM_HOOK_PROGRAM_ID,
  MAINNET_CPMM_HOOK_PROGRAM_ID,
} from './cpmmHook/index.js';
import {
  DEVNET_CPMM_MIGRATOR_PROGRAM_ID,
  MAINNET_CPMM_MIGRATOR_PROGRAM_ID,
} from './migrators/cpmmMigrator/index.js';

export interface SolanaCpmmProgramAddresses {
  cpmmProgram: Address;
  initializerProgram: Address;
  cpmmMigratorProgram: Address;
  cpmmHookProgram: Address;
}

export interface SolanaCpmmDeployment extends SolanaCpmmProgramAddresses {
  cpmmConfig: Address;
  initializerConfig: Address;
}

export const DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES: SolanaCpmmProgramAddresses =
  {
    cpmmProgram: DEVNET_CPMM_PROGRAM_ID,
    initializerProgram: DEVNET_INITIALIZER_PROGRAM_ID,
    cpmmMigratorProgram: DEVNET_CPMM_MIGRATOR_PROGRAM_ID,
    cpmmHookProgram: DEVNET_CPMM_HOOK_PROGRAM_ID,
  };

export const DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES: SolanaCpmmProgramAddresses =
  {
    cpmmProgram: MAINNET_CPMM_PROGRAM_ID,
    initializerProgram: MAINNET_INITIALIZER_PROGRAM_ID,
    cpmmMigratorProgram: MAINNET_CPMM_MIGRATOR_PROGRAM_ID,
    cpmmHookProgram: MAINNET_CPMM_HOOK_PROGRAM_ID,
  };

export async function deriveSolanaCpmmDeployment(
  programs: SolanaCpmmProgramAddresses = DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES,
): Promise<SolanaCpmmDeployment> {
  const [cpmmConfig] = await getCpmmConfigAddress(programs.cpmmProgram);
  const [initializerConfig] = await getInitializerConfigAddress(
    programs.initializerProgram,
  );

  return {
    ...programs,
    cpmmConfig,
    initializerConfig,
  };
}
