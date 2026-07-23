#!/usr/bin/env npx tsx
import { writeFileSync } from 'node:fs';

import { address, createSolanaRpc, type Address } from '@solana/kit';

import {
  DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES,
  deriveSolanaCpmmDeployment,
  dopplerLaunchHookV1,
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
  const rpcUrl = requireArgument('rpc-url');
  const cosigner = address(requireArgument('cosigner'));
  const accountOutputPath = requireArgument('account-output');
  const manifestOutputPath = requireArgument('manifest-output');
  const rpc = createSolanaRpc(rpcUrl);
  const programs = DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES;
  const deployment = await deriveSolanaCpmmDeployment(programs);
  const [hookConfig, expectedBump] =
    await dopplerLaunchHookV1.getDopplerLaunchHookV1ConfigAddress(
      programs.dopplerLaunchHookV1Program,
    );
  const response = await rpc
    .getAccountInfo(hookConfig, {
      commitment: 'finalized',
      encoding: 'base64',
    })
    .send();
  const account = response.value;

  if (!account) {
    throw new Error(`Mainnet hook config ${hookConfig} was not found`);
  }
  if (account.owner !== programs.dopplerLaunchHookV1Program) {
    throw new Error(
      `Mainnet hook config ${hookConfig} has unexpected owner ${account.owner}`,
    );
  }

  const currentConfig = dopplerLaunchHookV1
    .getCosignerConfigDecoder()
    .decode(Buffer.from(account.data[0], 'base64'));
  if (currentConfig.bump !== expectedBump) {
    throw new Error(
      `Mainnet hook config ${hookConfig} has bump ${currentConfig.bump}, expected ${expectedBump}`,
    );
  }

  const forkCosigners: Address[] = [
    cosigner,
    ...currentConfig.cosigners.slice(1),
  ];
  const encodedConfig = dopplerLaunchHookV1.getCosignerConfigEncoder().encode({
    adminAuthority: currentConfig.adminAuthority,
    cosignerCount: 1,
    bump: currentConfig.bump,
    version: currentConfig.version,
    reserved: currentConfig.reserved,
    cosigners: forkCosigners,
  });
  const accountFixture = {
    pubkey: hookConfig,
    account: {
      lamports: Number(account.lamports),
      data: [Buffer.from(encodedConfig).toString('base64'), 'base64'],
      owner: account.owner,
      executable: account.executable,
      rentEpoch: 0,
      space: encodedConfig.length,
    },
  };
  const manifest = {
    programs: {
      ...programs,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM,
    },
    accounts: {
      cpmmConfig: deployment.cpmmConfig,
      initializerConfig: deployment.initializerConfig,
      hookConfig,
    },
  };

  writeFileSync(
    accountOutputPath,
    `${JSON.stringify(accountFixture, null, 2)}\n`,
  );
  writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
