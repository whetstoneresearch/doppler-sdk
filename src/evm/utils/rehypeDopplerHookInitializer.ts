import type { Address, Hex } from 'viem';
import { isAddress } from 'viem';
import {
  RehypeFeeRoutingMode,
  type BeneficiaryData,
  type RehypeDopplerHookInitializerConfig,
  type RehypeFeeDistributionInfo,
} from '../types';
import {
  DEAD_ADDRESS,
  DECAY_MAX_START_FEE,
  WAD,
  ZERO_ADDRESS,
} from '../constants';
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
  buybackDestination: Address;
  feeBeneficiaries: [BeneficiaryData, ...BeneficiaryData[]];
  feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees;
};

export type NormalizedRehypeDopplerHookInitializerConfig =
  | NormalizedBuybackConfig
  | NormalizedBeneficiaryConfig;

/**
 * Normalize a Rehype configuration after its fee distribution controller has
 * been resolved. Low-level callers must pass `fallbackBuybackDestination`
 * whenever `config.buybackDestination` is omitted.
 */
export function normalizeRehypeDopplerHookInitializerConfig(
  config: RehypeDopplerHookInitializerConfig,
  fallbackBuybackDestination?: Address,
): NormalizedRehypeDopplerHookInitializerConfig {
  assertNonZeroAddress(config.hookAddress, 'Rehype hookAddress');

  const buybackDestination =
    config.buybackDestination ?? fallbackBuybackDestination;
  if (buybackDestination === undefined) {
    throw new Error(
      'Rehype requires buybackDestination or a fee distribution controller',
    );
  }
  assertNonZeroAddress(buybackDestination, 'Rehype buybackDestination');

  const feeBeneficiaries = config.feeBeneficiaries;

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
      buybackDestination,
      feeBeneficiaries: normalizedBeneficiaries,
      feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    };
  }

  return {
    ...common,
    buybackDestination,
    feeRoutingMode,
  };
}

/**
 * Resolve the on-chain `buybackDst` used to authorize fee distribution
 * updates. Canonical launchpad and no-op factories have known results.
 * Configurations that reinvest both fee rows entirely into LPs may safely use
 * the dead address when no controller can be inferred.
 */
export function resolveRehypeFeeDistributionController(
  config: RehypeDopplerHookInitializerConfig,
  governance:
    | { type: 'default' | 'custom' }
    | { type: 'noOp' }
    | { type: 'launchpad'; multisig: Address },
  options?: {
    controllerOverride?: Address;
    governanceFactoryOverride?: Address;
  },
): Address {
  const controllerOverride = options?.controllerOverride;
  if (
    config.buybackDestination !== undefined &&
    controllerOverride !== undefined
  ) {
    throw new Error(
      'Rehype buybackDestination and withFeeDistributionController are mutually exclusive',
    );
  }

  const explicit = config.buybackDestination ?? controllerOverride;
  if (explicit !== undefined) {
    assertNonZeroAddress(explicit, 'Rehype fee distribution controller');
    return explicit;
  }

  const allFeesToLp =
    config.feeBeneficiaries === undefined &&
    isFullLpReinvestment(resolveRehypeFeeDistributionInfo(config));
  if (config.feeBeneficiaries === undefined && !allFeesToLp) {
    throw new Error(
      'Rehype requires buybackDestination, withFeeDistributionController, or feeBeneficiaries unless fee distribution is 100% LP reinvestment',
    );
  }

  if (options?.governanceFactoryOverride !== undefined) {
    if (allFeesToLp) return DEAD_ADDRESS;
    throw new Error(
      'Rehype with a governanceFactory override requires buybackDestination or withFeeDistributionController',
    );
  }

  if (governance.type === 'launchpad') return governance.multisig;
  if (governance.type === 'noOp' || allFeesToLp) return DEAD_ADDRESS;

  throw new Error(
    'Standard governance requires buybackDestination or withFeeDistributionController',
  );
}

function isFullLpReinvestment(info: RehypeFeeDistributionInfo): boolean {
  return (
    info.assetFeesToAssetBuybackWad === 0n &&
    info.assetFeesToNumeraireBuybackWad === 0n &&
    info.assetFeesToBeneficiaryWad === 0n &&
    info.assetFeesToLpWad === WAD &&
    info.numeraireFeesToAssetBuybackWad === 0n &&
    info.numeraireFeesToNumeraireBuybackWad === 0n &&
    info.numeraireFeesToBeneficiaryWad === 0n &&
    info.numeraireFeesToLpWad === WAD
  );
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
