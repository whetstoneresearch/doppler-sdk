/**
 * Example: Minimal XYK Token Launch (Solana)
 *
 * Demonstrates the smallest practical createLaunch flow: fixed curve numbers,
 * default Doppler launch hook v1, default CPMM migrator, derived launch addresses, and no
 * token metadata.
 */
import './env.js';

import { generateKeyPairSigner } from '@solana/kit';

import { createLaunch, initializer } from '../src/solana/index.js';
import {
  DEFAULT_SWAP_FEE_BPS,
  WSOL_MINT,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInitializeLaunchWithLookupTable,
} from './solanaExampleHelpers.js';

const BASE_DECIMALS = 6;
const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
const LAMPORTS_PER_SOL = 1_000_000_000n;

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);

  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();

  const { instruction, addresses, cpmmMigration } = await createLaunch({
    deployment,
    launchAccounts: {
      baseMint,
      quoteMint: WSOL_MINT,
      baseVault,
      quoteVault,
    },
    payer,
    supply: {
      baseDecimals: BASE_DECIMALS,
      baseTotalSupply: BASE_TOTAL_SUPPLY,
      baseForDistribution: 0n,
      baseForLiquidity: 0n,
    },
    curve: {
      curveVirtualBase: BASE_TOTAL_SUPPLY,
      curveVirtualQuote: 10n * LAMPORTS_PER_SOL,
      swapFeeBps: DEFAULT_SWAP_FEE_BPS,
    },
    migration: {
      minRaiseQuote: LAMPORTS_PER_SOL,
    },
  });

  if (!cpmmMigration) {
    throw new Error('CPMM migration accounts were not prepared');
  }

  console.log('Creating minimal XYK token launch...');
  console.log('  Launch:              ', addresses.launch);
  console.log('  Base mint:           ', baseMint.address);
  console.log('  Launch authority:    ', addresses.launchAuthority);
  console.log('  CPMM migrator state: ', cpmmMigration.cpmmMigrationState);

  const signature = await sendInitializeLaunchWithLookupTable({
    rpc,
    rpcSubscriptions,
    payer,
    instruction,
  });

  console.log('');
  console.log('Token launch created successfully!');
  console.log('  Transaction:', signature);

  const launchAccount = await initializer.fetchLaunch(rpc, addresses.launch, {
    programId: deployment.initializerProgram,
  });

  if (!launchAccount) {
    throw new Error('Launch account was not found after initialization');
  }

  console.log('');
  console.log('Launch account verified:');
  console.log(
    '  Phase:              ',
    initializer.phaseLabel(launchAccount.phase),
  );
  console.log(
    '  Quote deposited:    ',
    launchAccount.quoteDeposited.toString(),
  );
  console.log(
    '  Curve virtual base: ',
    launchAccount.curveVirtualBase.toString(),
  );
  console.log(
    '  Curve virtual quote:',
    launchAccount.curveVirtualQuote.toString(),
  );
}

main().catch((error: unknown) => {
  console.error('Error creating minimal launch:', error);
  process.exit(1);
});
