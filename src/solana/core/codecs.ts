/**
 * Borsh serialization/deserialization for CPMM accounts and instructions
 *
 * This module provides encoding/decoding utilities for program accounts
 * and instruction data using Borsh-compatible binary formats.
 */

import { getAddressCodec, type Address } from '@solana/kit';
import type { ReadonlyUint8Array } from '@solana/kit';
import {
  fixCodecSize,
  getArrayCodec,
  getBooleanCodec,
  getBytesCodec,
  getConstantDecoder,
  getHiddenPrefixDecoder,
  getOptionCodec,
  getStructCodec,
  getU8Codec,
  getU16Codec,
  getU32Codec,
  getU64Codec,
  getU128Codec,
  mergeBytes,
  transformCodec,
  unwrapOption,
  type Codec,
} from '@solana/kit';
import {
  MAX_ORACLE_OBSERVATIONS,
  MAX_SENTINEL_ALLOWLIST,
  ACCOUNT_DISCRIMINATORS,
} from './constants.js';
import type {
  AmmConfig,
  Pool,
  Position,
  OracleState,
  Observation,
  SwapExactInArgs,
  AddLiquidityArgs,
  RemoveLiquidityArgs,
  CollectFeesArgs,
  CollectProtocolFeesArgs,
  CreatePositionArgs,
  InitializeConfigArgs,
  InitializePoolArgs,
  InitializeOracleArgs,
  SetSentinelArgs,
  SetFeesArgs,
  SetRouteArgs,
  TransferAdminArgs,
  OracleConsultArgs,
  QuoteToNumeraireArgs,
} from './types.js';

const addressCodec = getAddressCodec();
const boolCodec = getBooleanCodec();
const u8Codec = getU8Codec();
const u16Codec = getU16Codec();
const u32Codec = getU32Codec();
const u64Codec = getU64Codec();
const u128Codec = getU128Codec();
const u256Codec: Codec<bigint> = transformCodec(
  getArrayCodec(u64Codec, { size: 4 }),
  (value) => {
    if (value < 0n) {
      throw new Error('u256 cannot be negative');
    }
    if ((value >> 256n) !== 0n) {
      throw new Error('u256 overflow');
    }
    const mask = (1n << 64n) - 1n;
    return [
      value & mask,
      (value >> 64n) & mask,
      (value >> 128n) & mask,
      (value >> 192n) & mask,
    ];
  },
  (value) => {
    let out = 0n;
    for (let i = 0; i < 4; i += 1) {
      out |= value[i] << (64n * BigInt(i));
    }
    return out;
  },
);

const reservedBytesCodec = transformCodec(
  fixCodecSize(getBytesCodec(), 7),
  (value: Uint8Array) => value,
  (value) => new Uint8Array(value),
);

// ============================================================================
// Account Codecs
// ============================================================================

export const observationCodec: Codec<Observation> = getStructCodec([
  ['timestamp', u32Codec],
  ['price0Cumulative', u256Codec],
  ['price1Cumulative', u256Codec],
]);

export const ammConfigDataCodec: Codec<AmmConfig> = getStructCodec([
  ['admin', addressCodec],
  ['paused', boolCodec],
  ['numeraireMint', addressCodec],
  ['sentinelAllowlistLen', u8Codec],
  ['sentinelAllowlist', getArrayCodec(addressCodec, { size: MAX_SENTINEL_ALLOWLIST })],
  ['maxSwapFeeBps', u16Codec],
  ['maxFeeSplitBps', u16Codec],
  ['maxRouteHops', u8Codec],
  ['protocolFeeEnabled', boolCodec],
  ['protocolFeeBps', u16Codec],
  ['version', u8Codec],
  ['reserved', reservedBytesCodec],
]);

export const poolDataCodec: Codec<Pool> = getStructCodec([
  ['config', addressCodec],
  ['token0Mint', addressCodec],
  ['token1Mint', addressCodec],
  ['vault0', addressCodec],
  ['vault1', addressCodec],
  ['authority', addressCodec],
  ['bump', u8Codec],
  ['reserve0', u64Codec],
  ['reserve1', u64Codec],
  ['totalShares', u128Codec],
  ['swapFeeBps', u16Codec],
  ['feeSplitBps', u16Codec],
  ['feeGrowthGlobal0Q64', u128Codec],
  ['feeGrowthGlobal1Q64', u128Codec],
  ['feesUnclaimed0', u64Codec],
  ['feesUnclaimed1', u64Codec],
  ['sentinelProgram', addressCodec],
  ['sentinelFlags', u32Codec],
  ['numeraireMint', addressCodec],
  ['liquidityMeasureSide', u8Codec],
  ['routeNextPool', addressCodec],
  ['routeBridgeMint', addressCodec],
  ['kLast', u128Codec],
  ['protocolPosition', addressCodec],
  ['locked', u8Codec],
  ['version', u8Codec],
  ['reserved', reservedBytesCodec],
]);

export const positionDataCodec: Codec<Position> = getStructCodec([
  ['pool', addressCodec],
  ['owner', addressCodec],
  ['positionId', u64Codec],
  ['shares', u128Codec],
  ['feeGrowthLast0Q64', u128Codec],
  ['feeGrowthLast1Q64', u128Codec],
  ['feeOwed0', u64Codec],
  ['feeOwed1', u64Codec],
  ['version', u8Codec],
  ['reserved', reservedBytesCodec],
]);

export const oracleStateDataCodec: Codec<OracleState> = getStructCodec([
  ['pool', addressCodec],
  ['initialized', boolCodec],
  ['maxPriceChangeRatioQ64', u128Codec],
  ['lastSlot', u64Codec],
  ['truncPrice0Q64', u128Codec],
  ['truncPrice1Q64', u128Codec],
  ['deviation0Q64', u128Codec],
  ['deviation1Q64', u128Codec],
  ['price0Cumulative', u256Codec],
  ['price1Cumulative', u256Codec],
  ['lastTimestamp', u32Codec],
  ['lastObservationTimestamp', u32Codec],
  ['observationIntervalSec', u32Codec],
  ['observationIndex', u16Codec],
  ['observations', getArrayCodec(observationCodec, { size: MAX_ORACLE_OBSERVATIONS })],
  ['version', u8Codec],
  ['reserved', reservedBytesCodec],
]);

const ammConfigDecoder = getHiddenPrefixDecoder(
  ammConfigDataCodec,
  [getConstantDecoder(ACCOUNT_DISCRIMINATORS.AmmConfig)],
);
const poolDecoder = getHiddenPrefixDecoder(
  poolDataCodec,
  [getConstantDecoder(ACCOUNT_DISCRIMINATORS.Pool)],
);
const positionDecoder = getHiddenPrefixDecoder(
  positionDataCodec,
  [getConstantDecoder(ACCOUNT_DISCRIMINATORS.Position)],
);
const oracleStateDecoder = getHiddenPrefixDecoder(
  oracleStateDataCodec,
  [getConstantDecoder(ACCOUNT_DISCRIMINATORS.OracleState)],
);

/**
 * Decode AmmConfig from raw account data (including discriminator)
 */
export function decodeAmmConfig(data: ReadonlyUint8Array): AmmConfig {
  return ammConfigDecoder.decode(data);
}

/**
 * Decode Pool from raw account data (including discriminator)
 */
export function decodePool(data: ReadonlyUint8Array): Pool {
  return poolDecoder.decode(data);
}

/**
 * Decode Position from raw account data (including discriminator)
 */
export function decodePosition(data: ReadonlyUint8Array): Position {
  return positionDecoder.decode(data);
}

/**
 * Decode OracleState from raw account data (including discriminator)
 */
export function decodeOracleState(data: ReadonlyUint8Array): OracleState {
  return oracleStateDecoder.decode(data);
}

// ============================================================================
// Instruction Encoders
// ============================================================================

/**
 * Encode instruction data with discriminator prefix
 */
export function encodeInstructionData<T>(
  discriminator: Uint8Array,
  codec?: { encode: (args: T) => ReadonlyUint8Array | Uint8Array },
  args?: T,
): Uint8Array {
  const encodedArgs = (() => {
    if (!codec) {
      return new Uint8Array();
    }
    if (args === undefined) {
      throw new Error('Instruction args are required for codec encoders');
    }
    return new Uint8Array(codec.encode(args));
  })();

  return mergeBytes([discriminator, encodedArgs]);
}

type AddLiquidityArgsWithOracle = AddLiquidityArgs & { updateOracle?: boolean };

const optionAddressCodec: Codec<Address | null> = transformCodec(
  getOptionCodec(addressCodec, { prefix: u8Codec }),
  (value: Address | null) => value,
  (value) => unwrapOption(value),
);

export const swapExactInArgsCodec = getStructCodec([
  ['amountIn', u64Codec],
  ['minAmountOut', u64Codec],
  ['direction', u8Codec],
  ['updateOracle', boolCodec],
]) as Codec<SwapExactInArgs>;

const addLiquidityArgsWithOracleCodec: Codec<AddLiquidityArgs & { updateOracle: boolean }> = getStructCodec([
  ['amount0Max', u64Codec],
  ['amount1Max', u64Codec],
  ['minSharesOut', u128Codec],
  ['updateOracle', boolCodec],
]);

export const addLiquidityArgsCodec: Codec<AddLiquidityArgsWithOracle> = transformCodec(
  addLiquidityArgsWithOracleCodec,
  (value: AddLiquidityArgsWithOracle) => ({
    ...value,
    updateOracle: value.updateOracle ?? false,
  }),
  (value) => value,
);

export const removeLiquidityArgsCodec: Codec<RemoveLiquidityArgs> = getStructCodec([
  ['sharesIn', u128Codec],
  ['minAmount0Out', u64Codec],
  ['minAmount1Out', u64Codec],
  ['updateOracle', boolCodec],
]);

export const collectFeesArgsCodec: Codec<CollectFeesArgs> = getStructCodec([
  ['max0', u64Codec],
  ['max1', u64Codec],
]);

export const collectProtocolFeesArgsCodec: Codec<CollectProtocolFeesArgs> = getStructCodec([
  ['max0', u64Codec],
  ['max1', u64Codec],
]);

export const createPositionArgsCodec: Codec<CreatePositionArgs> = getStructCodec([
  ['positionId', u64Codec],
]);

export const initializeConfigArgsCodec: Codec<InitializeConfigArgs> = getStructCodec([
  ['admin', addressCodec],
  ['numeraireMint', addressCodec],
  ['maxSwapFeeBps', u16Codec],
  ['maxFeeSplitBps', u16Codec],
  ['maxRouteHops', u8Codec],
  ['protocolFeeEnabled', boolCodec],
  ['protocolFeeBps', u16Codec],
  ['sentinelAllowlist', getArrayCodec(addressCodec, { size: u32Codec })],
]);

export const initializePoolArgsCodec: Codec<InitializePoolArgs> = getStructCodec([
  ['mintA', addressCodec],
  ['mintB', addressCodec],
  ['initialSwapFeeBps', u16Codec],
  ['initialFeeSplitBps', u16Codec],
  ['liquidityMeasureSide', u8Codec],
  ['numeraireMintOverride', optionAddressCodec],
]);

export const initializeOracleArgsCodec: Codec<InitializeOracleArgs> = getStructCodec([
  ['maxPriceChangeRatioQ64', u128Codec],
  ['observationIntervalSec', u32Codec],
  ['numObservations', u16Codec],
]);

export const setSentinelArgsCodec: Codec<SetSentinelArgs> = getStructCodec([
  ['sentinelProgram', addressCodec],
  ['sentinelFlags', u32Codec],
]);

export const setFeesArgsCodec: Codec<SetFeesArgs> = getStructCodec([
  ['swapFeeBps', u16Codec],
  ['feeSplitBps', u16Codec],
]);

export const setRouteArgsCodec: Codec<SetRouteArgs> = getStructCodec([
  ['routeNextPool', addressCodec],
  ['routeBridgeMint', addressCodec],
]);

export const transferAdminArgsCodec: Codec<TransferAdminArgs> = getStructCodec([
  ['newAdmin', addressCodec],
]);

export const oracleConsultArgsCodec: Codec<OracleConsultArgs> = getStructCodec([
  ['windowSeconds', u32Codec],
]);

export const quoteToNumeraireArgsCodec: Codec<QuoteToNumeraireArgs> = getStructCodec([
  ['amount', u128Codec],
  ['side', u8Codec],
  ['maxHops', u8Codec],
  ['useTwap', boolCodec],
  ['windowSeconds', u32Codec],
]);

/** Encode SwapExactIn args */
export function encodeSwapExactInArgs(args: SwapExactInArgs): Uint8Array {
  return new Uint8Array(swapExactInArgsCodec.encode(args));
}

/** Encode AddLiquidity args */
export function encodeAddLiquidityArgs(args: AddLiquidityArgsWithOracle): Uint8Array {
  return new Uint8Array(addLiquidityArgsCodec.encode(args));
}

/** Encode RemoveLiquidity args */
export function encodeRemoveLiquidityArgs(args: RemoveLiquidityArgs): Uint8Array {
  return new Uint8Array(removeLiquidityArgsCodec.encode(args));
}

/** Encode CollectFees args */
export function encodeCollectFeesArgs(args: CollectFeesArgs): Uint8Array {
  return new Uint8Array(collectFeesArgsCodec.encode(args));
}

/** Encode CollectProtocolFees args */
export function encodeCollectProtocolFeesArgs(args: CollectProtocolFeesArgs): Uint8Array {
  return new Uint8Array(collectProtocolFeesArgsCodec.encode(args));
}

/** Encode CreatePosition args */
export function encodeCreatePositionArgs(args: CreatePositionArgs): Uint8Array {
  return new Uint8Array(createPositionArgsCodec.encode(args));
}

/** Encode InitializeConfig args */
export function encodeInitializeConfigArgs(args: InitializeConfigArgs): Uint8Array {
  return new Uint8Array(initializeConfigArgsCodec.encode(args));
}

/** Encode InitializePool args */
export function encodeInitializePoolArgs(args: InitializePoolArgs): Uint8Array {
  return new Uint8Array(initializePoolArgsCodec.encode(args));
}

/** Encode InitializeOracle args */
export function encodeInitializeOracleArgs(args: InitializeOracleArgs): Uint8Array {
  return new Uint8Array(initializeOracleArgsCodec.encode(args));
}

/** Encode SetSentinel args */
export function encodeSetSentinelArgs(args: SetSentinelArgs): Uint8Array {
  return new Uint8Array(setSentinelArgsCodec.encode(args));
}

/** Encode SetFees args */
export function encodeSetFeesArgs(args: SetFeesArgs): Uint8Array {
  return new Uint8Array(setFeesArgsCodec.encode(args));
}

/** Encode SetRoute args */
export function encodeSetRouteArgs(args: SetRouteArgs): Uint8Array {
  return new Uint8Array(setRouteArgsCodec.encode(args));
}

/** Encode TransferAdmin args */
export function encodeTransferAdminArgs(args: TransferAdminArgs): Uint8Array {
  return new Uint8Array(transferAdminArgsCodec.encode(args));
}

/** Encode OracleConsult args */
export function encodeOracleConsultArgs(args: OracleConsultArgs): Uint8Array {
  return new Uint8Array(oracleConsultArgsCodec.encode(args));
}

/** Encode QuoteToNumeraire args */
export function encodeQuoteToNumeraireArgs(args: QuoteToNumeraireArgs): Uint8Array {
  return new Uint8Array(quoteToNumeraireArgsCodec.encode(args));
}
