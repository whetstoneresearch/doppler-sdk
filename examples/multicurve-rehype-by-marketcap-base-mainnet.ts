/**
 * Example: Create a Multicurve Pool with RehypeDopplerHook using Market Cap Ranges on Base Mainnet
 *
 * This example is simulation-first and supports optional execution.
 *
 * Required env:
 * - PRIVATE_KEY
 * - CONFIRM_BASE_MAINNET=true
 *
 * Optional env:
 * - RPC_URL (defaults to Base mainnet RPC)
 * - EXECUTE_MAINNET=true (if omitted, the script only simulates)
 *
 * This example demonstrates the recommended way to configure a RehypeDopplerHook:
 * - Using withCurves() with market cap ranges (no tick math required)
 * - Setting graduationMarketCap to define when the pool can graduate
 * - Configuring advanced fee distribution (buybacks, beneficiaries, LPs)
 * - Live ETH price fetching for accurate market cap calculations
 * - Executing a small follow-up buy 20 seconds after deployment
 */
import './env';

import {
  CommandBuilder,
  CommandType,
  V4ActionBuilder,
  V4ActionType,
} from 'doppler-router';
import { DopplerSDK, getAddresses } from '../src';
import {
  parseEther,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const rpcUrl = process.env.RPC_URL ?? base.rpcUrls.default.http[0];
const confirmMainnet = process.env.CONFIRM_BASE_MAINNET === 'true';
const executeMainnet = process.env.EXECUTE_MAINNET === 'true';

const REHYPE_START_DELAY_SECONDS = 20;
const REHYPE_START_FEE = 800_000; // 80%
const REHYPE_END_FEE = 10_000; // 1%
const REHYPE_DURATION_SECONDS = 15;
const SWAP_AMOUNT_IN = 1000000n;
const POST_DEPLOY_SWAP_SLIPPAGE_BPS = 500n; // 5%

const CONTRACT_BALANCE = BigInt(
  '0x8000000000000000000000000000000000000000000000000000000000000000',
);
const OPEN_DELTA = 0n;

if (!privateKey) throw new Error('PRIVATE_KEY is not set');
if (!confirmMainnet) {
  throw new Error(
    'Set CONFIRM_BASE_MAINNET=true to run this script on Base mainnet',
  );
}

// Destination address for buyback tokens
const BUYBACK_DESTINATION =
  '0x0000000000000000000000000000000000000007' as Address;

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

const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Fetch current ETH price in USD from CoinGecko
 */
async function getEthPriceUsd(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  );
  const data = await response.json();
  return data.ethereum.usd;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilTimestamp(
  targetTimestamp: number,
  publicClient: { getBlock: () => Promise<{ timestamp: bigint }> },
  label: string,
): Promise<number> {
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

function buildBuyEthV4Commands(params: {
  weth: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient: Address;
  universalRouterAddress: Address;
  tokenAddress: Address;
  poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
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

  const zeroForOne = poolKey.currency0.toLowerCase() === weth.toLowerCase();

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
    chain: base,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account,
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== base.id) {
    throw new Error(
      `Connected to chain ${chainId}, expected Base mainnet (${base.id})`,
    );
  }

  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: base.id,
  });
  const addresses = getAddresses(base.id);

  const rehypeDopplerHookAddress = addresses.rehypeDopplerHookInitializer;
  console.log("rehype initializer", addresses.rehypeDopplerHookInitializer)
  if (!rehypeDopplerHookAddress) {
    throw new Error(
      'Base mainnet RehypeDopplerHookInitializer is not configured in SDK deployments',
    );
  }
  if (!addresses.dopplerHookInitializer) {
    throw new Error(
      'Base mainnet DopplerHookInitializer is not configured in SDK deployments',
    );
  }
  if (!addresses.noOpMigrator) {
    throw new Error(
      'Base mainnet NoOpMigrator is not configured in SDK deployments',
    );
  }

  // Fetch current ETH price
  console.log('Fetching current ETH price from CoinGecko...');
  const ethPriceUsd = await getEthPriceUsd();
  console.log('Current ETH price: $' + ethPriceUsd.toLocaleString());

  // Get the Airlock owner address (required beneficiary with minimum 5% shares)
  const airlockOwnerAbi = [
    {
      name: 'owner',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'address' }],
    },
  ] as const;

  const airlockOwner = (await publicClient.readContract({
    address: addresses.airlock,
    abi: airlockOwnerAbi,
    functionName: 'owner',
  })) as Address;

  console.log('Airlock owner:', airlockOwner);

  // Define beneficiaries (required for RehypeDopplerHook)
  // Airlock owner must have >= 5% shares
  const beneficiaries = [
    { beneficiary: BUYBACK_DESTINATION, shares: 950_000_000_000_000_000n }, // 95%
    { beneficiary: airlockOwner, shares: 50_000_000_000_000_000n }, // 5%
  ];

  // Rehype decay needs an explicit future start time; defaulting to 0 would
  // cause the schedule to appear already decayed on deployment.
  const latestBlock = await publicClient.getBlock();
  const rehypeStartingTime =
    Number(latestBlock.timestamp) + REHYPE_START_DELAY_SECONDS;

  // Build multicurve using market cap ranges + RehypeDopplerHook
  console.log(addresses.dopplerHookInitializer)
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Rehype MarketCap Token',
      symbol: 'RMC',
      tokenURI: 'ipfs://rehype-marketcap-example',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale
      numeraire: addresses.weth,
    })
    // Easy mode: use market cap ranges instead of raw ticks
    .withCurves({
      numerairePrice: ethPriceUsd,
      curves: [
        {
          marketCap: { start: 500_000, end: 1_500_000 }, // $500k - $1.5M
          numPositions: 10,
          shares: parseEther('0.3'), // 30%
        },
        {
          marketCap: { start: 1_000_000, end: 5_000_000 }, // $1M - $5M
          numPositions: 15,
          shares: parseEther('0.4'), // 40%
        },
        {
          marketCap: { start: 4_000_000, end: 50_000_000 }, // $4M - $50M
          numPositions: 10,
          shares: parseEther('0.3'), // 30%
        },
      ],
      beneficiaries, // Required for RehypeDopplerHook
    })
    // graduationMarketCap uses numerairePrice from withCurves() for tick conversion
    .withRehypeDopplerHook({
      hookAddress: rehypeDopplerHookAddress,
      buybackDestination: BUYBACK_DESTINATION,
      startFee: REHYPE_START_FEE,
      endFee: REHYPE_END_FEE,
      durationSeconds: REHYPE_DURATION_SECONDS,
      startingTime: rehypeStartingTime,
      feeRoutingMode: 0,
      feeDistributionInfo: {
        assetFeesToAssetBuybackWad: 200_000_000_000_000_000n, // 20%
        assetFeesToNumeraireBuybackWad: 200_000_000_000_000_000n, // 20%
        assetFeesToBeneficiaryWad: 300_000_000_000_000_000n, // 30%
        assetFeesToLpWad: 300_000_000_000_000_000n, // 30%
        numeraireFeesToAssetBuybackWad: 200_000_000_000_000_000n,
        numeraireFeesToNumeraireBuybackWad: 200_000_000_000_000_000n,
        numeraireFeesToBeneficiaryWad: 300_000_000_000_000_000n,
        numeraireFeesToLpWad: 300_000_000_000_000_000n,
      },
      graduationMarketCap: 40_000_000, // $40M graduation target (within curve range)
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .withDopplerHookInitializer(addresses.dopplerHookInitializer)
    .withNoOpMigrator(addresses.noOpMigrator)
    .build();

  console.log(rehypeDopplerHookAddress)
  console.log("initializer", addresses.dopplerHookInitializer)

  console.log('\nMulticurve Configuration:');
  console.log('  Network: Base mainnet');
  console.log('  Execute mainnet:', executeMainnet ? 'yes' : 'no (simulation only)');
  console.log('  Token:', params.token.name, '(' + params.token.symbol + ')');
  console.log('  Curves:', params.pool.curves.length);
  console.log(
    '  Far tick (from graduationMarketCap):',
    params.dopplerHook?.farTick,
  );
  console.log('  Beneficiaries:', params.pool.beneficiaries?.length);

  console.log('\nMarket Cap Targets:');
  console.log('  Launch price: $500,000');
  console.log('  Highest curve end: $50,000,000');
  console.log(
    '  Graduation target: $40,000,000 (before max, demonstrating flexibility)',
  );

  console.log('\nRehypeDopplerHook Fee Distribution:');
  console.log('  Start fee: 800000 (80%)');
  console.log('  End fee: 10000 (1%)');
  console.log('  Duration: 15 seconds');
  console.log('  Starts at unix time:', rehypeStartingTime);
  console.log('  Asset buyback: 20%');
  console.log('  Numeraire buyback: 20%');
  console.log('  Beneficiaries: 30%');
  console.log('  LPs: 30%');

  try {
    // Simulate to preview addresses
    const simulation = await sdk.factory.simulateCreateMulticurve(params);
    console.log('\nSimulation successful:');
    console.log('  Predicted token:', simulation.tokenAddress);
    console.log('  Predicted pool ID:', simulation.poolId);
    console.log('  Gas estimate:', simulation.gasEstimate?.toString());

    if (!executeMainnet) {
      console.log(
        '\nSkipping execution. Set EXECUTE_MAINNET=true to broadcast on Base mainnet.',
      );
      return;
    }

    // Execute
    const result = await simulation.execute();

    console.log('\nMulticurve created successfully!');
    console.log('  Token address:', result.tokenAddress);
    console.log('  Pool ID:', result.poolId);
    console.log('  Transaction:', result.transactionHash);

    console.log('\nFee Flow Summary:');
    console.log('  On each swap, fees decay from 80% to 1% over 15 seconds.');
    console.log('  - 20% used to buy back ' + params.token.symbol);
    console.log('  - 20% kept as WETH (sent to buyback destination)');
    console.log('  - 30% streamed to beneficiaries');
    console.log('  - 30% distributed to liquidity providers');

    const deploymentReceipt = await publicClient.getTransactionReceipt({
      hash: result.transactionHash as `0x${string}`,
    });
    const deploymentBlock = await publicClient.getBlock({
      blockNumber: deploymentReceipt.blockNumber,
    });
    const swapTimestamp =
      Number(deploymentBlock.timestamp) + REHYPE_START_DELAY_SECONDS;

    console.log('\nPreparing post-deploy buy...');
    console.log('  Swap amount:', formatEther(SWAP_AMOUNT_IN), 'ETH');
    console.log('  Target unix time:', swapTimestamp);

    await waitUntilTimestamp(
      swapTimestamp,
      publicClient,
      'post-deploy swap window',
    );

    const multicurvePool = await sdk.getMulticurvePool(result.tokenAddress);
    const poolState = await multicurvePool.getState();
    const poolKey = poolState.poolKey;
    const zeroForOne =
      poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase();

    console.log('\nQuoting live buy...');
    console.log(
      '  Direction:',
      zeroForOne ? 'ETH/WETH → Token' : 'Token → ETH/WETH',
    );
    console.log('  Amount in:', formatEther(SWAP_AMOUNT_IN), 'ETH');
    const quote = await sdk.quoter.quoteExactInputV4({
      poolKey,
      zeroForOne,
      exactAmount: SWAP_AMOUNT_IN,
      hookData: '0x',
    });
    if (quote.amountOut <= 0n) {
      throw new Error('Post-deploy buy quote returned zero output');
    }

    const minAmountOut =
      (quote.amountOut * (10_000n - POST_DEPLOY_SWAP_SLIPPAGE_BPS)) / 10_000n;

    console.log(
      '  Simulated amount out:',
      formatEther(quote.amountOut),
      params.token.symbol,
    );
    console.log('  Gas estimate:', quote.gasEstimate.toString());
    console.log(
      '  Min amount out:',
      formatEther(minAmountOut),
      params.token.symbol,
      `(slippage ${POST_DEPLOY_SWAP_SLIPPAGE_BPS} bps)`,
    );

    const [commands, inputs] = buildBuyEthV4Commands({
      weth: addresses.weth,
      amountIn: SWAP_AMOUNT_IN,
      minAmountOut,
      recipient: account.address,
      universalRouterAddress: addresses.universalRouter,
      tokenAddress: result.tokenAddress,
      poolKey,
    });
    const latestSwapBlock = await publicClient.getBlock();
    const deadline = latestSwapBlock.timestamp + 30n * 60n;

    console.log('\nSimulating post-deploy buy...');
    await publicClient.simulateContract({
      address: addresses.universalRouter,
      abi: universalRouterAbi,
      functionName: 'execute',
      args: [commands, inputs, deadline],
      account: account.address,
      value: SWAP_AMOUNT_IN,
    });

    console.log('\nExecuting post-deploy buy...');
    const swapHash = await walletClient.writeContract({
      address: addresses.universalRouter,
      abi: universalRouterAbi,
      functionName: 'execute',
      args: [commands, inputs, deadline],
      value: SWAP_AMOUNT_IN,
    });
    const swapReceipt = await publicClient.waitForTransactionReceipt({
      hash: swapHash,
    });
    if (swapReceipt.status !== 'success') {
      throw new Error('Post-deploy buy transaction reverted');
    }
    const tokenBalance = (await publicClient.readContract({
      address: result.tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    })) as bigint;

    console.log('\nPost-deploy buy completed!');
    console.log('  Swap transaction:', swapReceipt.transactionHash);
    console.log('  Gas used:', swapReceipt.gasUsed.toString());
    console.log(
      '  Wallet token balance:',
      formatEther(tokenBalance),
      params.token.symbol,
    );
  } catch (error) {
    console.error('\nError creating multicurve:', error);
    process.exit(1);
  }
}

main();
