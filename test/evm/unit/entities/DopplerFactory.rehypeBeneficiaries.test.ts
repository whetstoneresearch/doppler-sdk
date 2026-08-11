import { beforeEach, describe, expect, it } from 'vitest';
import { decodeAbiParameters, getAddress, parseEther } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import {
  RehypeFeeRoutingMode,
  type CreateMulticurveParams,
  type RehypeDopplerHookInitializerConfig,
} from '../../../../src/evm/types';
import { DEAD_ADDRESS, WAD } from '../../../../src/evm/constants';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';

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

describe('DopplerFactory RehypeDopplerHookInitializer beneficiary encoding', () => {
  let factory: DopplerFactory;

  beforeEach(() => {
    factory = new DopplerFactory(
      createMockPublicClient(),
      createMockWalletClient(),
      1,
    );
  });

  it('encodes an empty beneficiary array when buybackDst is configured', () => {
    // Given
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    // When
    const decoded = encodeAndDecode(factory, params);

    // Then
    expect(decoded.buybackDst).toBe(buybackDestination);
    expect(decoded.feeBeneficiaries).toEqual([]);
  });

  it('preserves buybackDst with beneficiary routing and no beneficiaries', () => {
    // Given
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    // When
    const decoded = encodeAndDecode(factory, params);

    // Then
    expect(decoded.buybackDst).toBe(buybackDestination);
    expect(Number(decoded.feeRoutingMode)).toBe(
      RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    );
    expect(decoded.feeBeneficiaries).toEqual([]);
  });

  it('encodes sorted beneficiaries and the no-op governance controller', () => {
    // Given
    const params = multicurveParams({
      hookAddress,
      feeBeneficiaries: [
        { beneficiary: secondBeneficiary, shares: WAD / 4n },
        { beneficiary: firstBeneficiary, shares: (WAD * 3n) / 4n },
      ],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    // When
    const decoded = encodeAndDecode(factory, params);

    // Then
    expect(decoded.buybackDst).toBe(DEAD_ADDRESS);
    expect(Number(decoded.feeRoutingMode)).toBe(
      RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    );
    expect(decoded.feeBeneficiaries).toEqual([
      { beneficiary: firstBeneficiary, shares: (WAD * 3n) / 4n },
      { beneficiary: secondBeneficiary, shares: WAD / 4n },
    ]);
  });

  it('uses a dead controller for complete LP reinvestment with a governance override', () => {
    const params = multicurveParams({
      hookAddress,
      startFee: 3_000,
      feeDistributionInfo: fullLpReinvestment(),
    });
    params.modules = {
      ...params.modules,
      governanceFactory: secondBeneficiary,
    };

    const decoded = encodeAndDecode(factory, params);

    expect(decoded.buybackDst).toBe(DEAD_ADDRESS);
    expect(decoded.feeBeneficiaries).toEqual([]);
  });

  it('rejects recipient omission when fees leave LP reinvestment', () => {
    const params = multicurveParams({
      hookAddress,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Rehype requires buybackDestination, withFeeDistributionController, or feeBeneficiaries unless fee distribution is 100% LP reinvestment',
    );
  });

  it('rejects governance factory inference when the factory is overridden', () => {
    const params = multicurveParams({
      hookAddress,
      feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });
    params.modules = {
      ...params.modules,
      governanceFactory: secondBeneficiary,
    };

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Rehype with a governanceFactory override requires buybackDestination or withFeeDistributionController',
    );
  });

  it('preserves an explicit controller that is not a beneficiary', () => {
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    const decoded = encodeAndDecode(factory, params);

    expect(decoded.buybackDst).toBe(buybackDestination);
    expect(decoded.feeBeneficiaries).toEqual([
      { beneficiary: firstBeneficiary, shares: WAD },
    ]);
  });

  it('allows a governance factory override with an explicit destination', () => {
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });
    params.modules = {
      ...params.modules,
      governanceFactory: secondBeneficiary,
    };

    const decoded = encodeAndDecode(factory, params);

    expect(decoded.buybackDst).toBe(buybackDestination);
  });
});

function multicurveParams(
  config: RehypeDopplerHookInitializerConfig,
): CreateMulticurveParams {
  return {
    token: {
      name: 'Rehype Beneficiaries',
      symbol: 'RHB',
      tokenURI: 'ipfs://rehype-beneficiaries',
    },
    sale: {
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: getAddress('0x4200000000000000000000000000000000000006'),
    },
    pool: {
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
    },
    initializer: { type: 'rehype', config },
    governance: { type: 'noOp' },
    migration: { type: 'uniswapV2' },
    userAddress: getAddress('0x1234567890123456789012345678901234567890'),
    modules: {
      dopplerHookInitializer: getAddress(
        '0x7777777777777777777777777777777777777777',
      ),
    },
  };
}

function encodeAndDecode(
  factory: DopplerFactory,
  params: CreateMulticurveParams,
) {
  const createParams = factory.encodeCreateMulticurveParams(params);
  const [poolInitData] = decodeAbiParameters(
    dopplerHookInitializerDataAbi,
    createParams.poolInitializerData,
  );
  const [rehypeInitData] = decodeAbiParameters(
    rehypeDopplerHookInitializerDataAbi,
    poolInitData.onInitializationDopplerHookCalldata,
  );
  return rehypeInitData;
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

function fullLpReinvestment() {
  return {
    assetFeesToAssetBuybackWad: 0n,
    assetFeesToNumeraireBuybackWad: 0n,
    assetFeesToBeneficiaryWad: 0n,
    assetFeesToLpWad: WAD,
    numeraireFeesToAssetBuybackWad: 0n,
    numeraireFeesToNumeraireBuybackWad: 0n,
    numeraireFeesToBeneficiaryWad: 0n,
    numeraireFeesToLpWad: WAD,
  };
}

const beneficiaryComponents = [
  { name: 'beneficiary', type: 'address' },
  { name: 'shares', type: 'uint96' },
] as const;

const feeDistributionComponents = [
  { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
  { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
  { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
  { name: 'assetFeesToLpWad', type: 'uint256' },
  { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
  { name: 'numeraireFeesToNumeraireBuybackWad', type: 'uint256' },
  { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
  { name: 'numeraireFeesToLpWad', type: 'uint256' },
] as const;

const dopplerHookInitializerDataAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'farTick', type: 'int24' },
      {
        name: 'curves',
        type: 'tuple[]',
        components: [
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'numPositions', type: 'uint16' },
          { name: 'shares', type: 'uint256' },
        ],
      },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        components: beneficiaryComponents,
      },
      { name: 'dopplerHook', type: 'address' },
      { name: 'onInitializationDopplerHookCalldata', type: 'bytes' },
      { name: 'graduationDopplerHookCalldata', type: 'bytes' },
    ],
  },
] as const;

const rehypeDopplerHookInitializerDataAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'numeraire', type: 'address' },
      { name: 'buybackDst', type: 'address' },
      { name: 'startFee', type: 'uint24' },
      { name: 'endFee', type: 'uint24' },
      { name: 'durationSeconds', type: 'uint32' },
      { name: 'startingTime', type: 'uint32' },
      { name: 'feeRoutingMode', type: 'uint8' },
      {
        name: 'feeDistributionInfo',
        type: 'tuple',
        components: feeDistributionComponents,
      },
      {
        name: 'feeBeneficiaries',
        type: 'tuple[]',
        components: beneficiaryComponents,
      },
    ],
  },
] as const;
