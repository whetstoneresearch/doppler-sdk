/**
 * React Providers for CPMM SDK
 */

// ============================================================================
// AMM Provider (RPC-based, used by hooks)
// ============================================================================

export {
  AmmContext,
  AmmProvider,
  useAmm,
  useAmmOptional,
} from './AmmContext.js';

export type {
  AmmConfig,
  AmmContextValue,
  AmmProviderProps,
} from './AmmContext.js';

// ============================================================================
// Wallet Provider (wallet-adapter compatible, used by hooks)
// ============================================================================

export {
  WalletContext,
  WalletProvider,
  useWallet,
  useWalletOptional,
  useWalletAddress,
} from './WalletContext.js';

export type {
  WalletState,
  WalletContextValue,
  WalletProviderProps,
} from './WalletContext.js';

// ============================================================================
// Endpoint-based AMM Provider (wallet-standard optional)
// ============================================================================

export {
  AmmProvider as EndpointAmmProvider,
  AmmContext as EndpointAmmContext,
  useAmm as useEndpointAmm,
  createAmmContextValue,
} from './AmmProvider.js';

export type {
  AmmContextValue as EndpointAmmContextValue,
  AmmProviderProps as EndpointAmmProviderProps,
  AmmContextConfig,
  Commitment,
} from './AmmProvider.js';

// ============================================================================
// Wallet-standard Provider
// ============================================================================

export {
  WalletProvider as WalletStandardProvider,
  WalletContext as WalletStandardContext,
  useWallet as useStandardWallet,
  createWalletContextValue,
} from './WalletProvider.js';

export type {
  WalletContextValue as WalletStandardContextValue,
  WalletProviderProps as WalletStandardProviderProps,
  SolanaWallet,
} from './WalletProvider.js';
