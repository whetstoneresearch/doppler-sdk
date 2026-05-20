/**
 * Example: Multicurve DopplerERC20V1 with Multi-Schedule Vesting + Governance
 *
 * This example builds the launch configuration only.
 * Call `.build()` when you are ready to create final factory params.
 */
import './env';

import { DAY_SECONDS, MulticurveBuilder, WAD } from '../src/evm';
import { getAddress, parseEther } from 'viem';
import { base } from 'viem/chains';

const userAddress = getAddress('0x1111111111111111111111111111111111111111');
const teamWallet = getAddress('0x2222222222222222222222222222222222222222');
const advisorWallet = getAddress('0x3333333333333333333333333333333333333333');
const treasuryWallet = getAddress('0x4444444444444444444444444444444444444444');
const weth = getAddress('0x4200000000000000000000000000000000000006');

const sixMonthVesting = {
  duration: 180n * BigInt(DAY_SECONDS),
  cliffDuration: 30 * DAY_SECONDS,
};
const oneYearVesting = {
  duration: 365n * BigInt(DAY_SECONDS),
  cliffDuration: 90 * DAY_SECONDS,
};
const twoYearVesting = {
  duration: 730n * BigInt(DAY_SECONDS),
  cliffDuration: 180 * DAY_SECONDS,
};

const multicurveDerc20V1Builder = MulticurveBuilder.forChain(base.id)
  .tokenConfig({
    type: 'dopplerERC20V1',
    name: 'Multicurve Vesting Governance Token',
    symbol: 'MVGT',
    tokenURI: 'ipfs://multicurve-vesting-governance-token.json',
    maxBalanceLimit: parseEther('10000'),
    balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
    controller: userAddress,
    // Vesting recipients are excluded from balance limits by DopplerERC20V1
    // when their allocations are initialized, so they do not need to be listed
    // in excludedFromBalanceLimit here.
  })
  .saleConfig({
    initialSupply: 1_000_000n * WAD,
    numTokensToSell: 900_000n * WAD,
    numeraire: weth,
  })
  .poolConfig({
    fee: 0,
    tickSpacing: 8,
    curves: [
      {
        tickLower: 0,
        tickUpper: 160_000,
        numPositions: 10,
        shares: parseEther('0.4'),
      },
      {
        tickLower: 80_000,
        tickUpper: 240_000,
        numPositions: 10,
        shares: parseEther('0.35'),
      },
      {
        tickLower: 160_000,
        tickUpper: 320_000,
        numPositions: 10,
        shares: parseEther('0.25'),
      },
    ],
  })
  .withVesting({
    allocations: [
      {
        recipient: teamWallet,
        amount: parseEther('20000'),
        schedule: sixMonthVesting,
      },
      // recipients can have multiple vesting schedules
      {
        recipient: teamWallet,
        amount: parseEther('30000'),
        schedule: twoYearVesting,
      },
      {
        recipient: advisorWallet,
        amount: parseEther('25000'),
        schedule: oneYearVesting,
      },
      {
        recipient: treasuryWallet,
        amount: parseEther('25000'),
        schedule: twoYearVesting,
      },
    ],
  })
  .withGovernance({ type: 'default' })
  .withUserAddress(userAddress);

export { multicurveDerc20V1Builder };
