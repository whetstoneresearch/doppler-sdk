import { address } from '@solana/addresses';
import { generateKeyPairSigner } from '@solana/signers';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { describe, expect, it } from 'vitest';

import { initializer, vesting } from '@/solana/index.js';
import {
  getClaimInstructionDataDecoder,
  getInitializeVestingInstructionDataDecoder,
} from '@/solana/generated/dopplerVesting/index.js';
import {
  getMigrateArgsDecoder,
  getRegisterLaunchArgsDecoder,
} from '@/solana/generated/cpmmMigrator/index.js';
import { getInitializeLaunchInstructionDataDecoder } from '@/solana/generated/initializer/index.js';

const INITIAL_SUPPLY = 1_000_000n;
const DAY_SECONDS = 86_400n;

async function prepareVestingLaunch({
  amount = 200_000n,
  durationSeconds = 30n * DAY_SECONDS,
  baseForLiquidity = 0n,
  migration,
}: {
  amount?: bigint;
  durationSeconds?: bigint;
  baseForLiquidity?: bigint;
  migration?: Parameters<typeof vesting.prepareLaunch>[0]['migration'];
} = {}) {
  const payer = await generateKeyPairSigner();
  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();

  const prepared = await vesting.prepareLaunch({
    launchAccounts: {
      baseMint,
      quoteMint: address('So11111111111111111111111111111111111111112'),
      baseVault,
      quoteVault,
    },
    payer,
    authority: payer,
    supply: {
      baseDecimals: 6,
      baseTotalSupply: INITIAL_SUPPLY,
      baseForLiquidity,
    },
    curve: {
      curveVirtualBase: INITIAL_SUPPLY,
      curveVirtualQuote: 10_000n,
      swapFeeBps: 100,
    },
    vesting: {
      schedules: [{ cliffSeconds: 0n, durationSeconds }],
      allocations: [{ beneficiary: payer.address, scheduleId: 0, amount }],
    },
    migration,
    metadata: null,
  });

  return { payer, baseMint, baseVault, prepared };
}

describe('vesting', () => {
  it('prepares the immutable config, launch, and funding instructions', async () => {
    const { payer, baseMint, baseVault, prepared } =
      await prepareVestingLaunch();
    const initializeVesting =
      getInitializeVestingInstructionDataDecoder().decode(
        prepared.initializeVestingInstruction.data!,
      );
    const initializeLaunch = getInitializeLaunchInstructionDataDecoder().decode(
      prepared.initializeLaunchInstruction.data!,
    );

    expect(prepared.totalAllocation).toBe(200_000n);
    expect(initializeVesting.initialSupply).toBe(INITIAL_SUPPLY);
    expect(initializeVesting.schedules).toEqual([
      { cliffSeconds: 0n, durationSeconds: 30n * DAY_SECONDS },
    ]);
    expect(initializeVesting.allocations).toEqual([
      { beneficiary: payer.address, scheduleId: 0, amount: 200_000n },
    ]);
    expect(initializeLaunch.baseForDistribution).toBe(200_000n);
    expect(initializeLaunch.baseForLiquidity).toBe(0n);
    expect(initializeLaunch.migratorInitPayload).toHaveLength(0);
    expect(initializeLaunch.migratorMigratePayload).toHaveLength(0);

    expect(prepared.initializeVestingInstruction.programAddress).toBe(
      vesting.DOPPLER_VESTING_PROGRAM_ADDRESS,
    );
    expect(prepared.initializeLaunchInstruction.accounts![18].address).toBe(
      prepared.vestingAddresses.config,
    );
    expect(prepared.fundVestingInstruction.programAddress).toBe(
      initializer.INITIALIZER_PROGRAM_ID,
    );
    expect(
      prepared.fundVestingInstruction.accounts!.map(({ address }) => address),
    ).toEqual([
      prepared.launchAddresses.launch,
      prepared.launchAddresses.launchAuthority,
      prepared.vestingAddresses.config,
      baseMint.address,
      baseVault.address,
      prepared.vestingAddresses.vault,
      payer.address,
      TOKEN_PROGRAM_ADDRESS,
      ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      SYSTEM_PROGRAM_ADDRESS,
    ]);
  });

  it('rejects schedules shorter than one day', async () => {
    await expect(
      prepareVestingLaunch({ durationSeconds: DAY_SECONDS - 1n }),
    ).rejects.toThrow(/duration must be zero or at least 86400 seconds/);
  });

  it('rejects allocations above 80 percent of supply', async () => {
    await expect(prepareVestingLaunch({ amount: 800_001n })).rejects.toThrow(
      /exceeds 80% of initial supply/,
    );
  });

  it('requires the launch to retain tokens for its bonding curve', async () => {
    await expect(
      prepareVestingLaunch({
        amount: 800_000n,
        baseForLiquidity: 200_000n,
        migration: true,
      }),
    ).rejects.toThrow(/leave base tokens for the bonding curve/);
  });

  it('uses only the liquidity allocation in a CPMM migration payload', async () => {
    const { prepared } = await prepareVestingLaunch({
      baseForLiquidity: 100_000n,
      migration: { minRaiseQuote: 1n },
    });
    const initializeLaunch = getInitializeLaunchInstructionDataDecoder().decode(
      prepared.initializeLaunchInstruction.data!,
    );
    const migration = getMigrateArgsDecoder().decode(
      initializeLaunch.migratorMigratePayload.slice(8),
    );
    const registration = getRegisterLaunchArgsDecoder().decode(
      initializeLaunch.migratorInitPayload.slice(8),
    );

    expect(initializeLaunch.baseForDistribution).toBe(200_000n);
    expect(initializeLaunch.baseForLiquidity).toBe(100_000n);
    expect(registration.minRaiseQuote).toBe(1n);
    expect(registration.recipients).toEqual([]);
    expect(migration).toEqual({
      baseForDistribution: 0n,
      baseForLiquidity: 100_000n,
    });
  });

  it('requires explicit migration settings for a vesting launch', async () => {
    await expect(prepareVestingLaunch({ migration: true })).rejects.toThrow(
      /explicit CPMM config with a positive minRaiseQuote/,
    );
  });

  it('rejects CPMM migration recipients for a vesting launch', async () => {
    const recipient = await generateKeyPairSigner();

    await expect(
      prepareVestingLaunch({
        migration: {
          minRaiseQuote: 1n,
          recipients: [{ wallet: recipient.address, amount: 1n }],
        },
      }),
    ).rejects.toThrow(/does not support migration recipients/);
  });

  it('prepares a permissionless claim to the beneficiary ATA', async () => {
    const payer = await generateKeyPairSigner();
    const beneficiary = await generateKeyPairSigner();
    const launch = await generateKeyPairSigner();
    const baseMint = await generateKeyPairSigner();
    const claim = await vesting.prepareClaim({
      payer,
      beneficiary: beneficiary.address,
      launch: launch.address,
      baseMint: baseMint.address,
    });
    const data = getClaimInstructionDataDecoder().decode(
      claim.instruction.data!,
    );

    expect(data.amount).toBe(0n);
    expect(claim.instruction.accounts!.map(({ address }) => address)).toEqual([
      payer.address,
      beneficiary.address,
      launch.address,
      claim.config,
      baseMint.address,
      claim.vault,
      claim.beneficiaryTokenAccount,
      TOKEN_PROGRAM_ADDRESS,
      ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
      SYSTEM_PROGRAM_ADDRESS,
    ]);
  });
});
