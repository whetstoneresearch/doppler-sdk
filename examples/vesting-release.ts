/**
 * Example: Claim Vested Tokens
 *
 * Preview and claim vested tokens from existing Doppler token contracts.
 *
 * Required:
 * - TOKEN_ADDRESS=0x...
 *
 * Optional:
 * - VESTING_TOKEN_KIND=derc20 | derc20-v2 | doppler-erc20-v1
 * - BENEFICIARY=0x...              # defaults to the wallet account
 * - SCHEDULE_ID=0                  # schedule-aware tokens only
 * - RELEASE_AMOUNT=100             # DopplerERC20V1 only; defaults to available
 * - USE_RELEASE_FOR=true           # DERC20 V2 / DopplerERC20V1 releaseFor path
 * - EXECUTE_RELEASE=true           # broadcast the release transaction
 * - RELEASE_GAS_LIMIT=250000       # optional write gas override
 * - BASE_SEPOLIA_RPC_URL=...       # or RPC_URL
 * - PRIVATE_KEY=0x...              # required when EXECUTE_RELEASE=true
 */
import './env';

import { DopplerSDK } from '../src/evm';
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

type VestingTokenKind = 'derc20' | 'derc20-v2' | 'doppler-erc20-v1';

type SchedulePreview = {
  scheduleId: bigint;
  totalAmount: bigint;
  releasedAmount: bigint;
  availableAmount: bigint;
};

const tokenAddress = readAddress('TOKEN_ADDRESS');
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? process.env.RPC_URL;
if (!rpcUrl) {
  throw new Error('Set BASE_SEPOLIA_RPC_URL or RPC_URL');
}

const tokenKind = readTokenKind(process.env.VESTING_TOKEN_KIND ?? 'derc20-v2');
const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const account = privateKey ? privateKeyToAccount(privateKey) : undefined;
const configuredBeneficiary =
  readOptionalAddress('BENEFICIARY') ?? account?.address;
if (!configuredBeneficiary) {
  throw new Error('Set PRIVATE_KEY or BENEFICIARY');
}
const beneficiary: Address = configuredBeneficiary;
const callerAddress = account?.address;

const executeRelease = readBoolean(process.env.EXECUTE_RELEASE);
if (executeRelease && !account) {
  throw new Error('Set PRIVATE_KEY when EXECUTE_RELEASE=true');
}

const scheduleId = readOptionalBigInt('SCHEDULE_ID');
const releaseGasLimit = readOptionalBigInt('RELEASE_GAS_LIMIT');
const useReleaseFor = readBoolean(process.env.USE_RELEASE_FOR);
const releaseOptions = releaseGasLimit ? { gas: releaseGasLimit } : undefined;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});
const walletClient = account
  ? createWalletClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
      account,
    })
  : undefined;

const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: baseSepolia.id,
});

console.log('Vesting release example');
console.log('Token:', tokenAddress);
console.log('Token kind:', tokenKind);
console.log('Beneficiary:', beneficiary);
console.log('Execute release:', executeRelease);

if (tokenKind === 'derc20') {
  await runLegacyDerc20Release();
} else if (tokenKind === 'derc20-v2') {
  await runDerc20V2Release();
} else {
  await runDopplerERC20V1Release();
}

async function runLegacyDerc20Release() {
  const token = sdk.getDerc20(tokenAddress);
  const { symbol, decimals } = await readTokenDisplay(token);
  const [vestingData, availableAmount] = await Promise.all([
    token.getVestingData(beneficiary),
    token.getAvailableVestedAmount(beneficiary),
  ]);

  logVestingAmount('Total vested', vestingData.totalAmount, decimals, symbol);
  logVestingAmount(
    'Already released',
    vestingData.releasedAmount,
    decimals,
    symbol,
  );
  logVestingAmount('Available', availableAmount, decimals, symbol);

  if (!executeRelease || availableAmount === 0n) {
    return;
  }

  if (beneficiary !== callerAddress) {
    throw new Error('Derc20.release() can only claim for the caller');
  }

  const txHash = await token.release(releaseOptions);
  console.log('Release transaction:', txHash);
}

async function runDerc20V2Release() {
  const token = sdk.getDerc20V2(tokenAddress);
  const { symbol, decimals } = await readTokenDisplay(token);
  const schedulePreviews = await getDerc20V2SchedulePreviews(beneficiary);

  if (schedulePreviews.length === 0) {
    console.log('No vesting schedules found for beneficiary');
    return;
  }

  for (const preview of schedulePreviews) {
    console.log('Schedule:', preview.scheduleId.toString());
    logVestingAmount('  Total vested', preview.totalAmount, decimals, symbol);
    logVestingAmount(
      '  Already released',
      preview.releasedAmount,
      decimals,
      symbol,
    );
    logVestingAmount('  Available', preview.availableAmount, decimals, symbol);
  }

  if (!executeRelease) {
    return;
  }

  if (useReleaseFor || beneficiary !== callerAddress) {
    const txHash =
      scheduleId === undefined
        ? await token.releaseFor(beneficiary, undefined, releaseOptions)
        : await token.releaseFor(beneficiary, scheduleId, releaseOptions);
    console.log('ReleaseFor transaction:', txHash);
    return;
  }

  const scheduleToRelease = getSelectedScheduleId(schedulePreviews);
  const txHash = await token.releaseSchedule(scheduleToRelease, releaseOptions);
  console.log('ReleaseSchedule transaction:', txHash);
}

async function runDopplerERC20V1Release() {
  const token = sdk.getDopplerERC20V1(tokenAddress);
  const { symbol, decimals } = await readTokenDisplay(token);
  const releaseAmountOverride = readReleaseAmount(decimals);

  if (scheduleId === undefined) {
    const availableAmount = await token.getAvailableVestedAmount(beneficiary);
    logVestingAmount(
      'Available across schedules',
      availableAmount,
      decimals,
      symbol,
    );

    if (!executeRelease || availableAmount === 0n) {
      return;
    }

    const releaseAmount = releaseAmountOverride ?? availableAmount;
    const txHash =
      useReleaseFor || beneficiary !== callerAddress
        ? await token.releaseFor(beneficiary, releaseAmount, releaseOptions)
        : await token.release(releaseAmount, releaseOptions);
    console.log('Release transaction:', txHash);
    return;
  }

  const [vestingData, availableAmount] = await Promise.all([
    token.getVestingDataForSchedule(beneficiary, scheduleId),
    token.getAvailableVestedAmountForSchedule(beneficiary, scheduleId),
  ]);

  console.log('Schedule:', scheduleId.toString());
  logVestingAmount('Total vested', vestingData.totalAmount, decimals, symbol);
  logVestingAmount(
    'Already released',
    vestingData.releasedAmount,
    decimals,
    symbol,
  );
  logVestingAmount('Available', availableAmount, decimals, symbol);

  if (!executeRelease || availableAmount === 0n) {
    return;
  }

  const releaseAmount = releaseAmountOverride ?? availableAmount;
  const txHash =
    useReleaseFor || beneficiary !== callerAddress
      ? await token.releaseFor(
          beneficiary,
          scheduleId,
          releaseAmount,
          releaseOptions,
        )
      : await token.releaseSchedule(scheduleId, releaseAmount, releaseOptions);
  console.log('Release transaction:', txHash);
}

async function getDerc20V2SchedulePreviews(
  vestingBeneficiary: Address,
): Promise<SchedulePreview[]> {
  const token = sdk.getDerc20V2(tokenAddress);
  const scheduleIds =
    scheduleId === undefined
      ? await token.getScheduleIdsOf(vestingBeneficiary)
      : [scheduleId];

  return await Promise.all(
    scheduleIds.map(async (currentScheduleId) => {
      const [vestingData, availableAmount] = await Promise.all([
        token.getVestingDataForSchedule(vestingBeneficiary, currentScheduleId),
        token.getAvailableVestedAmountForSchedule(
          vestingBeneficiary,
          currentScheduleId,
        ),
      ]);

      return {
        scheduleId: currentScheduleId,
        totalAmount: vestingData.totalAmount,
        releasedAmount: vestingData.releasedAmount,
        availableAmount,
      };
    }),
  );
}

function getSelectedScheduleId(schedulePreviews: SchedulePreview[]): bigint {
  if (scheduleId !== undefined) {
    return scheduleId;
  }

  const releasableSchedules = schedulePreviews.filter((preview) => {
    return preview.availableAmount > 0n;
  });
  if (releasableSchedules.length === 0) {
    throw new Error('No schedule has vested tokens available to release');
  }
  if (releasableSchedules.length > 1) {
    throw new Error(
      'Multiple schedules have vested tokens available. Set SCHEDULE_ID, or set USE_RELEASE_FOR=true to claim across schedules.',
    );
  }

  return releasableSchedules[0].scheduleId;
}

async function readTokenDisplay(token: {
  getSymbol(): Promise<string>;
  getDecimals(): Promise<number>;
}): Promise<{ symbol: string; decimals: number }> {
  const [symbol, decimals] = await Promise.all([
    token.getSymbol(),
    token.getDecimals(),
  ]);

  return { symbol, decimals };
}

function logVestingAmount(
  label: string,
  amount: bigint,
  decimals: number,
  symbol: string,
) {
  console.log(`${label}:`, formatUnits(amount, decimals), symbol);
}

function readTokenKind(rawTokenKind: string): VestingTokenKind {
  if (
    rawTokenKind === 'derc20' ||
    rawTokenKind === 'derc20-v2' ||
    rawTokenKind === 'doppler-erc20-v1'
  ) {
    return rawTokenKind;
  }

  throw new Error(
    'VESTING_TOKEN_KIND must be derc20, derc20-v2, or doppler-erc20-v1',
  );
}

function readAddress(envKey: string): Address {
  const address = process.env[envKey];
  if (!address || !isAddress(address)) {
    throw new Error(`Set ${envKey} to a valid address`);
  }

  return address;
}

function readOptionalAddress(envKey: string): Address | undefined {
  const address = process.env[envKey];
  if (address === undefined || address === '') {
    return undefined;
  }
  if (!isAddress(address)) {
    throw new Error(`${envKey} must be a valid address`);
  }

  return address;
}

function readOptionalBigInt(envKey: string): bigint | undefined {
  const rawValue = process.env[envKey];
  if (rawValue === undefined || rawValue === '') {
    return undefined;
  }

  try {
    return BigInt(rawValue);
  } catch {
    throw new Error(`${envKey} must be an integer`);
  }
}

function readReleaseAmount(decimals: number): bigint | undefined {
  const rawAmount = process.env.RELEASE_AMOUNT;
  if (rawAmount === undefined || rawAmount === '') {
    return undefined;
  }

  return parseUnits(rawAmount, decimals);
}

function readBoolean(rawValue: string | undefined): boolean {
  return rawValue === '1' || rawValue === 'true';
}
