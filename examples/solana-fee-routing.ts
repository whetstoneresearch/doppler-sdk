/** Creates a non-migrating launch, settles one swap's fees, and claims them. */
import './env.js';

import { writeFileSync } from 'node:fs';

import { address, generateKeyPairSigner, type Address } from '@solana/kit';

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
  requiredEnv,
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

function getStrategy() {
  const name = process.env.SOLANA_FEE_REHYPOTHECATION_STRATEGY ?? 'numeraire';
  switch (name) {
    case 'asset':
    case 'numeraire':
    case 'inKind':
    case 'balanced':
      return { name, strategy: strategies[name]() };
    default:
      throw new Error('Strategy must be asset, numeraire, inKind, or balanced');
  }
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
  const action = process.argv[2] ?? 'create';
  if (action !== 'create' && action !== 'settle') {
    throw new Error('Usage: solana-fee-routing.ts [create|settle]');
  }
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment =
    await getSolanaFeeRehypothecationDeploymentFromEnv(network);
  const settleAndClaim = async (
    launch: Address,
    baseMint: Address,
  ): Promise<void> => {
    const settlement = await feeRehypothecation.prepareSettlement({
      rpc,
      deployment,
      launch,
      payer,
    });
    console.log('Settlement quote:', settlement.quote);
    console.log(
      'Settlement:',
      await sendInstructions({
        rpc,
        rpcSubscriptions,
        payer,
        instructions: [settlement.instruction],
      }),
    );
    const claim = await feeRehypothecation.prepareClaim({
      rpc,
      deployment,
      baseMint,
      payer,
      beneficiary: process.env.SOLANA_FEE_BENEFICIARY
        ? address(process.env.SOLANA_FEE_BENEFICIARY)
        : payer.address,
    });
    console.log(
      'Claim:',
      await sendInstructions({
        rpc,
        rpcSubscriptions,
        payer,
        instructions: [claim.instruction],
      }),
    );
    console.log(
      'Base / quote claimed:',
      claim.pendingBaseFees.toString(),
      claim.pendingQuoteFees.toString(),
    );
  };
  if (action === 'settle') {
    await settleAndClaim(
      address(requiredEnv('SOLANA_LAUNCH')),
      address(requiredEnv('SOLANA_BASE_MINT')),
    );
    return;
  }
  const baseMint = await generateKeyPairSigner();
  const { name: strategyName, strategy } = getStrategy();

  const prepared = await feeRehypothecation.prepareLaunch({
    deployment,
    launchAccounts: {
      baseMint,
      quoteMint: WSOL_MINT,
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
    strategy,
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
    baseVault: prepared.launchAddresses.baseVault,
    quoteVault: prepared.launchAddresses.quoteVault,
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

  console.log('Launch:', prepared.launchAddresses.launch);
  console.log('Base mint:', baseMint.address);
  console.log('Router state:', prepared.routingAddresses.state);
  console.log(
    'Routing / launch / swap transactions:',
    routingSignature,
    launchSignature,
    swapSignature,
  );
  if (!shouldSettleAndClaim()) return;

  await settleAndClaim(prepared.launchAddresses.launch, baseMint.address);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
