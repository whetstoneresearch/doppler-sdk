import '../env';
import { setTimeout as delay } from 'node:timers/promises';

import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  erc20Abi,
  formatEther,
  http,
  parseEther,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  DopplerSDK,
  WAD,
  getAddresses,
  type BeneficiaryData,
} from '../../src/evm';

const universalRouterAbi = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) throw new Error('PRIVATE_KEY is not set');
const account = privateKeyToAccount(privateKey);

const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];
const swapAmount = parseEther(process.env.SWAP_AMOUNT_ETH ?? '0.001');

async function main() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== baseSepolia.id) {
    throw new Error(
      `RPC_URL must point to Base Sepolia (${baseSepolia.id}), but returned chain ${rpcChainId}`,
    );
  }
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const sdk = new DopplerSDK({
    chainId: baseSepolia.id,
    publicClient,
    walletClient,
  });
  const addresses = getAddresses(baseSepolia.id);
  const rehypeInitializer = addresses.rehypeDopplerHookInitializer;
  if (!rehypeInitializer) {
    throw new Error('RehypeDopplerHookInitializer is not deployed');
  }

  const airlockOwner = (await publicClient.readContract({
    address: addresses.airlock,
    abi: [
      {
        name: 'owner',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
      },
    ],
    functionName: 'owner',
  })) as Address;
  if (airlockOwner.toLowerCase() === account.address.toLowerCase()) {
    throw new Error(
      'PRIVATE_KEY must not belong to the Airlock owner in this example',
    );
  }
  const poolBeneficiaries: [BeneficiaryData] = [
    { beneficiary: airlockOwner, shares: WAD },
  ];
  const rehypeFeeBeneficiaries: [BeneficiaryData] = [
    { beneficiary: account.address, shares: WAD },
  ];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'standard',
      name: `Rehype Controller ${Date.now()}`,
      symbol: 'RHCTRL',
      tokenURI: 'ipfs://rehype-fee-distribution-controller',
    })
    .saleConfig({
      initialSupply: 1_000_000_000n * WAD,
      numTokensToSell: 900_000_000n * WAD,
      numeraire: addresses.weth,
    })
    .withCurves({
      numerairePrice: Number(process.env.NUMERAIRE_PRICE_USD ?? '4000'),
      fee: 0,
      tickSpacing: 8,
      beneficiaries: poolBeneficiaries,
      curves: [
        {
          marketCap: { start: 100_000, end: 'max' },
          numPositions: 16,
          shares: WAD,
        },
      ],
    })
    .withRehypeDopplerHookInitializer({
      hookAddress: rehypeInitializer,
      feeBeneficiaries: rehypeFeeBeneficiaries,
      startFee: 12_000,
      endFee: 12_000,
      durationSeconds: 0,
      feeDistributionInfo: {
        assetFeesToAssetBuybackWad: 0n,
        assetFeesToNumeraireBuybackWad: 0n,
        assetFeesToBeneficiaryWad: 0n,
        assetFeesToLpWad: WAD,
        numeraireFeesToAssetBuybackWad: 0n,
        numeraireFeesToNumeraireBuybackWad: 0n,
        numeraireFeesToBeneficiaryWad: 0n,
        numeraireFeesToLpWad: WAD,
      },
    })
    .withFeeDistributionController(account.address)
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .build();

  const existingAsset = process.env.ASSET_ADDRESS as Address | undefined;
  const existingPoolId = process.env.POOL_ID as Hex | undefined;
  if ((existingAsset === undefined) !== (existingPoolId === undefined)) {
    throw new Error('ASSET_ADDRESS and POOL_ID must be set together');
  }
  const created =
    existingAsset && existingPoolId
      ? { tokenAddress: existingAsset, poolId: existingPoolId }
      : await sdk.factory.createMulticurve(params);
  console.log('Asset:', created.tokenAddress);
  console.log('Pool ID:', created.poolId);
  if ('transactionHash' in created) {
    console.log('Create transaction:', created.transactionHash);
  }

  const hook = await sdk.getRehypeDopplerHookInitializer(rehypeInitializer);
  const adjustedDistribution = {
    assetFeesToAssetBuybackWad: 0n,
    assetFeesToNumeraireBuybackWad: 0n,
    assetFeesToBeneficiaryWad: WAD,
    assetFeesToLpWad: 0n,
    numeraireFeesToAssetBuybackWad: 0n,
    numeraireFeesToNumeraireBuybackWad: 0n,
    numeraireFeesToBeneficiaryWad: WAD,
    numeraireFeesToLpWad: 0n,
  };
  const { transactionHash: updateHash } = await hook.setFeeDistribution(
    created.poolId,
    adjustedDistribution,
  );
  console.log('Distribution update transaction:', updateHash);

  let distributionStored = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const stored = await hook.getFeeDistributionInfo(created.poolId);
    distributionStored =
      stored.numeraireFeesToBeneficiaryWad === WAD &&
      stored.numeraireFeesToLpWad === 0n;
    if (distributionStored) break;
    await delay(1_000);
  }
  if (!distributionStored) {
    throw new Error('Adjusted fee distribution was not stored');
  }

  const pool = await sdk.getMulticurvePool(created.tokenAddress);
  const state = await pool.getState();
  const poolKey = {
    currency0: state.poolKey.currency0,
    currency1: state.poolKey.currency1,
    fee: state.fee,
    tickSpacing: state.tickSpacing,
    hooks: state.poolKey.hooks,
  };
  const zeroForOne =
    poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase();
  const quote = await sdk.quoter.quoteExactInputV4({
    poolKey,
    zeroForOne,
    exactAmount: swapAmount,
    hookData: '0x',
  });
  const poolKeyAbi = {
    name: 'poolKey',
    type: 'tuple',
    components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
  } as const;
  const actionParams = [
    encodeAbiParameters(
      [
        {
          name: 'swapParams',
          type: 'tuple',
          components: [
            poolKeyAbi,
            { name: 'zeroForOne', type: 'bool' },
            { name: 'amountIn', type: 'uint128' },
            { name: 'amountOutMinimum', type: 'uint128' },
            { name: 'hookData', type: 'bytes' },
          ],
        },
      ],
      [
        {
          poolKey,
          zeroForOne,
          amountIn: swapAmount,
          amountOutMinimum: (quote.amountOut * 95n) / 100n,
          hookData: '0x',
        },
      ],
    ),
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bool' }],
      [zeroForOne ? poolKey.currency0 : poolKey.currency1, swapAmount, false],
    ),
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [zeroForOne ? poolKey.currency1 : poolKey.currency0, 0n],
    ),
  ];
  const encodedActions = '0x060b0f';
  const encodedCommands = '0x0b10';
  const inputs = [
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      ['0x0000000000000000000000000000000000000002', swapAmount],
    ),
    encodeAbiParameters(
      [{ type: 'bytes' }, { type: 'bytes[]' }],
      [encodedActions, actionParams],
    ),
  ];

  const swapHash = await walletClient.writeContract({
    address: addresses.universalRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [encodedCommands, inputs],
    value: swapAmount,
  });
  await publicClient.waitForTransactionReceipt({ hash: swapHash });
  console.log('Swap transaction:', swapHash);

  const claim = await hook.claimFees(created.poolId, { gas: 150_000n });
  const claimReceipt = await publicClient.getTransactionReceipt({
    hash: claim.transactionHash,
  });
  if (claimReceipt.status !== 'success') {
    throw new Error('Beneficiary fee claim reverted');
  }

  const transferLogs = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Transfer',
    logs: claimReceipt.logs,
  });
  const payoutFor = (token: Address) =>
    transferLogs.reduce(
      (total, log) =>
        log.address.toLowerCase() === token.toLowerCase() &&
        log.args.to.toLowerCase() === account.address.toLowerCase()
          ? total + log.args.value
          : total,
      0n,
    );
  const wethPayout = payoutFor(addresses.weth);
  const assetPayout = payoutFor(created.tokenAddress);
  console.log('Claim transaction:', claim.transactionHash);
  console.log('Beneficiary WETH payout:', formatEther(wethPayout));
  console.log('Beneficiary asset payout:', formatEther(assetPayout));
  if (wethPayout <= 0n && assetPayout <= 0n) {
    throw new Error('Adjusted fee distribution produced no beneficiary payout');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
