/**
 * Example: Create a Multicurve Pool with RehypeDopplerHookInitializer using Market Cap Ranges on Base Mainnet
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
 * - BUYBACK_DESTINATION (defaults to the deployer account)
 *
 * This example demonstrates a RehypeDopplerHookInitializer configured for WETH/numeraire
 * accrual:
 * - Using withCurves() with market cap ranges (no tick math required)
 * - Setting graduationMarketCap to define when the pool can graduate
 * - Routing 100% of distributable fees into WETH/numeraire
 * - Accruing those WETH fees until collectFees(asset) transfers them to the
 *   buyback destination
 * - Contrasting routeToBeneficiaryFees with directBuyback:
 *   - directBuyback transfers buyback outputs during hook processing
 *   - routeToBeneficiaryFees records buyback outputs as claimable hook fees
 * - Live ETH price fetching for accurate market cap calculations
 * - Executing a small follow-up buy and demonstrating fee collection
 */
import '../env';

import {
  CommandBuilder,
  CommandType,
  V4ActionBuilder,
  V4ActionType,
} from 'doppler-router';
import { DAY_SECONDS, DopplerSDK, getAddresses } from '../../src/evm';
import {
  parseEther,
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  isAddress,
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
const BALANCE_LIMIT_DURATION_SECONDS = 1 * DAY_SECONDS;
const SWAP_AMOUNT_IN = parseEther('0.00001');
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

function optionalAddressEnv(name: string): Address | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  if (!isAddress(value)) {
    throw new Error(`${name} must be a valid EVM address`);
  }
  return getAddress(value);
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
  const claimableNumeraireRecipient =
    optionalAddressEnv('BUYBACK_DESTINATION') ?? account.address;

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

  const rehypeDopplerHookInitializerAddress =
    addresses.rehypeDopplerHookInitializer;
  if (!rehypeDopplerHookInitializerAddress) {
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

  // Pool beneficiaries are still required by the initializer. They are distinct
  // from Rehype's claimable fee accounting, which routes to the claim recipient.
  // Airlock owner must have >= 5% shares.
  const beneficiaries = [
    {
      beneficiary: claimableNumeraireRecipient,
      shares: 950_000_000_000_000_000n,
    }, // 95%
    { beneficiary: airlockOwner, shares: 50_000_000_000_000_000n }, // 5%
  ];

  // Rehype decay needs an explicit future start time; defaulting to 0 would
  // cause the schedule to appear already decayed on deployment.
  const latestBlock = await publicClient.getBlock();
  const rehypeStartingTime =
    Number(latestBlock.timestamp) + REHYPE_START_DELAY_SECONDS;

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'dopplerERC20V1',
      name: 'Rehype MarketCap Token',
      symbol: 'RMC',
      tokenURI: 'ipfs://rehype-marketcap-example',
      maxBalanceLimit: parseEther('10000'),
      balanceLimitEnd:
        Math.floor(Date.now() / 1000) + BALANCE_LIMIT_DURATION_SECONDS,
      controller: account.address,
      excludedFromBalanceLimit: [account.address],
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
          shares: parseEther('0.29'),
        },
        {
          marketCap: { start: 50_000_000, end: 'max' },
          numPositions: 10,
          shares: parseEther('0.01'),
        },
      ],
      beneficiaries,
    })
    // graduationMarketCap uses numerairePrice from withCurves() for tick conversion
    .withRehypeDopplerHookInitializer({
      hookAddress: rehypeDopplerHookInitializerAddress,
      buybackDestination: claimableNumeraireRecipient,
      startFee: REHYPE_START_FEE,
      endFee: REHYPE_END_FEE,
      durationSeconds: REHYPE_DURATION_SECONDS,
      startingTime: rehypeStartingTime,
      feeRoutingMode: 'routeToBeneficiaryFees',
      feeDistributionInfo: {
        assetFeesToAssetBuybackWad: 0n,
        assetFeesToNumeraireBuybackWad: parseEther('1'),
        assetFeesToBeneficiaryWad: 0n,
        assetFeesToLpWad: 0n,
        numeraireFeesToAssetBuybackWad: 0n,
        numeraireFeesToNumeraireBuybackWad: parseEther('1'),
        numeraireFeesToBeneficiaryWad: 0n,
        numeraireFeesToLpWad: 0n,
      },
      graduationMarketCap: 40_000_000, // $40M graduation target (within curve range)
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .withDopplerHookInitializer(addresses.dopplerHookInitializer)
    .withNoOpMigrator(addresses.noOpMigrator)
    .build();

  console.log('\nMulticurve Configuration:');
  console.log('  Network: Base mainnet');
  console.log(
    '  Execute mainnet:',
    executeMainnet ? 'yes' : 'no (simulation only)',
  );
  console.log('  Token:', params.token.name, '(' + params.token.symbol + ')');
  console.log('  Curves:', params.pool.curves.length);
  console.log(
    '  Far tick (from graduationMarketCap):',
    params.dopplerHook?.farTick,
  );
  console.log('  Beneficiaries:', params.pool.beneficiaries?.length);
  console.log('  Claim recipient:', claimableNumeraireRecipient);

  console.log('\nMarket Cap Targets:');
  console.log('  Launch price: $500,000');
  console.log('  Highest finite curve end: $50,000,000');
  console.log('  Tail curve: $50,000,000+');
  console.log(
    '  Graduation target: $40,000,000 (before max, demonstrating flexibility)',
  );

  console.log('\nRehypeDopplerHookInitializer Fee Distribution:');
  console.log('  Start fee: 800000 (80%)');
  console.log('  End fee: 10000 (1%)');
  console.log('  Duration: 15 seconds');
  console.log('  Starts at unix time:', rehypeStartingTime);
  console.log('  Routing mode: routeToBeneficiaryFees (claimable accrual)');
  console.log('  Asset-denominated fees: 100% swapped to WETH');
  console.log('  WETH-denominated fees: 100% kept as WETH');
  console.log('  Beneficiary and LP fee shares: 0%');
  console.log('  Claim recipient:', claimableNumeraireRecipient);

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
    console.log('  - Asset-denominated hook fees are swapped into WETH.');
    console.log('  - WETH-denominated hook fees remain WETH.');
    console.log(
      '  - routeToBeneficiaryFees accrues WETH as claimable hook fees.',
    );
    console.log(
      '  - directBuyback would transfer buyback outputs during hook processing.',
    );
    console.log(
      '  - collectFees(asset) transfers claimable fees to the buyback destination.',
    );

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
    const wethIsCurrency0 =
      poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase();
    const zeroForOne = wethIsCurrency0;

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

    const rehypeHookInitializer = await sdk.getRehypeDopplerHookInitializer(
      rehypeDopplerHookInitializerAddress,
    );
    const routingMode = await rehypeHookInitializer.getFeeRoutingMode(
      result.poolId,
    );
    const hookFees = await rehypeHookInitializer.getHookFees(result.poolId);
    const claimableWeth = wethIsCurrency0
      ? hookFees.beneficiaryFees0
      : hookFees.beneficiaryFees1;
    const claimableToken = wethIsCurrency0
      ? hookFees.beneficiaryFees1
      : hookFees.beneficiaryFees0;

    console.log('\nClaimable Rehype fees:');
    console.log('  Routing mode:', routingMode, '(1 = routeToBeneficiaryFees)');
    console.log('  Claim recipient:', claimableNumeraireRecipient);
    console.log('  Claimable WETH:', formatEther(claimableWeth));
    console.log(
      '  Claimable token:',
      formatEther(claimableToken),
      params.token.symbol,
    );

    if (claimableWeth > 0n || claimableToken > 0n) {
      const collection = await rehypeHookInitializer.collectFees(
        result.tokenAddress,
      );
      const collectedWeth = wethIsCurrency0
        ? collection.amount0
        : collection.amount1;
      const collectedToken = wethIsCurrency0
        ? collection.amount1
        : collection.amount0;

      console.log('\nCollected Rehype fees!');
      console.log('  Collection transaction:', collection.transactionHash);
      console.log('  Collected WETH:', formatEther(collectedWeth));
      console.log(
        '  Collected token:',
        formatEther(collectedToken),
        params.token.symbol,
      );
    } else {
      console.log(
        '  No claimable fees yet. Run collectFees(asset) after additional swaps.',
      );
    }
  } catch (error) {
    console.error('\nError creating multicurve:', error);
    process.exit(1);
  }
}

main();
