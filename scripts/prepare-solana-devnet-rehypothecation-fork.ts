#!/usr/bin/env npx tsx
import { writeFileSync } from 'node:fs';

import { address } from '@solana/kit';

import {
  DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
  deriveSolanaFeeRehypothecationDeployment,
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
  const programs = DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES;
  const deployment = await deriveSolanaFeeRehypothecationDeployment(programs);

  writeFileSync(
    output,
    `${JSON.stringify(
      {
        programs: { ...programs, tokenMetadataProgram: TOKEN_METADATA_PROGRAM },
        accounts: {
          initializerConfig: deployment.initializerConfig,
          dopplerLaunchHookV2Config: deployment.dopplerLaunchHookV2Config,
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
