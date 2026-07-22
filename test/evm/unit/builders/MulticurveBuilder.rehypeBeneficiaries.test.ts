import { describe, expect, expectTypeOf, it } from 'vitest';
import { getAddress, parseEther, type Address, zeroAddress } from 'viem';
import { CHAIN_IDS } from '../../../../src/evm/addresses';
import { MulticurveBuilder } from '../../../../src/evm/builders';
import { DECAY_MAX_START_FEE, WAD } from '../../../../src/evm/constants';
import {
  RehypeFeeRoutingMode,
  type BeneficiaryData,
  type RehypeDopplerHookInitializerConfig,
} from '../../../../src/evm/types';
import { normalizeRehypeDopplerHookInitializerConfig } from '../../../../src/evm/utils';

const hookAddress = getAddress('0x9999999999999999999999999999999999999999');
const buybackDestination = getAddress(
  '0x8888888888888888888888888888888888888888',
);
const firstBeneficiary = getAddress(
  '0x1111111111111111111111111111111111111111',
);
const secondBeneficiary = getAddress(
  '0x2222222222222222222222222222222222222222',
);

type CommonConfig = {
  hookAddress: Address;
  startFee: number;
  feeDistributionInfo: ReturnType<typeof feeDistributionInfo>;
};

describe('MulticurveBuilder RehypeDopplerHookInitializer beneficiaries', () => {
  it('makes buyback destination and fee beneficiaries mutually exclusive', () => {
    type ConflictingConfig = CommonConfig & {
      buybackDestination: Address;
      feeBeneficiaries: [BeneficiaryData];
    };

    // Given / When / Then: the public config type must reject both destinations.
    expectTypeOf<ConflictingConfig>().not.toMatchTypeOf<RehypeDopplerHookInitializerConfig>();
  });

  it('makes DirectBuyback routing incompatible with fee beneficiaries', () => {
    type DirectBuybackBeneficiariesConfig = CommonConfig & {
      feeBeneficiaries: [BeneficiaryData];
      feeRoutingMode: RehypeFeeRoutingMode.DirectBuyback;
    };

    expectTypeOf<DirectBuybackBeneficiariesConfig>().not.toMatchTypeOf<RehypeDopplerHookInitializerConfig>();
  });

  it('requires the fee beneficiary array to be nonempty in the public type', () => {
    type EmptyBeneficiariesConfig = CommonConfig & {
      feeBeneficiaries: [];
    };

    // Given / When / Then
    expectTypeOf<EmptyBeneficiariesConfig>().not.toMatchTypeOf<RehypeDopplerHookInitializerConfig>();
  });

  it('rejects an explicitly empty fee beneficiary array at runtime', () => {
    // Given
    const config = {
      hookAddress,
      feeBeneficiaries: [],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    };

    // When / Then
    expect(() =>
      Reflect.apply(normalizeRehypeDopplerHookInitializerConfig, undefined, [
        config,
      ]),
    ).toThrow('Rehype fee beneficiary list must not be empty');
  });

  it('rejects buyback destination with an explicitly empty array at runtime', () => {
    // Given
    const config = {
      hookAddress,
      buybackDestination,
      feeBeneficiaries: [],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    };

    // When / Then
    expect(() =>
      Reflect.apply(normalizeRehypeDopplerHookInitializerConfig, undefined, [
        config,
      ]),
    ).toThrow(
      'Rehype buybackDestination and feeBeneficiaries are mutually exclusive',
    );
  });

  it('sorts beneficiaries and infers beneficiary fee routing', () => {
    // Given
    const builder = buildBaseBuilder();

    // When
    const params = builder
      .withRehypeDopplerHookInitializer({
        hookAddress,
        feeBeneficiaries: [
          { beneficiary: secondBeneficiary, shares: WAD / 4n },
          { beneficiary: firstBeneficiary, shares: (WAD * 3n) / 4n },
        ],
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      })
      .build();

    // Then
    expect(params.initializer?.type).toBe('rehype');
    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.initializer.config.feeRoutingMode).toBe(
      RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    );
    expect(
      params.initializer.config.feeBeneficiaries?.map(
        ({ beneficiary }) => beneficiary,
      ),
    ).toEqual([firstBeneficiary, secondBeneficiary]);
    expect(params.initializer.config.buybackDestination).toBeUndefined();
  });

  it('rejects beneficiary shares that do not sum to WAD', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress,
        feeBeneficiaries: [
          { beneficiary: firstBeneficiary, shares: WAD / 4n },
          { beneficiary: secondBeneficiary, shares: WAD / 4n },
        ],
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow('Rehype fee beneficiary shares must sum');
  });

  it('rejects fees above the Rehype contract maximum', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination,
        startFee: DECAY_MAX_START_FEE + 1,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow(
      `Rehype startFee must be an integer between 0 and ${DECAY_MAX_START_FEE}`,
    );
  });

  it('rejects the zero Rehype initializer address', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress: zeroAddress,
        buybackDestination,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow('Rehype hookAddress must be a non-zero address');
  });

  it('rejects the zero buyback destination', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination: zeroAddress,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow('Rehype buybackDestination must be a non-zero address');
  });

  it('keeps buyback routing without adding fee beneficiaries', () => {
    // Given / When
    const params = buildBaseBuilder()
      .withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      })
      .build();

    // Then
    expect(params.initializer?.type).toBe('rehype');
    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.initializer.config.feeBeneficiaries).toBeUndefined();
    expect(params.initializer.config.buybackDestination).toBe(
      buybackDestination,
    );
  });
});

function buildBaseBuilder() {
  return MulticurveBuilder.forChain(CHAIN_IDS.BASE_SEPOLIA)
    .tokenConfig({
      type: 'standard',
      name: 'Rehype Beneficiaries',
      symbol: 'RHB',
      tokenURI: 'ipfs://rehype-beneficiaries',
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: getAddress('0x4200000000000000000000000000000000000006'),
    })
    .poolConfig({
      fee: 500,
      tickSpacing: 10,
      curves: [
        {
          tickLower: 0,
          tickUpper: 220_000,
          numPositions: 12,
          shares: WAD,
        },
      ],
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
}

function feeDistributionInfo() {
  return {
    assetFeesToAssetBuybackWad: 0n,
    assetFeesToNumeraireBuybackWad: 0n,
    assetFeesToBeneficiaryWad: WAD,
    assetFeesToLpWad: 0n,
    numeraireFeesToAssetBuybackWad: 0n,
    numeraireFeesToNumeraireBuybackWad: 0n,
    numeraireFeesToBeneficiaryWad: WAD,
    numeraireFeesToLpWad: 0n,
  };
}
