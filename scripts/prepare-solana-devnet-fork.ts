#!/usr/bin/env npx tsx
import { writeFileSync } from 'node:fs';

import { address, getMinimumBalanceForRentExemption } from '@solana/kit';
import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTokenEncoder,
} from '@solana-program/token';

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
const DEVNET_USDC_MINT = address(
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
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
  const payer = address(requireArgument('payer'));
  const payerUsdcOutput = requireArgument('payer-usdc-output');
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

  const [payerUsdcAccount] = await findAssociatedTokenPda({
    owner: payer,
    mint: DEVNET_USDC_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  // Synthetic funds exist only in the disposable local validator's genesis.
  const usdcAccountBytes = getTokenEncoder().encode({
    mint: DEVNET_USDC_MINT,
    owner: payer,
    amount: 1_000_000_000n,
    delegate: null,
    state: AccountState.Initialized,
    isNative: null,
    delegatedAmount: 0n,
    closeAuthority: null,
  });
  writeFileSync(
    payerUsdcOutput,
    `${JSON.stringify(
      {
        pubkey: payerUsdcAccount,
        account: {
          lamports: Number(
            getMinimumBalanceForRentExemption(BigInt(usdcAccountBytes.length)),
          ),
          data: [Buffer.from(usdcAccountBytes).toString('base64'), 'base64'],
          owner: TOKEN_PROGRAM_ADDRESS,
          executable: false,
          rentEpoch: 0,
          space: usdcAccountBytes.length,
        },
      },
      null,
      2,
    )}\n`,
  );

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
          devnetUsdcMint: DEVNET_USDC_MINT,
          payerUsdcAccount,
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
