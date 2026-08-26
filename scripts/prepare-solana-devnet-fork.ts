#!/usr/bin/env npx tsx
import { writeFileSync } from 'node:fs';

import { address } from '@solana/kit';

import {
  DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
  DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES,
  deriveSolanaCpmmDeployment,
  deriveSolanaFeeRehypothecationDeployment,
  vesting,
} from '../src/solana/index.js';

const TOKEN_METADATA_PROGRAM = address(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

function requireArgument(name: string): string {
  const option = `--${name}`;
  const index = process.argv.indexOf(option);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} is required`);
  }
  return value;
}

async function main(): Promise<void> {
  const output = requireArgument('manifest-output');
  const cpmmPrograms = DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES;
  const feePrograms =
    DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES;
  if (cpmmPrograms.initializerProgram !== feePrograms.initializerProgram) {
    throw new Error(
      'Devnet examples require one shared Initializer deployment',
    );
  }

  const cpmmDeployment = await deriveSolanaCpmmDeployment(cpmmPrograms);
  const feeDeployment =
    await deriveSolanaFeeRehypothecationDeployment(feePrograms);

  writeFileSync(
    output,
    `${JSON.stringify(
      {
        programs: {
          ...cpmmPrograms,
          dopplerLaunchHookV2Program: feePrograms.dopplerLaunchHookV2Program,
          dopplerRehypeRouterV1Program:
            feePrograms.dopplerRehypeRouterV1Program,
          dopplerVestingProgram: vesting.DOPPLER_VESTING_PROGRAM_ADDRESS,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM,
        },
        accounts: {
          cpmmConfig: cpmmDeployment.cpmmConfig,
          initializerConfig: cpmmDeployment.initializerConfig,
          dopplerLaunchHookV2Config: feeDeployment.dopplerLaunchHookV2Config,
        },
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
