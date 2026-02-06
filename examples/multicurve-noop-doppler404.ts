/**
 * Example: Base Sepolia Multicurve + NoOp (No Migration) + Doppler404 (DN404-style) Token
 *
 * This example demonstrates:
 * - Creating a multicurve (Uniswap V4 initializer) pool
 * - Using NoOp migration (no post-auction liquidity migration)
 * - Creating a Doppler404 token (DN404-style) via `tokenConfig({ type: 'doppler404', ... })`
 * - Using lockable beneficiaries so fees can be collected/distributed without migrating liquidity
 *
 * Safety:
 * - By default, this script ONLY simulates `Airlock.create(...)` and prints the predicted addresses.
 * - To broadcast the transaction, set `EXECUTE=1`.
 *
 * Requirements:
 * - `PRIVATE_KEY` (funded on Base Sepolia)
 * - `RPC_URL` (Base Sepolia RPC)
 */
import './env';

import { DopplerSDK, FEE_TIERS, WAD, getAddresses } from '../src';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];
const shouldExecute =
  process.env.EXECUTE === '1' || process.env.EXECUTE?.toLowerCase() === 'true';

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

  // For NoOp migration, you MUST provide beneficiaries.
  // The Airlock owner must receive >= 5% shares (the contracts validate this).
  const airlockBeneficiary = await sdk.getAirlockBeneficiary(WAD / 10n); // 10% to Airlock owner
  const beneficiaries = [
    airlockBeneficiary,
    { beneficiary: account.address, shares: WAD - airlockBeneficiary.shares }, // remaining 90% to deployer
  ];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'doppler404',
      name: 'Doppler404 Multicurve (NoOp)',
      symbol: 'D404',
      // This should be a baseURI that resolves tokenIds -> metadata (e.g. IPFS folder CID).
      baseURI: 'ipfs://REPLACE_WITH_YOUR_BASE_URI/',
      // IMPORTANT:
      // Doppler404/DN404-style tokens have a "unit" used for the ERC20 <-> ERC721 relationship.
      // When using 18-decimal token amounts (we do, via `WAD`), set unit in the same base units.
      // Example: 1000 whole tokens per NFT => 1000 * 1e18.
      unit: 1000n * WAD,
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth, // WETH on Base Sepolia
    })
    .withMarketCapPresets({
      // Standard tier: 500 (0.05%) with tickSpacing auto-derived
      fee: FEE_TIERS.LOW,
      beneficiaries,
    })
    // Governance is independent of migration. `noOp` keeps governance minimal if enabled on-chain.
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .build();

  console.log('📋 Multicurve (NoOp) Doppler404 Configuration:');
  console.log('  Chain:', baseSepolia.name, `(${baseSepolia.id})`);
  console.log('  Deployer:', account.address);
  console.log('  Token:', params.token.name, `(${params.token.symbol})`, params.token.type);
  console.log('  Numeraire:', params.sale.numeraire);
  console.log('  Curves:', params.pool.curves.length);
  console.log('  Beneficiaries:', params.pool.beneficiaries?.length);
  console.log('  Governance:', params.governance.type);
  console.log('  Migration:', params.migration.type);

  console.log('\n🔎 Simulating Airlock.create(...) (no transaction sent)...');
  const sim = await sdk.factory.simulateCreateMulticurve(params);
  console.log('✅ Simulation OK');
  console.log('  Predicted token address:', sim.tokenAddress);
  console.log('  Predicted poolId:', sim.poolId);
  if (sim.gasEstimate) console.log('  Gas estimate:', sim.gasEstimate.toString());

  if (!shouldExecute) {
    console.log('\nSkipping execution. To broadcast, set EXECUTE=1');
    return;
  }

  console.log('\n🚀 Broadcasting create transaction...');
  const result = await sim.execute();
  console.log('✅ Multicurve created successfully!');
  console.log('  Token address:', result.tokenAddress);
  console.log('  Pool ID:', result.poolId);
  console.log('  Transaction:', result.transactionHash);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
