// Instruction builders for CPMM SDK

// ============================================================================
// Admin/Setup Instructions
// ============================================================================

// Config initialization
export {
  createInitializeConfigInstruction,
  type InitializeConfigAccounts,
} from './initializeConfig.js';

// Pool initialization
export {
  createInitializePoolInstruction,
  type InitializePoolAccounts,
} from './initializePool.js';

// Oracle initialization
export {
  createInitializeOracleInstruction,
  type InitializeOracleAccounts,
} from './initializeOracle.js';

// Admin controls
export {
  createSetFeesInstruction,
  type SetFeesAccounts,
} from './setFees.js';

export {
  createSetSentinelInstruction,
  type SetSentinelAccounts,
} from './setSentinel.js';

export {
  createSetRouteInstruction,
  type SetRouteAccounts,
} from './setRoute.js';

export {
  createPauseInstruction,
  type PauseAccounts,
} from './pause.js';

export {
  createUnpauseInstruction,
  type UnpauseAccounts,
} from './unpause.js';

export {
  createTransferAdminInstruction,
  type TransferAdminAccounts,
} from './transferAdmin.js';

export {
  createSkimInstruction,
  type SkimAccounts,
} from './skim.js';

// ============================================================================
// Trading Instructions
// ============================================================================

// Swap
export {
  createSwapExactInInstruction,
  createSwapInstruction,
  type SwapExactInAccounts,
} from './swapExactIn.js';

// ============================================================================
// Position Lifecycle
// ============================================================================

export {
  createCreatePositionInstruction,
  type CreatePositionAccounts,
} from './createPosition.js';

export {
  createClosePositionInstruction,
  type ClosePositionAccounts,
} from './closePosition.js';

// ============================================================================
// Liquidity Management
// ============================================================================

export {
  createAddLiquidityInstruction,
  type AddLiquidityAccounts,
  type AddLiquidityArgsWithOracle,
} from './addLiquidity.js';

export {
  createRemoveLiquidityInstruction,
  type RemoveLiquidityAccounts,
} from './removeLiquidity.js';

// ============================================================================
// Fee Collection
// ============================================================================

export {
  createCollectFeesInstruction,
  MAX_FEE_AMOUNT,
  type CollectFeesAccounts,
} from './collectFees.js';

export {
  createCollectProtocolFeesInstruction,
  type CollectProtocolFeesAccounts,
} from './collectProtocolFees.js';

// ============================================================================
// Oracle Operations
// ============================================================================

export {
  createOracleUpdateInstruction,
  type OracleUpdateAccounts,
} from './oracleUpdate.js';

export {
  createOracleConsultInstruction,
  type OracleConsultAccounts,
  type OracleConsultResult,
  decodeOracleConsultResult,
} from './oracleConsult.js';

export {
  createQuoteToNumeraireInstruction,
  type QuoteToNumeraireAccounts,
  type QuoteToNumeraireResult,
  decodeQuoteToNumeraireResult,
} from './quoteToNumeraire.js';
