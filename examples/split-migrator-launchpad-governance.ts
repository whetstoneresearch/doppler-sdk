/**
 * Example: split migrators with launchpad governance
 *
 * This example builds params only. Use the resulting params with
 * sdk.factory.simulateCreate* or sdk.factory.create* when ready.
 */
import './env';

import { DopplerSDK } from '../src/evm';
import { createPublicClient, http, parseEther, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';

const rpcUrl = process.env.RPC_URL || 'https://sepolia.base.org';
const exampleUserAddress =
  '0x1111111111111111111111111111111111111111' as Address;
const exampleSplitRecipient =
  '0x2222222222222222222222222222222222222222' as Address;
const exampleLaunchpadMultisig =
  '0x3333333333333333333333333333333333333333' as Address;
const exampleAirlockOwner =
  '0x4444444444444444444444444444444444444444' as Address;

async function main() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const sdk = new DopplerSDK({ publicClient, chainId: baseSepolia.id });

  const userAddress =
    (process.env.USER_ADDRESS as Address | undefined) ?? exampleUserAddress;
  const splitRecipient =
    (process.env.SPLIT_RECIPIENT as Address | undefined) ??
    exampleSplitRecipient;
  const launchpadMultisig =
    (process.env.LAUNCHPAD_MULTISIG as Address | undefined) ??
    exampleLaunchpadMultisig;
  const airlockBeneficiary = {
    beneficiary: exampleAirlockOwner,
    shares: parseEther('0.05'),
  };

  const v2SplitParams = sdk
    .buildStaticAuction()
    .tokenConfig({
      name: 'V2 Split Launch',
      symbol: 'V2S',
      tokenURI: 'https://example.com/v2-split.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: '0x4200000000000000000000000000000000000006',
    })
    .poolByTicks({ startTick: -276400, endTick: -276200, fee: 10000 })
    .withGovernance({ type: 'launchpad', multisig: launchpadMultisig })
    .withMigration({
      type: 'uniswapV2Split',
      proceedsSplit: { recipient: splitRecipient, share: parseEther('0.1') },
    })
    .withUserAddress(userAddress)
    .build();

  const v4SplitParams = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'V4 Split Launch',
      symbol: 'V4S',
      tokenURI: 'https://example.com/v4-split.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: '0x4200000000000000000000000000000000000006',
    })
    .poolConfig({
      fee: 3000,
      tickSpacing: 8,
      curves: [
        {
          tickLower: 0,
          tickUpper: 240000,
          numPositions: 10,
          shares: parseEther('1'),
        },
      ],
    })
    .withGovernance({ type: 'launchpad', multisig: launchpadMultisig })
    .withMigration({
      type: 'uniswapV4Split',
      fee: 3000,
      tickSpacing: 8,
      streamableFees: {
        lockDuration: 30 * 24 * 60 * 60,
        beneficiaries: [
          airlockBeneficiary,
          { beneficiary: splitRecipient, shares: parseEther('0.95') },
        ],
      },
      proceedsSplit: { recipient: splitRecipient, share: parseEther('0.1') },
    })
    .withUserAddress(userAddress)
    .build();

  console.log('V2 split params:', v2SplitParams);
  console.log('V4 split params:', v4SplitParams);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { main };
