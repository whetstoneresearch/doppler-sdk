import './env';

import { randomBytes } from 'node:crypto';
import {
  CHAIN_IDS,
  DopplerSDK,
  WAD,
  getAddresses,
  verifyPreparedCreateExecution,
} from '../src/evm';
import { createPublicClient, createWalletClient, http, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const shouldExecute = process.env.EXECUTE_TRANSACTION === 'true';

if (!rpcUrl) throw new Error('RPC_URL must be set to a Base Sepolia endpoint');
if (!privateKey) throw new Error('PRIVATE_KEY must be set');
const account = privateKeyToAccount(privateKey);

async function main(): Promise<void> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== CHAIN_IDS.BASE_SEPOLIA) {
    throw new Error(
      `Expected Base Sepolia chain ${CHAIN_IDS.BASE_SEPOLIA}, received ${rpcChainId}`,
    );
  }

  const addresses = getAddresses(CHAIN_IDS.BASE_SEPOLIA);
  const rehypeHook = addresses.rehypeDopplerHookInitializer;
  if (!rehypeHook) {
    throw new Error('Base Sepolia Rehype hook address is required');
  }

  const sdk = new DopplerSDK({
    publicClient,
    chainId: CHAIN_IDS.BASE_SEPOLIA,
  });
  const protocolBeneficiary = await sdk.getAirlockBeneficiary(WAD / 10n);
  const salt = toHex(randomBytes(32));
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'External Executor Rehype Token',
      symbol: 'EERT',
      tokenURI: 'ipfs://external-executor-rehype-token',
    })
    .saleConfig({
      initialSupply: 1_000_000_000n * WAD,
      numTokensToSell: 1_000_000_000n * WAD,
      numeraire: addresses.weth,
    })
    .poolConfig({
      fee: 0,
      tickSpacing: 8,
      curves: Array.from({ length: 10 }, (_, index) => ({
        tickLower: index * 16_000,
        tickUpper: 240_000,
        numPositions: 10,
        shares: WAD / 10n,
      })),
      beneficiaries: [
        protocolBeneficiary,
        { beneficiary: account.address, shares: (WAD * 9n) / 10n },
      ],
    })
    .withRehypeDopplerHookInitializer({
      hookAddress: rehypeHook,
      buybackDestination: account.address,
      startFee: 3000,
      endFee: 3000,
      durationSeconds: 0,
      feeRoutingMode: 0,
      feeDistributionInfo: {
        assetFeesToAssetBuybackWad: WAD / 4n,
        assetFeesToNumeraireBuybackWad: WAD / 4n,
        assetFeesToBeneficiaryWad: WAD / 4n,
        assetFeesToLpWad: WAD / 4n,
        numeraireFeesToAssetBuybackWad: WAD / 4n,
        numeraireFeesToNumeraireBuybackWad: WAD / 4n,
        numeraireFeesToBeneficiaryWad: WAD / 4n,
        numeraireFeesToLpWad: WAD / 4n,
      },
      farTick: 200_000,
    })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .withSalt(salt)
    .build();

  const prepared = await sdk.factory.prepareCreateMulticurve(params, {
    account: account.address,
  });
  console.log('Prepared Airlock:', prepared.airlock);
  console.log('Prepared sender:', prepared.account);
  console.log('Predicted token:', prepared.prediction.tokenAddress);
  console.log('Predicted pool or hook:', prepared.prediction.poolOrHookAddress);
  console.log('Predicted pool ID:', prepared.prediction.poolId);
  console.log('Gas status:', prepared.gasEstimate.status);

  if (!shouldExecute) {
    console.log(
      'Transaction not broadcast. Set EXECUTE_TRANSACTION=true to submit it.',
    );
    return;
  }

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account,
  });
  const hash = await walletClient.sendTransaction({
    account,
    chain: baseSepolia,
    ...prepared.transaction,
    ...(prepared.gasEstimate.status === 'estimated'
      ? { gas: prepared.gasEstimate.gas }
      : {}),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  // The execution verifier includes receipt checks and also retrieves the
  // mined transaction to confirm its exact input and value.
  const verified = await verifyPreparedCreateExecution({
    prepared,
    receipt,
    publicClient,
  });

  console.log('Transaction hash:', receipt.transactionHash);
  console.log('Block number:', receipt.blockNumber.toString());
  console.log('Receipt token:', verified.receiptIdentity.tokenAddress);
  console.log(
    'Receipt pool or hook:',
    verified.receiptIdentity.poolOrHookAddress,
  );
  console.log(
    'Prepared governance:',
    verified.preparedIdentity.governanceAddress,
  );
  console.log('Prepared timelock:', verified.preparedIdentity.timelockAddress);
  console.log(
    'Prepared migration pool:',
    verified.preparedIdentity.migrationPoolAddress,
  );
  console.log('Prepared pool ID:', verified.preparedIdentity.poolId);
  console.log(
    'Prepared token is currency0:',
    verified.preparedIdentity.tokenIsCurrency0,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
