#!/usr/bin/env npx tsx
import { writeFileSync } from 'node:fs';

import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTokenEncoder,
} from '@solana-program/token';
import {
  address,
  createSolanaRpc,
  getMinimumBalanceForRentExemption,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';

import {
  DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES,
  deriveSolanaCpmmDeployment,
  dopplerLaunchHookV1,
} from '../src/solana/index.js';

const TOKEN_METADATA_PROGRAM = address(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);
const MAINNET_USDC_MINT = address(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
);
const FORK_USDC_BALANCE_ATOMS = 1_000_000_000n;

function requireArgument(name: string): string {
  const option = `--${name}`;
  const index = process.argv.indexOf(option);
  const value = index >= 0 ? process.argv[index + 1] : undefined;

  if (!value || value.startsWith('--')) {
    throw new Error(`${option} is required`);
  }

  return value;
}

function createAccountFixture({
  pubkey,
  lamports,
  data,
  owner,
  executable = false,
}: {
  pubkey: Address;
  lamports: number;
  data: ReadonlyUint8Array;
  owner: Address;
  executable?: boolean;
}) {
  return {
    pubkey,
    account: {
      lamports,
      data: [Buffer.from(data).toString('base64'), 'base64'],
      owner,
      executable,
      rentEpoch: 0,
      space: data.length,
    },
  };
}

async function main(): Promise<void> {
  const rpcUrl = requireArgument('rpc-url');
  const payer = address(requireArgument('payer'));
  const cosigner = address(requireArgument('cosigner'));
  const hookConfigOutputPath = requireArgument('hook-config-output');
  const payerUsdcOutputPath = requireArgument('payer-usdc-output');
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
  const hookConfigFixture = createAccountFixture({
    pubkey: hookConfig,
    lamports: Number(account.lamports),
    data: encodedConfig,
    owner: account.owner,
    executable: account.executable,
  });
  const [payerUsdcAccount] = await findAssociatedTokenPda({
    owner: payer,
    mint: MAINNET_USDC_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const encodedPayerUsdcAccount = getTokenEncoder().encode({
    mint: MAINNET_USDC_MINT,
    owner: payer,
    amount: FORK_USDC_BALANCE_ATOMS,
    delegate: null,
    state: AccountState.Initialized,
    isNative: null,
    delegatedAmount: 0n,
    closeAuthority: null,
  });
  const payerUsdcFixture = createAccountFixture({
    pubkey: payerUsdcAccount,
    lamports: Number(
      getMinimumBalanceForRentExemption(BigInt(encodedPayerUsdcAccount.length)),
    ),
    data: encodedPayerUsdcAccount,
    owner: TOKEN_PROGRAM_ADDRESS,
  });
  const manifest = {
    programs: {
      ...programs,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM,
    },
    accounts: {
      cpmmConfig: deployment.cpmmConfig,
      initializerConfig: deployment.initializerConfig,
      hookConfig,
      mainnetUsdcMint: MAINNET_USDC_MINT,
      payerUsdcAccount,
    },
  };

  writeFileSync(
    hookConfigOutputPath,
    `${JSON.stringify(hookConfigFixture, null, 2)}\n`,
  );
  writeFileSync(
    payerUsdcOutputPath,
    `${JSON.stringify(payerUsdcFixture, null, 2)}\n`,
  );
  writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
