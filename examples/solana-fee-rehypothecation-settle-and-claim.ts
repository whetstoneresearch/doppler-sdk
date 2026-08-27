/** Settles routed launch fees and claims one beneficiary's proceeds. */
import './env.js';

import { address } from '@solana/kit';

import { feeRehypothecation } from '../src/solana/index.js';
import {
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolanaFeeRehypothecationDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  requiredEnv,
  sendInstructions,
} from './solanaExampleHelpers.js';

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment =
    await getSolanaFeeRehypothecationDeploymentFromEnv(network);
  const launch = address(requiredEnv('SOLANA_LAUNCH'));
  const baseMint = address(requiredEnv('SOLANA_BASE_MINT'));
  const beneficiary = process.env.SOLANA_FEE_BENEFICIARY
    ? address(process.env.SOLANA_FEE_BENEFICIARY)
    : payer.address;

  const settlement = await feeRehypothecation.prepareSettlement({
    rpc,
    deployment,
    launch,
    payer,
  });
  console.log('Settlement quote:', settlement.quote);
  const settlementSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [settlement.instruction],
  });

  const claim = await feeRehypothecation.prepareClaim({
    rpc,
    deployment,
    baseMint,
    beneficiary,
    payer,
  });
  const claimSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [claim.instruction],
  });

  console.log('Fees settled and claimed:');
  console.log('  Settlement tx:', settlementSignature);
  console.log('  Claim tx:     ', claimSignature);
  console.log('  Base claimed: ', claim.pendingBaseFees.toString());
  console.log('  Quote claimed:', claim.pendingQuoteFees.toString());
}

main().catch((error: unknown) => {
  console.error('Error settling or claiming fees:', error);
  process.exit(1);
});
