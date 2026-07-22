import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import {
  RehypeFeeRoutingMode,
  type RehypeDopplerHookConfig,
  type RehypeDopplerHookInitializerConfig,
} from '../../../../src/evm/types';

const hookAddress = getAddress('0x1111111111111111111111111111111111111111');
const replacementHookAddress = getAddress(
  '0x2222222222222222222222222222222222222222',
);
const buybackDestination = getAddress(
  '0x3333333333333333333333333333333333333333',
);
const replacementBuybackDestination = getAddress(
  '0x4444444444444444444444444444444444444444',
);
const firstBeneficiary = getAddress(
  '0x5555555555555555555555555555555555555555',
);
const secondBeneficiary = getAddress(
  '0x6666666666666666666666666666666666666666',
);

describe('RehypeDopplerHookInitializerConfig configuration types', () => {
  it('keeps initializer and deprecated configurations mutable', () => {
    // Given
    const initializerConfig: RehypeDopplerHookInitializerConfig = {
      hookAddress,
      buybackDestination,
      startFee: 3_000,
    };
    const deprecatedConfig: RehypeDopplerHookConfig = initializerConfig;

    // When
    initializerConfig.hookAddress = replacementHookAddress;
    initializerConfig.buybackDestination = replacementBuybackDestination;
    initializerConfig.startFee = 4_000;
    deprecatedConfig.endFee = 2_000;

    // Then
    expect(initializerConfig).toMatchObject({
      hookAddress: replacementHookAddress,
      buybackDestination: replacementBuybackDestination,
      startFee: 4_000,
      endFee: 2_000,
    });
  });

  it('keeps the nonempty beneficiary tuple mutable', () => {
    // Given
    const config: RehypeDopplerHookInitializerConfig = {
      hookAddress,
      feeBeneficiaries: [
        { beneficiary: firstBeneficiary, shares: 500_000_000_000_000_000n },
      ],
      feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    };

    // When
    config.feeBeneficiaries.push({
      beneficiary: secondBeneficiary,
      shares: 500_000_000_000_000_000n,
    });
    config.feeRoutingMode = 'routeToBeneficiaryFees';

    // Then
    expect(config.feeBeneficiaries).toHaveLength(2);
    expect(config.feeRoutingMode).toBe('routeToBeneficiaryFees');
  });
});
