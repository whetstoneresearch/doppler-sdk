/**
 * Base Sepolia Rehype launch with three fee beneficiaries.
 *
 * Simulates by default. Set EXECUTE=1 to broadcast, with
 * REHYPE_FEE_BENEFICIARY_2 and REHYPE_FEE_BENEFICIARY_3 configured as real
 * recipient addresses.
 */
import '../env';

import { CHAIN_IDS, DopplerSDK, WAD, getAddresses } from '../../src/evm';
import type { BeneficiaryData } from '../../src/evm';
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  isHex,
  parseEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

async function main(): Promise<void> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || !isHex(privateKey)) {
    throw new Error('PRIVATE_KEY must be a 0x-prefixed hex string');
  }

  const shouldExecute = process.env.EXECUTE === '1';
  const secondBeneficiary = readOptionalAddress('REHYPE_FEE_BENEFICIARY_2');
  const thirdBeneficiary = readOptionalAddress('REHYPE_FEE_BENEFICIARY_3');
  if (shouldExecute && (!secondBeneficiary || !thirdBeneficiary)) {
    throw new Error(
      'REHYPE_FEE_BENEFICIARY_2 and REHYPE_FEE_BENEFICIARY_3 are required when EXECUTE=1',
    );
  }

  const account = privateKeyToAccount(privateKey);
  const chainId = CHAIN_IDS.BASE_SEPOLIA;
  const addresses = getAddresses(chainId);
  const rehypeDopplerHookInitializer = addresses.rehypeDopplerHookInitializer;
  if (!rehypeDopplerHookInitializer) {
    throw new Error(
      'Base Sepolia RehypeDopplerHookInitializer is not configured',
    );
  }

  const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account,
  });
  const sdk = new DopplerSDK({ publicClient, walletClient, chainId });

  const poolAirlockBeneficiary = await sdk.getAirlockBeneficiary(WAD / 20n);
  // Rehype fee beneficiaries do not include airlock owner as the rehype hook automatically applies its 5% fee,
  // prior to routing the remainder to beneficiaries accordingly.
  const rehypeFeeBeneficiaries = [
    { beneficiary: account.address, shares: WAD / 2n },
    {
      beneficiary:
        secondBeneficiary ??
        getAddress('0x0000000000000000000000000000000000000001'),
      shares: (WAD * 3n) / 10n,
    },
    {
      beneficiary:
        thirdBeneficiary ??
        getAddress('0x0000000000000000000000000000000000000002'),
      shares: WAD / 5n,
    },
  ] satisfies [BeneficiaryData, ...BeneficiaryData[]];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'standard',
      name: 'Rehype Fee Beneficiaries',
      symbol: 'RFB',
      tokenURI: 'ipfs://rehype-fee-beneficiaries.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'),
      numTokensToSell: parseEther('1000000000'),
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
        poolAirlockBeneficiary,
        {
          beneficiary: account.address,
          shares: WAD - poolAirlockBeneficiary.shares,
        },
      ],
    })
    .withRehypeDopplerHookInitializer({
      hookAddress: rehypeDopplerHookInitializer,
      feeBeneficiaries: rehypeFeeBeneficiaries,
      startFee: 3_000,
      endFee: 3_000,
      durationSeconds: 0,
      feeDistributionInfo: {
        assetFeesToAssetBuybackWad: 0n,
        assetFeesToNumeraireBuybackWad: WAD,
        assetFeesToBeneficiaryWad: 0n,
        assetFeesToLpWad: 0n,
        numeraireFeesToAssetBuybackWad: 0n,
        numeraireFeesToNumeraireBuybackWad: 0n,
        numeraireFeesToBeneficiaryWad: WAD,
        numeraireFeesToLpWad: 0n,
      },
      farTick: 200_000,
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .build();

  console.log('Base Sepolia Rehype fee-beneficiary example');
  console.log('Deployer:', account.address);
  console.log('Rehype beneficiaries:', rehypeFeeBeneficiaries);

  const simulation = await sdk.factory.simulateCreateMulticurve(params);
  console.log('Simulation OK');
  console.log('Predicted token:', simulation.tokenAddress);
  console.log('Predicted pool id:', simulation.poolId);
  console.log('Estimated gas:', simulation.gasEstimate?.toString() ?? 'n/a');

  if (!shouldExecute) {
    console.log('Skipping broadcast. Set EXECUTE=1 to create the launch.');
    return;
  }

  const result = await simulation.execute();
  console.log('Created token:', result.tokenAddress);
  console.log('Pool id:', result.poolId);
  console.log('Transaction:', result.transactionHash);
}

function readOptionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`${name} must be an address`);
  return getAddress(value);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  } else {
    console.error('Error:', String(error));
  }
  process.exitCode = 1;
});
