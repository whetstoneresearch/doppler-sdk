/** Creates and trades a launch with neither an authority nor a migrator. */
import './env.js';

import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { generateKeyPairSigner } from '@solana/kit';

import {
  createLaunch,
  curveSwapExactIn,
  initializer,
} from '../src/solana/index.js';
import {
  DEFAULT_SWAP_FEE_BPS,
  WSOL_MINT,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
} from './solanaExampleHelpers.js';

const BASE_DECIMALS = 6;
const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
const LAMPORTS_PER_SOL = 1_000_000_000n;
const BUY_AMOUNT = LAMPORTS_PER_SOL / 100n;

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);
  const namespace = SYSTEM_PROGRAM_ADDRESS;

  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();

  const prepared = await createLaunch({
    deployment,
    namespace,
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
    migration: false,
    metadata: null,
    feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
  });

  if (prepared.cpmmMigration) {
    throw new Error('Permissionless launch unexpectedly configured migration');
  }

  const launchSignature = await sendInitializeLaunchWithLookupTable({
    rpc,
    rpcSubscriptions,
    payer,
    instruction: prepared.instruction,
  });

  const launchAccount = await initializer.fetchLaunch(
    rpc,
    prepared.addresses.launch,
    {
      commitment: 'confirmed',
      programId: deployment.initializerProgram,
    },
  );
  if (!launchAccount) {
    throw new Error('Launch account was not found after initialization');
  }
  if (launchAccount.authority !== SYSTEM_PROGRAM_ADDRESS) {
    throw new Error(
      `Launch stored unexpected authority ${launchAccount.authority}`,
    );
  }
  if (launchAccount.migratorProgram !== SYSTEM_PROGRAM_ADDRESS) {
    throw new Error(
      `Launch stored unexpected migrator ${launchAccount.migratorProgram}`,
    );
  }

  const buy = await curveSwapExactIn({
    deployment,
    launch: prepared.addresses.launch,
    launchAuthority: prepared.addresses.launchAuthority,
    launchFeeState: prepared.addresses.launchFeeState,
    baseMint: baseMint.address,
    quoteMint: WSOL_MINT,
    baseVault: baseVault.address,
    quoteVault: quoteVault.address,
    payer,
    amountIn: BUY_AMOUNT,
    minAmountOut: 1n,
    tradeDirection: initializer.TRADE_DIRECTION_BUY,
    remainingAccounts: [namespace],
  });
  const buySignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: buy.instructions,
  });

  console.log('Permissionless no-migration launch verified:');
  console.log('  Launch:    ', prepared.addresses.launch);
  console.log('  Authority: ', launchAccount.authority);
  console.log('  Migrator:  ', launchAccount.migratorProgram);
  console.log('  Launch tx: ', launchSignature);
  console.log('  Buy tx:    ', buySignature);
}

main().catch((error: unknown) => {
  console.error('Permissionless no-migration launch failed:', error);
  process.exit(1);
});
