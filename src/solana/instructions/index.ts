// Generated CPMM instruction builders are the source of truth for account order
// and ABI encoding. Keep create* aliases only as a compatibility bridge.
export * from '../generated/cpmm/instructions/index.js';

export {
  getAddLiquidityInstruction as createAddLiquidityInstruction,
  getClosePositionInstruction as createClosePositionInstruction,
  getCollectFeesInstruction as createCollectFeesInstruction,
  getCollectProtocolFeesInstruction as createCollectProtocolFeesInstruction,
  getCreatePositionInstruction as createCreatePositionInstruction,
  getInitializeConfigInstruction as createInitializeConfigInstruction,
  getInitializeOracleInstruction as createInitializeOracleInstruction,
  getInitializePoolInstruction as createInitializePoolInstruction,
  getOracleConsultInstruction as createOracleConsultInstruction,
  getOracleUpdateInstruction as createOracleUpdateInstruction,
  getPauseInstruction as createPauseInstruction,
  getQuoteToNumeraireInstruction as createQuoteToNumeraireInstruction,
  getRemoveLiquidityInstruction as createRemoveLiquidityInstruction,
  getSetFeesInstruction as createSetFeesInstruction,
  getSetHookInstruction as createSetHookInstruction,
  getSetRouteInstruction as createSetRouteInstruction,
  getSwapExactInInstruction as createSwapExactInInstruction,
  getTransferAdminInstruction as createTransferAdminInstruction,
  getUnpauseInstruction as createUnpauseInstruction,
  getWithdrawVaultExcessInstruction as createWithdrawVaultExcessInstruction,
} from '../generated/cpmm/instructions/index.js';

export { createSwapInstruction, MAX_FEE_AMOUNT } from './swapExactIn.js';
