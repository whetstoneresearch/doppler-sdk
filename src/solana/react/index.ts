/**
 * React bindings for CPMM SDK
 *
 * @packageDocumentation
 */

// ============================================================================
// Providers
// ============================================================================

export {
  // AMM Provider
  AmmContext,
  AmmProvider,
  useAmm,
  useAmmOptional,
  // Endpoint-based AMM Provider
  EndpointAmmProvider,
  EndpointAmmContext,
  useEndpointAmm,
  createAmmContextValue,
  // Wallet Provider
  WalletContext,
  WalletProvider,
  useWallet,
  useWalletOptional,
  useWalletAddress,
  // Wallet-standard Provider
  WalletStandardProvider,
  WalletStandardContext,
  useStandardWallet,
  createWalletContextValue,
} from './providers/index.js';

// Types
export type {
  // AMM types
  AmmContextValue,
  AmmProviderProps,
  AmmConfig,
  // Wallet types
  WalletContextValue,
  WalletProviderProps,
  WalletState,
  // Endpoint-based AMM types
  EndpointAmmContextValue,
  EndpointAmmProviderProps,
  AmmContextConfig,
  Commitment,
  // Wallet-standard types
  WalletStandardContextValue,
  WalletStandardProviderProps,
  SolanaWallet,
} from './providers/index.js';

// ============================================================================
// Hooks
// ============================================================================

export {
  // Pool hooks
  usePool,
  usePools,
  // Swap hooks
  useSwap,
  // Liquidity hooks
  useLiquidity,
  // Position hooks
  usePosition,
  useUserPositions,
  // Fee hooks
  useFees,
  useFeesFromData,
  // Oracle hooks
  useOracle,
  useTwap,
  useOracles,
} from './hooks/index.js';

// Hook types
export type {
  // Pool types
  UsePoolResult,
  UsePoolOptions,
  // Swap types
  SwapState,
  SwapQuoteResult,
  UseSwapResult,
  UseSwapOptions,
  // Liquidity types
  LiquidityMode,
  AddLiquidityState,
  RemoveLiquidityState,
  AddLiquidityQuoteResult,
  RemoveLiquidityQuoteResult,
  UseLiquidityResult,
  UseLiquidityOptions,
  // Position types
  UsePositionResult,
  UsePositionOptions,
  UseUserPositionsResult,
  // Fee types
  TransactionStatus,
  PendingFees,
  CollectFeesOptions,
  UseFeesResult,
  UseFeesOptions,
  // Oracle types
  UseOracleResult,
  UseOracleOptions,
} from './hooks/index.js';

// ============================================================================
// Components
// ============================================================================

export {
  ConnectWallet,
  SwapCard,
  LiquidityPanel,
  PoolStats,
  PositionCard,
} from './components/index.js';

// Component types
export type {
  ConnectWalletProps,
  SwapCardProps,
  TokenInfo,
  LiquidityPanelProps,
  PoolStatsProps,
  PositionCardProps,
} from './components/index.js';
