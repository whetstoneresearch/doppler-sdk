/**
 * Example: Dynamic-Fee CPMM Launch (Solana)
 *
 * Creates a WSOL XYK launch that uses the CPMM hook's dynamic fees. The
 * schedule is stored in the launch hook payload and normalized by the hook's
 * BEFORE_CREATE path during initialize_launch.
 */
import './env.js';

import {
  generateKeyPairSigner,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';

import { createLaunch, cpmmHook, initializer } from '../src/solana/index.js';
import {
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
const STATIC_SWAP_FEE_BPS = 200;
const START_FEE_BPS = 8_000;
const END_FEE_BPS = 200;
const DURATION_SECONDS = 10n * 60n;
const MIN_RAISE_QUOTE = 50n * LAMPORTS_PER_SOL;

function getStoredHookPayload(bytes: {
  len: number;
  bytes: ReadonlyUint8Array;
}): Uint8Array {
  return new Uint8Array(bytes.bytes.slice(0, bytes.len));
}

function assertStoredDynamicFeeSchedule(payload: Uint8Array): bigint {
  if (!cpmmHook.isDynamicFeeSchedulePayload(payload)) {
    throw new Error(
      'Launch hook payload does not contain a dynamic fee schedule',
    );
  }

  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const normalizedStartTime = view.getBigInt64(16, true);
  const storedStartFeeBps = view.getUint16(24, true);
  const storedEndFeeBps = view.getUint16(26, true);
  const storedDurationSeconds = view.getUint32(28, true);

  if (normalizedStartTime <= 0n) {
    throw new Error('Dynamic fee schedule start time was not normalized');
  }
  if (
    storedStartFeeBps !== START_FEE_BPS ||
    storedEndFeeBps !== END_FEE_BPS ||
    BigInt(storedDurationSeconds) !== DURATION_SECONDS
  ) {
    throw new Error('Stored dynamic fee schedule does not match input');
  }

  return normalizedStartTime;
}

async function waitForLaunchAccount({
  rpc,
  launch,
  initializerProgram,
}: {
  rpc: ReturnType<typeof createSolanaClientsFromEnv>['rpc'];
  launch: Address;
  initializerProgram: Address;
}): Promise<initializer.Launch> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const launchAccount = await initializer.fetchLaunch(rpc, launch, {
      commitment: 'confirmed',
      programId: initializerProgram,
    });
    if (launchAccount) {
      return launchAccount;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Launch account was not found after initialization');
}

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);

  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const namespace = payer.address;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));
  const launchAddresses = await initializer.deriveCreateLaunchAddresses({
    deployment,
    namespace,
    launchId,
    baseMint,
  });

  console.log('Creating dynamic-fee launch...');
  console.log('  CPMM hook:       ', deployment.cpmmHookProgram);
  console.log('  Start fee:       ', START_FEE_BPS, 'bps');
  console.log('  End fee:         ', END_FEE_BPS, 'bps');
  console.log('  Duration:        ', DURATION_SECONDS.toString(), 'seconds');
  console.log('');

  const { instruction, addresses, cpmmMigration } = await createLaunch({
    deployment,
    namespace,
    launchId,
    addresses: launchAddresses,
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
      swapFeeBps: STATIC_SWAP_FEE_BPS,
    },
    dynamicFee: {
      startingTime: 0n,
      startFeeBps: START_FEE_BPS,
      endFeeBps: END_FEE_BPS,
      durationSeconds: DURATION_SECONDS,
    },
    migration: {
      minRaiseQuote: MIN_RAISE_QUOTE,
    },
    metadata: null,
    feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
  });

  if (!cpmmMigration) {
    throw new Error('CPMM migration accounts were not prepared');
  }

  console.log('Derived addresses:');
  console.log('  Launch:               ', addresses.launch);
  console.log('  Base mint:            ', baseMint.address);
  console.log('  Launch authority:     ', addresses.launchAuthority);
  console.log('  CPMM migrator state:  ', cpmmMigration.cpmmMigrationState);
  console.log('');

  const signature = await sendInitializeLaunchWithLookupTable({
    rpc,
    rpcSubscriptions,
    payer,
    instruction,
  });

  console.log('');
  console.log('Dynamic fee launch created successfully!');
  console.log('  Transaction:', signature);

  const launchAccount = await waitForLaunchAccount({
    rpc,
    launch: addresses.launch,
    initializerProgram: deployment.initializerProgram,
  });

  const hookPayload = getStoredHookPayload(launchAccount.hookPayload);
  const expectedHookFlags =
    initializer.HF_BEFORE_CREATE | initializer.HF_BEFORE_SWAP;
  if (launchAccount.hookProgram !== deployment.cpmmHookProgram) {
    throw new Error(
      `Unexpected hook program ${launchAccount.hookProgram}; expected ${deployment.cpmmHookProgram}`,
    );
  }
  if (launchAccount.hookFlags !== expectedHookFlags) {
    throw new Error(
      `Unexpected hook flags ${launchAccount.hookFlags}; expected ${expectedHookFlags}`,
    );
  }
  const normalizedStartTime = assertStoredDynamicFeeSchedule(hookPayload);

  console.log('');
  console.log('Launch account verified:');
  console.log(
    '  Phase:                 ',
    initializer.phaseLabel(launchAccount.phase),
  );
  console.log('  Hook program:          ', launchAccount.hookProgram);
  console.log('  Hook flags:            ', launchAccount.hookFlags);
  console.log('  Stored hook payload len:', hookPayload.length);
  console.log('  Normalized start time: ', normalizedStartTime.toString());
  console.log('  Static swap fee:       ', launchAccount.swapFeeBps, 'bps');
  console.log(
    '  Quote deposited:       ',
    launchAccount.quoteDeposited.toString(),
    'lamports',
  );
}

main().catch((error: unknown) => {
  console.error('Error creating dynamic fee launch:', error);
  process.exit(1);
});
