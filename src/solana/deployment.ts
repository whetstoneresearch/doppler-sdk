import { address, type Address } from '@solana/kit';

import {
  CPMM_PROGRAM_ID,
  getConfigAddress as getCpmmConfigAddress,
} from './core/index.js';
import {
  INITIALIZER_PROGRAM_ID,
  getConfigAddress as getInitializerConfigAddress,
} from './initializer/index.js';
import { DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID } from './dopplerLaunchHookV1/index.js';
import { CPMM_MIGRATOR_PROGRAM_ID } from './migrators/cpmmMigrator/index.js';

export interface SolanaCpmmProgramAddresses {
  cpmmProgram: Address;
  initializerProgram: Address;
  cpmmMigratorProgram: Address;
  dopplerLaunchHookV1Program: Address;
}

export interface SolanaCpmmDeployment extends SolanaCpmmProgramAddresses {
  cpmmConfig: Address;
  initializerConfig: Address;
}

export const DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES: SolanaCpmmProgramAddresses =
  {
    cpmmProgram: CPMM_PROGRAM_ID,
    initializerProgram: INITIALIZER_PROGRAM_ID,
    cpmmMigratorProgram: CPMM_MIGRATOR_PROGRAM_ID,
    dopplerLaunchHookV1Program: DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID,
  };

export const DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES: SolanaCpmmProgramAddresses =
  {
    cpmmProgram: address('5pXzd9UiWrVxATCYWmgo5EbfxzXqHYhfSKGdCPXPz7vK'),
    initializerProgram: address('4carc9eePfE7jKUXdCAYMhcPf4awEFpZPrz1sTykdss1'),
    cpmmMigratorProgram: address(
      'H71WD4tsiCCipro4urykWHySH1ryvLTmqEdNbHTGwb3o',
    ),
    dopplerLaunchHookV1Program: address(
      'BeyqffXEVgLpM3fQ1zjk8YnZzQN9sMVrCKtNKwSxNATr',
    ),
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
