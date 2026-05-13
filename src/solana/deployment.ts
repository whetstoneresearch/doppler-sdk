import { address, type Address } from '@solana/kit';

import {
  CPMM_PROGRAM_ID,
  getConfigAddress as getCpmmConfigAddress,
} from './core/index.js';
import {
  CPMM_HOOK_PROGRAM_ID,
  INITIALIZER_PROGRAM_ID,
  getConfigAddress as getInitializerConfigAddress,
} from './initializer/index.js';
import { COSIGNER_HOOK_PROGRAM_ID } from './cosignerHook/index.js';
import { CPMM_MIGRATOR_PROGRAM_ID } from './migrators/cpmmMigrator/index.js';

export interface SolanaCpmmProgramAddresses {
  cpmmProgram: Address;
  initializerProgram: Address;
  cpmmMigratorProgram: Address;
  cpmmHookProgram: Address;
  cosignerHookProgram: Address;
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
    cpmmHookProgram: CPMM_HOOK_PROGRAM_ID,
    cosignerHookProgram: COSIGNER_HOOK_PROGRAM_ID,
  };

export const DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES: SolanaCpmmProgramAddresses =
  {
    cpmmProgram: address('5pXzd9UiWrVxATCYWmgo5EbfxzXqHYhfSKGdCPXPz7vK'),
    initializerProgram: address('4carc9eePfE7jKUXdCAYMhcPf4awEFpZPrz1sTykdss1'),
    cpmmMigratorProgram: address(
      'H71WD4tsiCCipro4urykWHySH1ryvLTmqEdNbHTGwb3o',
    ),
    cpmmHookProgram: address('4pU2NUiPd3WFCw8vTbvyF3RSARhjMqoUejWi7eMJWp3U'),
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
