/**
 * Example: Create a Multicurve Auction with Per-Beneficiary Vesting Schedules
 *
 * Demonstrates DERC20 V2 vesting where each beneficiary provides an explicit
 * allocation and schedule. The SDK dedupes identical schedules internally.
 *
 * This script simulates by default. Set EXECUTE=1 to broadcast on Base Sepolia.
 */
import './env';

import { CHAIN_IDS, DopplerSDK, WAD, getAddresses } from '../src/evm';
import { createPublicClient, createWalletClient, getAddress, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];
const shouldExecute = process.env.EXECUTE === '1';

if (!privateKey) throw new Error('PRIVATE_KEY is not set');

async function main() {
  const account = privateKeyToAccount(privateKey);
  const chainId = CHAIN_IDS.BASE_SEPOLIA;
  const addresses = getAddresses(chainId);

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
    chainId,
  });

  const teamWallet = account.address;
  const advisorWallet = getAddress(
    '0x00000000000000000000000000000000000000A1',
  );
  const treasuryWallet = getAddress(
    '0x00000000000000000000000000000000000000B2',
  );

  const teamSchedule = {
    duration: BigInt(180 * 24 * 60 * 60),
    cliffDuration: 30 * 24 * 60 * 60,
  };
  const longTailSchedule = {
    duration: BigInt(365 * 24 * 60 * 60),
    cliffDuration: 90 * 24 * 60 * 60,
  };
  const allocations = [
    {
      recipient: teamWallet,
      amount: parseEther('30000'),
      schedule: teamSchedule,
    },
    {
      recipient: advisorWallet,
      amount: parseEther('20000'),
      schedule: longTailSchedule,
    },
    {
      recipient: treasuryWallet,
      amount: parseEther('50000'),
      schedule: longTailSchedule,
    },
  ];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Per Schedule Vesting Token',
      symbol: 'PSVT',
      tokenURI: 'ipfs://per-schedule-vesting.json',
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth,
    })
    .poolConfig({
      fee: 0,
      tickSpacing: 8,
      curves: [
        {
          tickLower: 0,
          tickUpper: 240000,
          numPositions: 12,
          shares: parseEther('0.5'),
        },
        {
          tickLower: 16000,
          tickUpper: 240000,
          numPositions: 12,
          shares: parseEther('0.5'),
        },
      ],
    })
    .withVesting({
      allocations,
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build();

  console.log('Base Sepolia per-beneficiary vesting example');
  console.log('RPC:', rpcUrl);
  console.log('Execute:', shouldExecute);
  console.log('Beneficiaries:', allocations.map((allocation) => allocation.recipient));
  console.log(
    'Allocation schedule inputs:',
    allocations.map((allocation) => ({
      recipient: allocation.recipient,
      amount: allocation.amount.toString(),
      cliffDuration: allocation.schedule.cliffDuration.toString(),
      duration: allocation.schedule.duration.toString(),
    })),
  );

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
  console.log('✅ Multicurve created');
  console.log('Token address:', result.tokenAddress);
  console.log('Pool ID:', result.poolId);
  console.log('Transaction:', result.transactionHash);

  const token = sdk.getDerc20V2(result.tokenAddress);
  const scheduleCount = await token.getVestingScheduleCount();
  console.log('Vesting schedule count:', scheduleCount.toString());

  for (const { recipient } of allocations) {
    const scheduleIds = await token.getScheduleIdsOf(recipient);
    console.log('Recipient schedules:', {
      recipient,
      scheduleIds: scheduleIds.map((id) => id.toString()),
    });

    for (const scheduleId of scheduleIds) {
      const schedule = await token.getVestingSchedule(scheduleId);
      const vestingData = await token.getVestingDataForSchedule(
        recipient,
        scheduleId,
      );
      console.log('Schedule details:', {
        recipient,
        scheduleId: scheduleId.toString(),
        cliffDuration: schedule.cliffDuration.toString(),
        duration: schedule.duration.toString(),
        totalAmount: vestingData.totalAmount.toString(),
        releasedAmount: vestingData.releasedAmount.toString(),
      });
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
