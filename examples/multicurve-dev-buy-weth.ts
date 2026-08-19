import './env';

import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { DopplerSDK, WAD, getAddresses, weth9Abi } from '../src/evm';

const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];
if (!privateKey) throw new Error('PRIVATE_KEY is not set');

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
  const rehypeInitializer = addresses.rehypeDopplerHookInitializer;
  if (!rehypeInitializer) {
    throw new Error(
      'RehypeDopplerHookInitializer is not configured on Base Sepolia',
    );
  }
  const bundler = addresses.bundler;
  if (!bundler) {
    throw new Error('Bundler is not configured on Base Sepolia');
  }

  const exactAmountIn = parseEther('0.01');
  const protocolShares = WAD / 10n;
  const poolBeneficiaries = [
    await sdk.getAirlockBeneficiary(protocolShares),
    {
      beneficiary: account.address,
      shares: WAD - protocolShares,
    },
  ];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'WETH Dev Buy',
      symbol: 'WDB',
      tokenURI: 'ipfs://weth-dev-buy',
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth,
    })
    .withCurves({
      numerairePrice: 3000,
      curves: [
        {
          marketCap: { start: 500_000, end: 1_500_000 },
          numPositions: 10,
          shares: (WAD * 3n) / 10n,
        },
        {
          marketCap: { start: 1_000_000, end: 5_000_000 },
          numPositions: 15,
          shares: (WAD * 4n) / 10n,
        },
        {
          marketCap: { start: 4_000_000, end: 50_000_000 },
          numPositions: 10,
          shares: (WAD * 29n) / 100n,
        },
        {
          marketCap: { start: 50_000_000, end: 'max' },
          numPositions: 10,
          shares: WAD / 100n,
        },
      ],
      beneficiaries: poolBeneficiaries,
    })
    .withRehypeDopplerHookInitializer({
      hookAddress: rehypeInitializer,
      feeBeneficiaries: [
        {
          beneficiary: account.address,
          shares: WAD,
        },
      ],
      startFee: 12_000,
      endFee: 3_000,
      durationSeconds: 3_600,
      feeDistributionInfo: {
        assetFeesToAssetBuybackWad: 0n,
        assetFeesToNumeraireBuybackWad: 0n,
        assetFeesToBeneficiaryWad: WAD,
        assetFeesToLpWad: 0n,
        numeraireFeesToAssetBuybackWad: 0n,
        numeraireFeesToNumeraireBuybackWad: 0n,
        numeraireFeesToBeneficiaryWad: WAD,
        numeraireFeesToLpWad: 0n,
      },
    })
    .withFeeDistributionController(account.address)
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .withBundler(bundler)
    .withDevBuy({
      exactAmountIn,
      recipient: account.address,
      // Omit vesting to deliver the purchased tokens directly to recipient.
      vesting: {
        vestingDuration: 7n * 24n * 60n * 60n,
        cliffDuration: 24n * 60n * 60n,
        permissionlessClaim: false,
      },
    })
    .build();

  const wrapHash = await walletClient.writeContract({
    address: addresses.weth,
    abi: weth9Abi,
    functionName: 'deposit',
    value: exactAmountIn,
    account,
  });
  const wrapReceipt = await publicClient.waitForTransactionReceipt({
    hash: wrapHash,
  });
  if (wrapReceipt.status !== 'success') {
    throw new Error(`WETH deposit reverted: ${wrapHash}`);
  }

  const approvalHash = await walletClient.writeContract({
    address: addresses.weth,
    abi: weth9Abi,
    functionName: 'approve',
    args: [bundler, exactAmountIn],
    account,
  });
  const approvalReceipt = await publicClient.waitForTransactionReceipt({
    hash: approvalHash,
  });
  if (approvalReceipt.status !== 'success') {
    throw new Error(`WETH approval reverted: ${approvalHash}`);
  }

  const simulated = await sdk.factory.simulateCreateMulticurve(params);
  const result = await simulated.execute();
  console.log('Token:', result.tokenAddress);
  console.log('Transaction:', result.transactionHash);
  console.log('Dev buy output:', result.devBuy?.amountOut);
  console.log(
    'Dev buy vesting:',
    await sdk.getBundler(bundler).getVesting(result.tokenAddress),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
