/** Claims currently vested tokens for a configured beneficiary. */
import './env.js';

import { address } from '@solana/kit';

import { vesting } from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  loadKeypairSignerFromEnv,
  requiredEnv,
  sendInstructions,
} from './solanaExampleHelpers.js';

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const launch = address(requiredEnv('SOLANA_VESTING_LAUNCH'));
  const baseMint = address(requiredEnv('SOLANA_VESTING_BASE_MINT'));
  const beneficiary = process.env.SOLANA_VESTING_BENEFICIARY
    ? address(process.env.SOLANA_VESTING_BENEFICIARY)
    : payer.address;
  const vestingProgramText = process.env.SOLANA_VESTING_PROGRAM_ID?.trim();
  const vestingProgram = vestingProgramText
    ? address(vestingProgramText)
    : undefined;

  const claim = await vesting.prepareClaim({
    payer,
    beneficiary,
    launch,
    baseMint,
    vestingProgram,
  });
  const signature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [claim.instruction],
  });

  console.log('Vested tokens claimed:');
  console.log('  Beneficiary: ', beneficiary);
  console.log('  Token account:', claim.beneficiaryTokenAccount);
  console.log('  Transaction:  ', signature);
}

main().catch((error: unknown) => {
  console.error('Error claiming vested tokens:', error);
  process.exit(1);
});
