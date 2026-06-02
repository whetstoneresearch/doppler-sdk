// Constants
export {
  CPMM_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  BPS_DENOM,
  Q64_ONE,
  ACCOUNT_VERSION,
  MAX_HOOK_ALLOWLIST,
  MAX_ORACLE_OBSERVATIONS,
  SEED_CONFIG,
  SEED_POOL,
  SEED_AUTHORITY,
  SEED_POSITION,
  SEED_ORACLE,
  SEED_PROTOCOL_FEE_OWNER,
  HF_BEFORE_SWAP,
  HF_AFTER_SWAP,
  HF_BEFORE_ADD_LIQ,
  HF_AFTER_ADD_LIQ,
  HF_BEFORE_REMOVE_LIQ,
  HF_AFTER_REMOVE_LIQ,
  HF_REQUIRE_ORACLE,
  HF_FORWARD_READONLY_SIGNERS,
  HOOK_NO_CHANGE,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_DISCRIMINATORS,
} from './constants.js';

// Types
export type {
  TradeDirection,
  AmmConfig,
  Pool,
  Position,
  Observation,
  OracleState,
  InitializeConfigArgs,
  InitializePoolArgs,
  InitializeOracleArgs,
  CreatePositionArgs,
  AddLiquidityArgs,
  RemoveLiquidityArgs,
  SwapExactInArgs,
  CollectFeesArgs,
  CollectProtocolFeesArgs,
  SetHookArgs,
  SetFeesArgs,
  TransferAdminArgs,
  OracleConsultArgs,
  SwapQuote,
  SwapQuoteExactOut,
  AddLiquidityQuote,
  RemoveLiquidityQuote,
  TwapResult,
  SwapEvent,
  AddLiquidityEvent,
  RemoveLiquidityEvent,
  CollectFeesEvent,
  CollectProtocolFeesEvent,
  PoolInitializedEvent,
  PositionCreatedEvent,
  PositionClosedEvent,
  HookInvokedEvent,
  HookErrorEvent,
  HookUpdatedEvent,
  FeesUpdatedEvent,
  OracleInitializedEvent,
  OracleUpdatedEvent,
  AdminTransferredEvent,
  PausedEvent,
  UnpausedEvent,
  VaultExcessWithdrawnEvent,
  MarketCapValidationResult,
  CurveParams,
  MarketCapToCurveParamsInput,
  CurveParamsToMarketCapInput,
} from './types.js';

// Codecs - Account decoders
export {
  decodeAmmConfig,
  decodePool,
  decodePosition,
  decodeOracleState,
} from './codecs.js';

// Codecs - Instruction encoders
export {
  encodeInstructionData,
  encodeSwapExactInArgs,
  encodeAddLiquidityArgs,
  encodeRemoveLiquidityArgs,
  encodeCollectFeesArgs,
  encodeCollectProtocolFeesArgs,
  encodeCreatePositionArgs,
  encodeInitializeConfigArgs,
  encodeInitializePoolArgs,
  encodeInitializeOracleArgs,
  encodeSetHookArgs,
  encodeSetFeesArgs,
  encodeTransferAdminArgs,
  encodeOracleConsultArgs,
} from './codecs.js';

// Codecs - Legacy exports
export {
  observationCodec,
  ammConfigDataCodec,
  poolDataCodec,
  positionDataCodec,
  oracleStateDataCodec,
  swapExactInArgsCodec,
  addLiquidityArgsCodec,
  removeLiquidityArgsCodec,
  collectFeesArgsCodec,
  collectProtocolFeesArgsCodec,
  createPositionArgsCodec,
  initializeConfigArgsCodec,
  initializePoolArgsCodec,
  initializeOracleArgsCodec,
  setHookArgsCodec,
  setFeesArgsCodec,
  transferAdminArgsCodec,
  oracleConsultArgsCodec,
} from './codecs.js';

// PDA derivation
export {
  sortMints,
  areMintsOrdered,
  getConfigAddress,
  getPoolAddress,
  getPoolAuthorityAddress,
  getPoolVault0Address,
  getPoolVault1Address,
  getPositionAddress,
  getOracleAddress,
  getProtocolFeeOwnerAddress,
  getProtocolFeePositionAddress,
  getPoolInitAddresses,
  getSwapAddresses,
  getLiquidityAddresses,
} from './pda.js';

// Token metadata helpers
export { getMetadataAddress } from './tokenMetadata.js';

// Math utilities
export {
  q64ToNumber,
  numberToQ64,
  q64Mul,
  q64Div,
  computePrice0Q64,
  computePrice1Q64,
  isqrt,
  ceilDiv,
  minBigInt,
  maxBigInt,
  ratioToNumber,
  getSwapQuote,
  getSwapQuoteExactOut,
  getAddLiquidityQuote,
  getRemoveLiquidityQuote,
  calculateAccruedFees,
  getPendingFees,
  getSpotPrice0,
  getSpotPrice1,
  getK,
  getTvl,
  calculateTwap,
  calculateTwapNumber,
} from './math.js';

// Market cap helpers
export {
  marketCapToTokenPrice,
  validateMarketCapParameters,
  marketCapToCurveParams,
  marketCapToSingleCurveParams,
  curveParamsToMarketCap,
} from './marketCapHelpers.js';

// Errors
export {
  CpmmErrorCode,
  CPMM_ERROR_MESSAGES,
  CpmmError,
  parseErrorFromLogs,
  isCpmmError,
  getErrorMessage,
} from './errors.js';
