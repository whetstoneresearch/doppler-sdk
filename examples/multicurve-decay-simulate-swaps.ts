/**
 * Example: Deploy Decay Multicurve + Simulate Swaps
 *
 * This example demonstrates:
 * - Deploying a decay multicurve auction
 * - Reusing the Pure Markets V4 buy command flow (`WRAP_ETH` + `SETTLE` + `SWAP` + `TAKE` + `SWEEP`)
 * - Simulating swaps (no onchain swap execution) across the decay schedule
 * - Comparing quoted output over time to validate fee decay behavior
 *
 * Notes:
 * - `pool.fee` is the terminal fee (`endFee`)
 * - Swaps in this script are simulated via `eth_call` and do not spend gas
 */
import './env';

import {
  DopplerSDK,
  WAD,
  getAddresses,
  type MulticurveDecayFeeSchedule,
  type V4PoolKey,
} from '../src';
import {
  CommandBuilder,
  CommandType,
  V4ActionBuilder,
  V4ActionType,
} from 'doppler-router';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];

if (!privateKey) throw new Error('PRIVATE_KEY is not set');

const START_DELAY_SECONDS = 20;
const DECAY_DURATION_SECONDS = 45;
const SAMPLE_AMOUNT_IN = parseEther('0.01');
const SIMULATION_SLIPPAGE_BPS = 50n; // 0.50%

// Same constants used in pure-markets-interface swap helpers.
const CONTRACT_BALANCE = BigInt(
  '0x8000000000000000000000000000000000000000000000000000000000000000'
);
const OPEN_DELTA = 0n;

const universalRouterAbi = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

type QuoteSource = 'uniswapV4Quoter' | 'dopplerLens';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function feeToPercentString(fee: number): string {
  return `${(fee / 10_000).toFixed(4)}%`;
}

function computeExpectedFeeAtTimestamp(
  schedule: MulticurveDecayFeeSchedule,
  timestamp: number
): number {
  if (timestamp <= schedule.startingTime) return schedule.startFee;
  if (schedule.startFee <= schedule.endFee) return schedule.endFee;

  const elapsed = timestamp - schedule.startingTime;
  if (elapsed >= schedule.durationSeconds) return schedule.endFee;

  const feeRange = schedule.startFee - schedule.endFee;
  const feeDelta = Math.floor((feeRange * elapsed) / schedule.durationSeconds);
  return schedule.startFee - feeDelta;
}

async function waitUntilTimestamp(
  targetTimestamp: number,
  publicClient: { getBlock: () => Promise<{ timestamp: bigint }> },
  label: string
) {
  while (true) {
    const block = await publicClient.getBlock();
    const now = Number(block.timestamp);
    if (now >= targetTimestamp) {
      return now;
    }

    const remaining = targetTimestamp - now;
    console.log(`  Waiting ${remaining}s for ${label}...`);
    await sleep(Math.min(5_000, Math.max(1_000, remaining * 250)));
  }
}

async function quoteExactInputV4WithFallback(
  sdk: DopplerSDK,
  params: {
    poolKey: V4PoolKey;
    zeroForOne: boolean;
    exactAmount: bigint;
    hookData?: Hex;
  }
): Promise<{ amountOut: bigint; gasEstimate: bigint; source: QuoteSource }> {
  try {
    const quote = await sdk.quoter.quoteExactInputV4Quoter({
      poolKey: params.poolKey,
      zeroForOne: params.zeroForOne,
      exactAmount: params.exactAmount,
      hookData: params.hookData ?? '0x',
    });
    if (quote.amountOut > 0n) {
      return { ...quote, source: 'uniswapV4Quoter' };
    }
  } catch {
    // Fall through to Doppler lens fallback
  }

  const fallback = await sdk.quoter.quoteExactInputV4({
    poolKey: params.poolKey,
    zeroForOne: params.zeroForOne,
    exactAmount: params.exactAmount,
    hookData: params.hookData ?? '0x',
  });
  return { ...fallback, source: 'dopplerLens' };
}

function buildBuyEthV4Commands(params: {
  weth: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient: Address;
  universalRouterAddress: Address;
  tokenAddress: Address;
  poolKey: V4PoolKey;
}): [Hex, Hex[]] {
  const {
    weth,
    amountIn,
    minAmountOut,
    recipient,
    universalRouterAddress,
    tokenAddress,
    poolKey,
  } = params;

  const isWethCurrency0 =
    poolKey.currency0.toLowerCase() === weth.toLowerCase();
  const zeroForOne = isWethCurrency0;

  const commandBuilder = new CommandBuilder();
  commandBuilder.addWrapEth(universalRouterAddress, amountIn);

  const actionBuilder = new V4ActionBuilder();
  const [actions, v4Params] = actionBuilder
    .addAction(V4ActionType.SETTLE, [weth, CONTRACT_BALANCE, false])
    .addSwapExactInSingle(poolKey, zeroForOne, OPEN_DELTA, minAmountOut, '0x')
    .addAction(V4ActionType.TAKE_ALL, [tokenAddress, 0])
    .build();

  commandBuilder.addV4Swap(actions, v4Params);
  commandBuilder.addCommand(CommandType.SWEEP, [tokenAddress, recipient, 0n]);

  return commandBuilder.build();
}

async function main() {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account,
  });

  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  });
  const addresses = getAddresses(baseSepolia.id);

  if (!addresses.v4DecayMulticurveInitializer) {
    throw new Error(
      'Decay multicurve initializer is not configured for Base Sepolia'
    );
  }

  console.log('Decay Multicurve Swap Simulation Example');
  console.log('User address:', account.address);
  console.log('RPC:', rpcUrl);
  console.log('Decay initializer:', addresses.v4DecayMulticurveInitializer);
  console.log('Universal Router:', addresses.universalRouter);
  console.log();

  const requestedStartTime =
    Math.floor(Date.now() / 1000) + START_DELAY_SECONDS;

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Decay Simulation',
      symbol: 'DSIM',
      tokenURI: 'ipfs://decay-sim.json',
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth,
    })
    .poolConfig({
      fee: 12_000, // terminal fee: 1.2%
      tickSpacing: 200,
      curves: [
        {
          tickLower: 0,
          tickUpper: 220_000,
          numPositions: 1,
          shares: parseEther('0.99'),
        },
        {
          tickLower: 220_000,
          tickUpper: 887_200,
          numPositions: 1,
          shares: parseEther('0.01'),
        },
      ],
    })
    .withDecay({
      startTime: requestedStartTime,
      startFee: 800_000, // 80% anti-sniping start fee
      durationSeconds: DECAY_DURATION_SECONDS,
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build();

  console.log('Creating decay multicurve pool...');
  const created = await sdk.factory.createMulticurve(params);
  await publicClient.waitForTransactionReceipt({
    hash: created.transactionHash as `0x${string}`,
  });

  console.log('  Token address:', created.tokenAddress);
  console.log('  Pool ID:', created.poolId);
  console.log('  Tx hash:', created.transactionHash);
  console.log();

  const pool = await sdk.getMulticurvePool(created.tokenAddress);
  const state = await pool.getState();
  const schedule = await pool.getFeeSchedule();

  if (!schedule) {
    throw new Error(
      'Expected decay fee schedule, but this pool is not configured for dynamic fees'
    );
  }

  const poolKey: V4PoolKey = state.poolKey;
  const zeroForOne =
    poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase();
  const expectedTokenOut = zeroForOne ? poolKey.currency1 : poolKey.currency0;
  if (expectedTokenOut.toLowerCase() !== created.tokenAddress.toLowerCase()) {
    throw new Error(
      'Unexpected pool token ordering for WETH -> token buy path'
    );
  }

  console.log('Decay schedule');
  console.log('  Requested start:', requestedStartTime);
  console.log('  Actual start:', schedule.startingTime);
  console.log(
    '  Start fee:',
    `${schedule.startFee} (${feeToPercentString(schedule.startFee)})`
  );
  console.log(
    '  End fee:',
    `${schedule.endFee} (${feeToPercentString(schedule.endFee)})`
  );
  console.log('  Duration:', `${schedule.durationSeconds}s`);
  console.log(
    '  Current lastFee:',
    `${schedule.lastFee} (${feeToPercentString(schedule.lastFee)})`
  );
  console.log();

  const checkpoints = [
    { label: 'start', timestamp: schedule.startingTime },
    {
      label: '25%',
      timestamp:
        schedule.startingTime + Math.floor(schedule.durationSeconds * 0.25),
    },
    {
      label: '50%',
      timestamp:
        schedule.startingTime + Math.floor(schedule.durationSeconds * 0.5),
    },
    {
      label: '75%',
      timestamp:
        schedule.startingTime + Math.floor(schedule.durationSeconds * 0.75),
    },
    {
      label: '100%',
      timestamp: schedule.startingTime + schedule.durationSeconds,
    },
    {
      label: 'post-end',
      timestamp: schedule.startingTime + schedule.durationSeconds + 10,
    },
  ].filter(
    (point, index, arr) =>
      index === 0 || point.timestamp !== arr[index - 1].timestamp
  );

  const samples: Array<{
    label: string;
    timestamp: number;
    expectedFee: number;
    amountOut: bigint;
  }> = [];

  console.log('Simulating buys across fee-decay checkpoints...');
  console.log(
    '  Input amount per simulation:',
    `${formatEther(SAMPLE_AMOUNT_IN)} ETH`
  );
  console.log();

  for (const checkpoint of checkpoints) {
    const currentTimestamp = await waitUntilTimestamp(
      checkpoint.timestamp,
      publicClient,
      checkpoint.label
    );
    const expectedFee = computeExpectedFeeAtTimestamp(
      schedule,
      currentTimestamp
    );

    const quote = await quoteExactInputV4WithFallback(sdk, {
      poolKey,
      zeroForOne,
      exactAmount: SAMPLE_AMOUNT_IN,
      hookData: '0x',
    });

    const minAmountOut =
      (quote.amountOut * (10_000n - SIMULATION_SLIPPAGE_BPS)) / 10_000n;
    const [commands, inputs] = buildBuyEthV4Commands({
      weth: addresses.weth,
      amountIn: SAMPLE_AMOUNT_IN,
      minAmountOut,
      recipient: account.address,
      universalRouterAddress: addresses.universalRouter,
      tokenAddress: created.tokenAddress,
      poolKey,
    });

    const deadline = BigInt(currentTimestamp + 30 * 60);
    await publicClient.simulateContract({
      address: addresses.universalRouter,
      abi: universalRouterAbi,
      functionName: 'execute',
      args: [commands, inputs, deadline],
      account: account.address,
      value: SAMPLE_AMOUNT_IN,
    });

    const scheduleSnapshot = await pool.getFeeSchedule();

    samples.push({
      label: checkpoint.label,
      timestamp: currentTimestamp,
      expectedFee,
      amountOut: quote.amountOut,
    });

    console.log(`  [${checkpoint.label}]`);
    console.log(`    blockTime: ${currentTimestamp}`);
    console.log(
      `    expectedFee: ${expectedFee} (${feeToPercentString(expectedFee)})`
    );
    console.log(`    quotedOut: ${formatEther(quote.amountOut)} tokens`);
    console.log(`    quoteSource: ${quote.source}`);
    console.log(
      `    storedLastFee: ${scheduleSnapshot?.lastFee ?? 0} (${feeToPercentString(scheduleSnapshot?.lastFee ?? 0)})`
    );
    console.log();
  }

  for (let i = 1; i < samples.length; i++) {
    if (samples[i].expectedFee > samples[i - 1].expectedFee) {
      throw new Error(
        `Expected fee increased between ${samples[i - 1].label} and ${samples[i].label}`
      );
    }
  }

  const startIndex = samples.findIndex(
    (sample) => sample.timestamp >= schedule.startingTime
  );
  for (let i = Math.max(startIndex + 1, 1); i < samples.length; i++) {
    if (samples[i].amountOut < samples[i - 1].amountOut) {
      throw new Error(
        `Quoted output decreased between ${samples[i - 1].label} and ${samples[i].label}`
      );
    }
  }

  const terminalVerificationTimestamp =
    schedule.startingTime + schedule.durationSeconds + 15;
  const terminalNow = await waitUntilTimestamp(
    terminalVerificationTimestamp,
    publicClient,
    'terminal verification'
  );
  const terminalExpectedFee = computeExpectedFeeAtTimestamp(
    schedule,
    terminalNow
  );
  if (terminalExpectedFee !== schedule.endFee) {
    throw new Error(
      `Expected terminal fee ${schedule.endFee} after decay, got ${terminalExpectedFee}`
    );
  }

  console.log(
    'Running terminal-fee equality check with two simulated swaps...'
  );

  const terminalQuoteOne = await quoteExactInputV4WithFallback(sdk, {
    poolKey,
    zeroForOne,
    exactAmount: SAMPLE_AMOUNT_IN,
    hookData: '0x',
  });
  const terminalMinOutOne =
    (terminalQuoteOne.amountOut * (10_000n - SIMULATION_SLIPPAGE_BPS)) /
    10_000n;
  const [terminalCommandsOne, terminalInputsOne] = buildBuyEthV4Commands({
    weth: addresses.weth,
    amountIn: SAMPLE_AMOUNT_IN,
    minAmountOut: terminalMinOutOne,
    recipient: account.address,
    universalRouterAddress: addresses.universalRouter,
    tokenAddress: created.tokenAddress,
    poolKey,
  });
  const terminalDeadlineOne = BigInt(terminalNow + 30 * 60);
  await publicClient.simulateContract({
    address: addresses.universalRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [terminalCommandsOne, terminalInputsOne, terminalDeadlineOne],
    account: account.address,
    value: SAMPLE_AMOUNT_IN,
  });

  const terminalQuoteTwo = await quoteExactInputV4WithFallback(sdk, {
    poolKey,
    zeroForOne,
    exactAmount: SAMPLE_AMOUNT_IN,
    hookData: '0x',
  });
  const terminalMinOutTwo =
    (terminalQuoteTwo.amountOut * (10_000n - SIMULATION_SLIPPAGE_BPS)) /
    10_000n;
  const [terminalCommandsTwo, terminalInputsTwo] = buildBuyEthV4Commands({
    weth: addresses.weth,
    amountIn: SAMPLE_AMOUNT_IN,
    minAmountOut: terminalMinOutTwo,
    recipient: account.address,
    universalRouterAddress: addresses.universalRouter,
    tokenAddress: created.tokenAddress,
    poolKey,
  });
  const terminalDeadlineTwo = BigInt(terminalNow + 30 * 60);
  await publicClient.simulateContract({
    address: addresses.universalRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [terminalCommandsTwo, terminalInputsTwo, terminalDeadlineTwo],
    account: account.address,
    value: SAMPLE_AMOUNT_IN,
  });

  if (terminalQuoteOne.amountOut !== terminalQuoteTwo.amountOut) {
    throw new Error(
      `Terminal fee verification failed: simulated swaps diverged (${terminalQuoteOne.amountOut} != ${terminalQuoteTwo.amountOut})`
    );
  }

  console.log('Decay swap simulation checks passed');
  console.log('  - Expected fee is non-increasing across checkpoints');
  console.log('  - Quoted output is non-decreasing as fee decays');
  console.log(
    `  - Terminal fee reached (${schedule.endFee}, ${feeToPercentString(schedule.endFee)}) and two simulated swaps matched exactly`
  );
  console.log();
  console.log(
    'Note: stored `lastFee` only updates on real swaps, not simulations.'
  );
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
