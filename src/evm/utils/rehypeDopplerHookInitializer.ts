import type { Address, Hex } from 'viem';
import { isAddress } from 'viem';
import {
  RehypeFeeRoutingMode,
  type BeneficiaryData,
  type RehypeDopplerHookInitializerConfig,
  type RehypeFeeDistributionInfo,
} from '../types';
import { DECAY_MAX_START_FEE, ZERO_ADDRESS } from '../constants';
import { normalizeBeneficiaries } from './beneficiaries';
import { resolveRehypeFeeDistributionInfo } from './rehypeFeeDistribution';

type NormalizedCommonConfig = {
  hookAddress: Address;
  startFee: number;
  endFee: number;
  durationSeconds: number;
  startingTime: number;
  feeDistributionInfo: RehypeFeeDistributionInfo;
  graduationCalldata?: Hex;
  graduationMarketCap?: number;
  numerairePrice?: number;
  farTick?: number;
};

type NormalizedBuybackConfig = NormalizedCommonConfig & {
  buybackDestination: Address;
  feeBeneficiaries?: never;
  feeRoutingMode: RehypeFeeRoutingMode;
};

type NormalizedBeneficiaryConfig = NormalizedCommonConfig & {
  buybackDestination?: never;
  feeBeneficiaries: [BeneficiaryData, ...BeneficiaryData[]];
  feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees;
};

export type NormalizedRehypeDopplerHookInitializerConfig =
  | NormalizedBuybackConfig
  | NormalizedBeneficiaryConfig;

export function normalizeRehypeDopplerHookInitializerConfig(
  config: RehypeDopplerHookInitializerConfig,
): NormalizedRehypeDopplerHookInitializerConfig {
  assertNonZeroAddress(config.hookAddress, 'Rehype hookAddress');

  const feeBeneficiaries = config.feeBeneficiaries;
  if (
    feeBeneficiaries !== undefined &&
    config.buybackDestination !== undefined
  ) {
    throw new Error(
      'Rehype buybackDestination and feeBeneficiaries are mutually exclusive',
    );
  }

  const feeDistributionInfo = resolveRehypeFeeDistributionInfo(config);
  const { startFee, endFee, durationSeconds, startingTime } =
    normalizeFeeSchedule(config);
  const feeRoutingMode =
    feeBeneficiaries !== undefined
      ? normalizeBeneficiaryFeeRoutingMode(config.feeRoutingMode)
      : normalizeFeeRoutingMode(config.feeRoutingMode);
  const common = {
    hookAddress: config.hookAddress,
    startFee,
    endFee,
    durationSeconds,
    startingTime,
    feeDistributionInfo,
    graduationCalldata: config.graduationCalldata,
    graduationMarketCap: config.graduationMarketCap,
    numerairePrice: config.numerairePrice,
    farTick: config.farTick,
  };
  if (feeBeneficiaries !== undefined) {
    const normalizedBeneficiaries = normalizeBeneficiaries(
      feeBeneficiaries,
      'Rehype fee beneficiary',
    );

    return {
      ...common,
      feeBeneficiaries: normalizedBeneficiaries,
      feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    };
  }

  if (config.buybackDestination === undefined) {
    throw new Error(
      'Rehype requires either buybackDestination or feeBeneficiaries',
    );
  }
  assertNonZeroAddress(config.buybackDestination, 'Rehype buybackDestination');

  return {
    ...common,
    buybackDestination: config.buybackDestination,
    feeRoutingMode,
  };
}

function assertNonZeroAddress(address: Address, label: string): void {
  if (
    !isAddress(address, { strict: false }) ||
    address.toLowerCase() === ZERO_ADDRESS
  ) {
    throw new Error(`${label} must be a non-zero address`);
  }
}

function normalizeFeeRoutingMode(
  mode: RehypeDopplerHookInitializerConfig['feeRoutingMode'],
): RehypeFeeRoutingMode {
  if (mode === undefined || mode === RehypeFeeRoutingMode.DirectBuyback) {
    return RehypeFeeRoutingMode.DirectBuyback;
  }
  if (mode === RehypeFeeRoutingMode.RouteToBeneficiaryFees) {
    return RehypeFeeRoutingMode.RouteToBeneficiaryFees;
  }
  if (mode === 'directBuyback') {
    return RehypeFeeRoutingMode.DirectBuyback;
  }
  if (mode === 'routeToBeneficiaryFees') {
    return RehypeFeeRoutingMode.RouteToBeneficiaryFees;
  }
  throw new Error('Unsupported Rehype feeRoutingMode');
}

function normalizeBeneficiaryFeeRoutingMode(
  mode: RehypeDopplerHookInitializerConfig['feeRoutingMode'],
): RehypeFeeRoutingMode.RouteToBeneficiaryFees {
  if (
    mode === undefined ||
    mode === RehypeFeeRoutingMode.RouteToBeneficiaryFees ||
    mode === 'routeToBeneficiaryFees'
  ) {
    return RehypeFeeRoutingMode.RouteToBeneficiaryFees;
  }
  throw new Error(
    'Rehype fee beneficiaries are incompatible with DirectBuyback routing',
  );
}

function normalizeFeeSchedule(
  config: RehypeDopplerHookInitializerConfig,
): Pick<
  NormalizedCommonConfig,
  'startFee' | 'endFee' | 'durationSeconds' | 'startingTime'
> {
  const maxRehypeFee = DECAY_MAX_START_FEE;
  const startFeeRaw = config.startFee ?? config.customFee;
  if (startFeeRaw === undefined) {
    throw new Error(
      'Rehype startFee is required, or provide deprecated customFee.',
    );
  }

  const startFee = Number(startFeeRaw);
  const endFee = Number(config.endFee ?? startFee);
  if (!Number.isInteger(startFee) || startFee < 0 || startFee > maxRehypeFee) {
    throw new Error(
      `Rehype startFee must be an integer between 0 and ${maxRehypeFee}`,
    );
  }
  if (!Number.isInteger(endFee) || endFee < 0 || endFee > maxRehypeFee) {
    throw new Error(
      `Rehype endFee must be an integer between 0 and ${maxRehypeFee}`,
    );
  }
  if (startFee < endFee) {
    throw new Error(
      `Rehype startFee (${startFee}) must be greater than or equal to endFee (${endFee})`,
    );
  }

  const durationRaw =
    config.durationSeconds ?? (startFee === endFee ? 0 : undefined);
  if (durationRaw === undefined) {
    throw new Error(
      'Rehype durationSeconds must be provided when startFee is greater than endFee.',
    );
  }
  const durationSeconds = normalizeUint32(
    durationRaw,
    'Rehype durationSeconds',
  );
  if (startFee > endFee && durationSeconds === 0) {
    throw new Error(
      'Rehype durationSeconds must be greater than 0 when startFee is greater than endFee.',
    );
  }

  const startingTimeValue = config.startingTime;
  const startingTime =
    startingTimeValue === undefined
      ? 0
      : normalizeUint32(
          startingTimeValue instanceof Date
            ? Math.floor(startingTimeValue.getTime() / 1_000)
            : startingTimeValue,
          'Rehype startingTime',
        );

  return { startFee, endFee, durationSeconds, startingTime };
}

function normalizeUint32(value: number | bigint, label: string): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || !Number.isInteger(normalized)) {
    throw new Error(`${label} must be an integer number of seconds`);
  }
  if (normalized < 0) {
    throw new Error(`${label} cannot be negative`);
  }
  if (normalized > 0xffffffff) {
    throw new Error(`${label} must fit within uint32`);
  }
  return normalized;
}
