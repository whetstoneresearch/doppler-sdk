/** Creates a non-migrating launch with an immutable token vesting allocation. */
import './env.js';

import { generateKeyPairSigner } from '@solana/kit';

import { vesting } from '../src/solana/index.js';
import {
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
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
const VESTED_SUPPLY = (BASE_TOTAL_SUPPLY * 20n) / 100n;
const DAY_SECONDS = 86_400n;
const LAMPORTS_PER_SOL = 1_000_000_000n;

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);
  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();

  const prepared = await vesting.prepareLaunch({
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
      baseForLiquidity: 0n,
    },
    curve: {
      curveVirtualBase: BASE_TOTAL_SUPPLY,
      curveVirtualQuote: 10n * LAMPORTS_PER_SOL,
      swapFeeBps: DEFAULT_SWAP_FEE_BPS,
    },
    vesting: {
      schedules: [
        {
          cliffSeconds: 7n * DAY_SECONDS,
          durationSeconds: 30n * DAY_SECONDS,
        },
      ],
      allocations: [
        {
          beneficiary: payer.address,
          scheduleId: 0,
          amount: VESTED_SUPPLY,
        },
      ],
    },
    metadata: DEFAULT_TEST_METADATA,
    feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
  });

  const configSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [prepared.initializeVestingInstruction],
  });
  const launchSignature = await sendInitializeLaunchWithLookupTable({
    rpc,
    rpcSubscriptions,
    payer,
    instruction: prepared.initializeLaunchInstruction,
    metadata: DEFAULT_TEST_METADATA,
  });
  const fundingSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [prepared.fundVestingInstruction],
  });

  console.log('Vesting launch created and funded:');
  console.log('  Launch:         ', prepared.launchAddresses.launch);
  console.log('  Base mint:      ', baseMint.address);
  console.log('  Vesting config: ', prepared.vestingAddresses.config);
  console.log('  Vesting vault:  ', prepared.vestingAddresses.vault);
  console.log('  Config tx:      ', configSignature);
  console.log('  Launch tx:      ', launchSignature);
  console.log('  Funding tx:     ', fundingSignature);
}

main().catch((error: unknown) => {
  console.error('Error creating vesting launch:', error);
  process.exit(1);
});
