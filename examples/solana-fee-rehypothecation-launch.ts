/**
 * Creates a non-migrating Solana launch whose distributable swap fees are
 * routed through the fee rehypothecation programs.
 */
import './env.js';

import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { generateKeyPairSigner } from '@solana/kit';

import { feeRehypothecation } from '../src/solana/index.js';
import {
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
  WSOL_MINT,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaFeeRehypothecationDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInstructions,
} from './solanaExampleHelpers.js';

const BASE_DECIMALS = 6;
const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
const LAMPORTS_PER_SOL = 1_000_000_000n;

const strategies = {
  asset: feeRehypothecation.allFeesToBeneficiariesInAsset,
  numeraire: feeRehypothecation.allFeesToBeneficiariesInNumeraire,
  inKind: feeRehypothecation.inKindBeneficiaryFees,
  balanced: feeRehypothecation.balancedFourBucket,
} as const;

type StrategyName = keyof typeof strategies;

function getStrategyName(): StrategyName {
  const value = process.env.SOLANA_FEE_REHYPOTHECATION_STRATEGY ?? 'numeraire';
  if (!(value in strategies)) {
    throw new Error(
      `SOLANA_FEE_REHYPOTHECATION_STRATEGY must be one of ${Object.keys(strategies).join(', ')}`,
    );
  }
  return value as StrategyName;
}

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment =
    await getSolanaFeeRehypothecationDeploymentFromEnv(network);
  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const strategyName = getStrategyName();

  const prepared = await feeRehypothecation.prepareLaunch({
    deployment,
    namespace: SYSTEM_PROGRAM_ADDRESS,
    launchAccounts: {
      baseMint,
      quoteMint: WSOL_MINT,
      baseVault,
      quoteVault,
    },
    payer,
    authority: payer,
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
    metadata: DEFAULT_TEST_METADATA,
    buybackDestination: payer.address,
    settlementAuthority: payer.address,
    beneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
    strategy: strategies[strategyName](),
  });

  console.log(`Initializing ${strategyName} fee routing...`);
  const routingSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [prepared.initializeRoutingInstruction],
  });

  console.log('Creating launch...');
  const launchSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [prepared.initializeLaunchInstruction],
  });

  console.log('Fee rehypothecation launch created:');
  console.log('  Launch:       ', prepared.launchAddresses.launch);
  console.log('  Base mint:    ', baseMint.address);
  console.log('  Router state: ', prepared.routingAddresses.state);
  console.log('  Routing tx:   ', routingSignature);
  console.log('  Launch tx:    ', launchSignature);
}

main().catch((error: unknown) => {
  console.error('Error creating fee rehypothecation launch:', error);
  process.exit(1);
});
