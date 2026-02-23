/**
 * Example: Create a Dynamic Auction with DopplerHookMigrator + Rehype helper
 *
 * This example demonstrates dynamic-launch rehypothecation configuration.
 */
import './env';

import { DAY_SECONDS, DopplerSDK } from '../src';

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const rpcUrl = process.env.RPC_URL || baseSepolia.rpcUrls.default.http[0];

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

  // Required by Airlock/Doppler migrators: include protocol owner beneficiary
  // with at least 5% shares.
  const airlockBeneficiary = await sdk.getAirlockBeneficiary();

  const params = sdk
    .buildDynamicAuction()
    .tokenConfig({
      name: 'TEST DYNAMIC REHYPE',
      symbol: 'TDR',
      tokenURI: 'https://example.com/dynamic-rehype-token.json',
    })
    .saleConfig({
      initialSupply: parseEther('10000000'),
      numTokensToSell: parseEther('5000000'),
      numeraire: '0x4200000000000000000000000000000000000006',
    })
    .withMarketCapRange({
      marketCap: {
        start: 5_000_000,
        min: 500_000,
      },
      numerairePrice: 3000,
      fee: 3000,
      tickSpacing: 10,
      duration: 7 * DAY_SECONDS,
      epochLength: 12 * 3600,
      minProceeds: parseEther('0.0001'),
      maxProceeds: parseEther('0.0002'),
    })
    .withMigration({
      type: 'dopplerHook',
      fee: 3000,
      useDynamicFee: false,
      tickSpacing: 10,
      lockDuration: 30 * DAY_SECONDS,
      beneficiaries: [
        { beneficiary: account.address, shares: parseEther('0.95') },
        airlockBeneficiary,
      ],
      rehype: {
        buybackDestination: account.address,
        customFee: 3000,
        assetBuybackPercentWad: parseEther('0.25'),
        numeraireBuybackPercentWad: parseEther('0.25'),
        beneficiaryPercentWad: parseEther('0.25'),
        lpPercentWad: parseEther('0.25'),
      },
      proceedsSplit: {
        recipient: account.address,
        share: parseEther('0.1'),
      },
    })
    .withGovernance({ type: 'default' })
    .withUserAddress(account.address)
    .build();

  console.log(
    'Creating dynamic auction with dopplerHook migration (onchain tx)...',
  );
  console.log('Token:', params.token.name, `(${params.token.symbol})`);
  console.log('Selling:', formatEther(params.sale.numTokensToSell), 'tokens');

  // This submits a real transaction (not simulation-only) and launches the token.
  const result = await sdk.factory.createDynamicAuction(params);

  console.log('\n✅ Dynamic auction created successfully!');
  console.log('Hook address:', result.hookAddress);
  console.log('Token address:', result.tokenAddress);
  console.log('Pool ID:', result.poolId);
  console.log('Transaction:', result.transactionHash);
}

main().catch((error) => {
  console.error('\n❌ Error creating dynamic auction:', error);
  process.exit(1);
});
