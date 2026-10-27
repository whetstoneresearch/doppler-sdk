/**
 * Wall-clock scenario on a fork: the dynamic fee decays, the cosigner gate
 * expires and vesting releases a partial claim. A fork cannot warp its clock,
 * so the schedules are seconds long; vesting uses the one-day minimum.
 */
import '../../../examples/env.js';

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
} from '@solana-program/token';
import { fetchSysvarClock } from '@solana/sysvars';
import { address, generateKeyPairSigner, type Address } from '@solana/kit';

import {
  curveSwapExactIn,
  dopplerLaunchHookV1,
  initializer,
  vesting,
} from '../../../src/solana/index.js';
import { fetchLaunchFeeState } from '../../../src/solana/generated/initializer/accounts/launchFeeState.js';
import {
  DEFAULT_TEST_METADATA,
  WSOL_MINT,
  assertSimulationRejected,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadCosigner,
  loadKeypairSignerFromEnv,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
  simulateInstructions,
} from '../../../examples/solanaExampleHelpers.js';

const BASE_TOTAL_SUPPLY = 1_000_000_000_000_000n;
const VESTED_SUPPLY = BASE_TOTAL_SUPPLY / 5n;
const BUY_AMOUNT = 10_000_000n;
const START_FEE_BPS = 1_000;
const END_FEE_BPS = 200;
// Long enough for creation and the first buy to finish before either ends.
const SCHEDULE_SECONDS = 15n;

async function main(): Promise<void> {
  const payer = await loadKeypairSignerFromEnv();
  const cosigner = await loadCosigner();
  const clients = createSolanaClientsFromEnv();
  const { rpc } = clients;
  const deployment = await getSolanaCpmmDeploymentFromEnv(clients.network);
  const vestingProgram = address(process.env.SOLANA_VESTING_PROGRAM_ID!);
  const now = async () => (await fetchSysvarClock(rpc)).unixTimestamp;
  const ends = (await now()) + SCHEDULE_SECONDS;

  const gate = await dopplerLaunchHookV1.resolveManagedCosignerGate(rpc, {
    programId: deployment.dopplerLaunchHookV1Program,
    expiresAt: ends,
  });
  const baseMint = await generateKeyPairSigner();
  const prepared = await vesting.prepareLaunch({
    deployment,
    namespace: gate.config,
    payer,
    authority: payer,
    launchAccounts: { baseMint, quoteMint: WSOL_MINT },
    supply: {
      baseDecimals: 6,
      baseTotalSupply: BASE_TOTAL_SUPPLY,
      baseForLiquidity: 0n,
    },
    curve: {
      curveVirtualBase: BASE_TOTAL_SUPPLY,
      curveVirtualQuote: 10_000_000_000n,
      swapFeeBps: END_FEE_BPS,
    },
    dynamicFee: {
      startingTime: 0n,
      startFeeBps: START_FEE_BPS,
      endFeeBps: END_FEE_BPS,
      durationSeconds: SCHEDULE_SECONDS,
    },
    cosignerGate: gate,
    migration: false,
    metadata: DEFAULT_TEST_METADATA,
    feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
    vesting: {
      schedules: [{ cliffSeconds: 2n, durationSeconds: 86_400n }],
      allocations: [
        { beneficiary: payer.address, scheduleId: 0, amount: VESTED_SUPPLY },
      ],
    },
    vestingProgram,
  });
  const send = (
    instructions: Parameters<typeof sendInstructions>[0]['instructions'],
  ) => sendInstructions({ ...clients, payer, instructions });
  await send([prepared.initializeVestingInstruction]);
  await sendInitializeLaunchWithLookupTable({
    ...clients,
    payer,
    instruction: prepared.initializeLaunchInstruction,
    metadata: DEFAULT_TEST_METADATA,
  });
  await send([prepared.fundVestingInstruction]);

  const { signedHookRemainingAccounts, unsignedHookRemainingAccounts } =
    dopplerLaunchHookV1.getDopplerLaunchHookV1RemainingAccounts({
      namespace: gate.config,
      config: gate.config,
      cosigner,
    });
  const buy = (
    remainingAccounts: typeof signedHookRemainingAccounts | Address[],
  ) =>
    curveSwapExactIn({
      deployment,
      ...prepared.launchAddresses,
      baseMint: baseMint.address,
      quoteMint: WSOL_MINT,
      payer,
      amountIn: BUY_AMOUNT,
      minAmountOut: 1n,
      tradeDirection: initializer.TRADE_DIRECTION_BUY,
      remainingAccounts,
    });
  const quoteFees = async () =>
    (
      await fetchLaunchFeeState(rpc, prepared.launchAddresses.launchFeeState, {
        commitment: 'confirmed',
      })
    ).data.cumulatedQuoteFees;
  const endFee = initializer.getCurveSwapFeeAmount(BUY_AMOUNT, END_FEE_BPS);

  const unsigned = await buy(unsignedHookRemainingAccounts);
  assertSimulationRejected(
    'Unsigned buy before gate expiry',
    (
      await simulateInstructions({
        rpc,
        payer,
        instructions: unsigned.instructions,
      })
    ).err,
  );
  await send((await buy(signedHookRemainingAccounts)).instructions);
  const earlyFee = await quoteFees();
  if (earlyFee <= endFee) {
    throw new Error(
      `Early fee ${earlyFee} did not exceed the end fee ${endFee}`,
    );
  }
  console.log(`Early buy fee: ${earlyFee} (end fee ${endFee})`);

  while ((await now()) <= ends + 1n) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  await send((await buy(unsignedHookRemainingAccounts)).instructions);
  const lateFee = (await quoteFees()) - earlyFee;
  if (lateFee !== endFee) {
    throw new Error(`Fee after decay was ${lateFee}, expected ${endFee}`);
  }
  console.log(`Unsigned buy after gate expiry paid the end fee: ${lateFee}`);

  const [tokenAccount] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const balance = async () =>
    BigInt(
      (
        await rpc
          .getTokenAccountBalance(tokenAccount, { commitment: 'confirmed' })
          .send()
      ).value.amount,
    );
  const before = await balance();
  const claim = await vesting.prepareClaim({
    payer,
    beneficiary: payer.address,
    launch: prepared.launchAddresses.launch,
    baseMint: baseMint.address,
    baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
    vestingProgram,
  });
  await send([claim.instruction]);
  const claimed = (await balance()) - before;
  if (claimed <= 0n || claimed >= VESTED_SUPPLY) {
    throw new Error(`Expected a partial vesting claim, got ${claimed}`);
  }
  console.log(`Partial vesting claim: ${claimed} of ${VESTED_SUPPLY}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
