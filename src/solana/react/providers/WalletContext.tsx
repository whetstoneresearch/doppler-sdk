/**
 * Wallet Context Provider
 *
 * Provides wallet connection state and transaction signing for CPMM SDK hooks.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Address } from '@solana/kit';
import type { TransactionSigner } from '@solana/kit';

/**
 * Wallet state and capabilities
 */
export interface WalletState {
  /** Whether a wallet is connected */
  connected: boolean;
  /** Connected wallet address (undefined if not connected) */
  address?: Address;
  /** Transaction signer (undefined if not connected) */
  signer?: TransactionSigner;
  /** Connect wallet function */
  connect?: () => Promise<void>;
  /** Disconnect wallet function */
  disconnect?: () => Promise<void>;
}

/**
 * Context value provided to consumers
 */
export interface WalletContextValue extends WalletState {
  /** Sign and send a transaction */
  signAndSendTransaction?: (
    transaction: unknown
  ) => Promise<string>;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Props for the WalletProvider component
 */
export interface WalletProviderProps {
  /** Wallet state from your wallet adapter */
  wallet: WalletState;
  /** Optional sign and send transaction handler */
  signAndSendTransaction?: WalletContextValue['signAndSendTransaction'];
  children: ReactNode;
}

/**
 * Provider component for wallet state
 *
 * This provider wraps your existing wallet adapter to provide
 * a consistent interface for CPMM SDK hooks.
 *
 * @example
 * ```tsx
 * // With @solana/wallet-adapter-react
 * import { useWallet } from '@solana/wallet-adapter-react';
 *
 * function WalletBridge({ children }) {
 *   const { connected, publicKey, signTransaction } = useWallet();
 *
 *   const wallet = useMemo(() => ({
 *     connected,
 *     address: publicKey?.toBase58() as Address | undefined,
 *     signer: signTransaction ? { signTransactions: async (txs) => txs.map(signTransaction) } : undefined,
 *   }), [connected, publicKey, signTransaction]);
 *
 *   return (
 *     <WalletProvider wallet={wallet}>
 *       {children}
 *     </WalletProvider>
 *   );
 * }
 * ```
 */
export function WalletProvider({
  wallet,
  signAndSendTransaction,
  children,
}: WalletProviderProps) {
  const value = useMemo<WalletContextValue>(
    () => ({
      ...wallet,
      signAndSendTransaction,
    }),
    [wallet, signAndSendTransaction]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

/**
 * Hook to access the wallet context
 *
 * @throws Error if used outside of WalletProvider
 */
export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

/**
 * Hook to access the wallet context, returning null if not available
 */
export function useWalletOptional(): WalletContextValue | null {
  return useContext(WalletContext);
}

/**
 * Hook to get connected wallet address
 *
 * @throws Error if wallet is not connected
 */
export function useWalletAddress(): Address {
  const { connected, address } = useWallet();
  if (!connected || !address) {
    throw new Error('Wallet is not connected');
  }
  return address;
}
