/** Creates a non-migrating launch, settles one swap's fees, and claims them. */
import './env.js';

import { writeFileSync } from 'node:fs';

import { generateKeyPairSigner } from '@solana/kit';

import {
  curveSwapExactIn,
  feeRehypothecation,
  initializer,
} from '../src/solana/index.js';
import {
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
  WSOL_MINT,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaFeeRehypothecationDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
} from './solanaExampleHelpers.js';

const BASE_DECIMALS = 6;
const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
const LAMPORTS_PER_SOL = 1_000_000_000n;
const BUY_AMOUNT = LAMPORTS_PER_SOL / 10n;

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

function shouldSettleAndClaim(): boolean {
  const value = process.env.SOLANA_FEE_REHYPOTHECATION_SETTLE_AND_CLAIM?.trim();
  if (!value || value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(
    'SOLANA_FEE_REHYPOTHECATION_SETTLE_AND_CLAIM must be true or false',
  );
}

function writeStateOutput(state: { launch: string; baseMint: string }): void {
  const outputPath =
    process.env.SOLANA_FEE_REHYPOTHECATION_STATE_OUTPUT?.trim();
  if (!outputPath) {
    return;
  }
  writeFileSync(outputPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
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
  const launchSignature = await sendInitializeLaunchWithLookupTable({
    rpc,
    rpcSubscriptions,
    payer,
    instruction: prepared.initializeLaunchInstruction,
    metadata: DEFAULT_TEST_METADATA,
  });

  const swap = await curveSwapExactIn({
    deployment,
    launch: prepared.launchAddresses.launch,
    launchAuthority: prepared.launchAddresses.launchAuthority,
    launchFeeState: prepared.launchAddresses.launchFeeState,
    baseMint: baseMint.address,
    quoteMint: WSOL_MINT,
    baseVault: baseVault.address,
    quoteVault: quoteVault.address,
    payer,
    amountIn: BUY_AMOUNT,
    minAmountOut: 1n,
    tradeDirection: initializer.TRADE_DIRECTION_BUY,
    hook: prepared.getSwapHook(),
  });
  const swapSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: swap.instructions,
  });

  writeStateOutput({
    launch: prepared.launchAddresses.launch,
    baseMint: baseMint.address,
  });

  if (!shouldSettleAndClaim()) {
    console.log('Fee rehypothecation launch and swap complete:');
    console.log('  Launch:       ', prepared.launchAddresses.launch);
    console.log('  Base mint:    ', baseMint.address);
    console.log('  Router state: ', prepared.routingAddresses.state);
    console.log('  Routing tx:   ', routingSignature);
    console.log('  Launch tx:    ', launchSignature);
    console.log('  Swap tx:      ', swapSignature);
    return;
  }

  const settlement = await feeRehypothecation.prepareSettlement({
    rpc,
    deployment,
    launch: prepared.launchAddresses.launch,
    payer,
  });
  const settlementSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [settlement.instruction],
  });

  const claim = await feeRehypothecation.prepareClaim({
    rpc,
    deployment,
    baseMint: baseMint.address,
    beneficiary: payer.address,
    payer,
  });
  const claimSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [claim.instruction],
  });

  console.log('Fee rehypothecation flow complete:');
  console.log('  Launch:       ', prepared.launchAddresses.launch);
  console.log('  Base mint:    ', baseMint.address);
  console.log('  Router state: ', prepared.routingAddresses.state);
  console.log('  Routing tx:   ', routingSignature);
  console.log('  Launch tx:    ', launchSignature);
  console.log('  Swap tx:      ', swapSignature);
  console.log('  Settlement tx:', settlementSignature);
  console.log('  Claim tx:     ', claimSignature);
}

main().catch((error: unknown) => {
  console.error('Error creating fee rehypothecation launch:', error);
  process.exit(1);
});
