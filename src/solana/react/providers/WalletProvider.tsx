/**
 * Wallet Context Provider for CPMM SDK
 *
 * Provides wallet connection state and methods using wallet-standard.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import type {
  StandardConnectFeature,
  StandardDisconnectFeature,
} from '@wallet-standard/features';

// ============================================================================
// Types
// ============================================================================

/**
 * Wallet with required Solana features
 */
export type SolanaWallet = Wallet & {
  features: StandardConnectFeature & Partial<StandardDisconnectFeature>;
};

/**
 * Wallet context value exposed to consumers
 */
export interface WalletContextValue {
  /** Currently selected wallet (null if none selected) */
  wallet: SolanaWallet | null;
  /** Currently connected account (null if not connected) */
  account: WalletAccount | null;
  /** Whether a wallet is currently connected */
  connected: boolean;
  /** Whether connection is in progress */
  connecting: boolean;
  /** List of available wallets */
  wallets: readonly SolanaWallet[];
  /** Select a wallet for connection */
  select: (wallet: SolanaWallet | null) => void;
  /** Connect to the selected wallet */
  connect: () => Promise<void>;
  /** Disconnect from the current wallet */
  disconnect: () => Promise<void>;
  /** Error from last operation */
  error: Error | null;
}

/**
 * Props for WalletProvider component
 */
export interface WalletProviderProps {
  /** Child components */
  children: ReactNode;
  /** Auto-connect to previously connected wallet */
  autoConnect?: boolean;
  /** Callback when wallet connects */
  onConnect?: (account: WalletAccount) => void;
  /** Callback when wallet disconnects */
  onDisconnect?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

// ============================================================================
// Wallet Standard Detection
// ============================================================================

/**
 * Check if a wallet supports the standard:connect feature
 */
function isConnectableWallet(wallet: Wallet): wallet is SolanaWallet {
  return 'standard:connect' in wallet.features;
}

/**
 * Get available wallets from the wallet-standard registry
 */
function getWallets(): SolanaWallet[] {
  // Check for wallet-standard global registry
  if (typeof window === 'undefined') {
    return [];
  }

  const registry = (window as any).navigator?.wallets;
  if (!registry) {
    return [];
  }

  // Get registered wallets that support Solana
  const wallets: SolanaWallet[] = [];

  try {
    const registered = registry.get?.() ?? [];
    for (const wallet of registered) {
      // Check if wallet supports Solana chains and connect feature
      const supportsSolana = wallet.chains?.some(
        (chain: string) => chain.startsWith('solana:')
      );
      if (supportsSolana && isConnectableWallet(wallet)) {
        wallets.push(wallet);
      }
    }
  } catch {
    // Registry access failed, return empty array
  }

  return wallets;
}

// ============================================================================
// Context
// ============================================================================

/**
 * React context for wallet state
 */
export const WalletContext = createContext<WalletContextValue | null>(null);

WalletContext.displayName = 'WalletContext';

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access wallet context
 *
 * @returns Wallet context value with connection state and methods
 * @throws Error if used outside WalletProvider
 *
 * @example
 * ```tsx
 * function ConnectButton() {
 *   const { connected, connect, disconnect, account } = useWallet();
 *
 *   if (connected) {
 *     return (
 *       <button onClick={disconnect}>
 *         Disconnect {account?.address.slice(0, 8)}...
 *       </button>
 *     );
 *   }
 *
 *   return <button onClick={connect}>Connect Wallet</button>;
 * }
 * ```
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return ctx;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create initial wallet context value
 *
 * This is exposed for testing purposes.
 */
export function createWalletContextValue(): WalletContextValue {
  return {
    wallet: null,
    account: null,
    connected: false,
    connecting: false,
    wallets: [],
    select: () => {},
    connect: async () => {},
    disconnect: async () => {},
    error: null,
  };
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Wallet Provider component
 *
 * Provides wallet connection state and methods to child components.
 * Uses the wallet-standard API for cross-wallet compatibility.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <WalletProvider autoConnect>
 *       <AmmProvider endpoint="https://api.mainnet-beta.solana.com">
 *         <SwapForm />
 *       </AmmProvider>
 *     </WalletProvider>
 *   );
 * }
 * ```
 *
 * @example
 * With callbacks:
 * ```tsx
 * function App() {
 *   return (
 *     <WalletProvider
 *       onConnect={(account) => console.log('Connected:', account.address)}
 *       onDisconnect={() => console.log('Disconnected')}
 *       onError={(err) => console.error('Wallet error:', err)}
 *     >
 *       <YourApp />
 *     </WalletProvider>
 *   );
 * }
 * ```
 */
export function WalletProvider({
  children,
  autoConnect = false,
  onConnect,
  onDisconnect,
  onError,
}: WalletProviderProps): JSX.Element {
  // State
  const [wallets, setWallets] = useState<SolanaWallet[]>([]);
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Derived state
  const connected = account !== null;

  // Discover available wallets on mount
  useEffect(() => {
    const discovered = getWallets();
    setWallets(discovered);

    // Listen for new wallets (wallet-standard events)
    if (typeof window !== 'undefined') {
      const registry = (window as any).navigator?.wallets;
      if (registry?.on) {
        const unsubscribe = registry.on('register', () => {
          setWallets(getWallets());
        });
        return () => {
          unsubscribe?.();
        };
      }
    }
    return undefined;
  }, []);

  // Select wallet
  const select = useCallback((newWallet: SolanaWallet | null) => {
    setWallet(newWallet);
    setError(null);
  }, []);

  // Connect to selected wallet
  const connect = useCallback(async () => {
    if (!wallet) {
      const err = new Error('No wallet selected');
      setError(err);
      onError?.(err);
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const connectFeature = wallet.features['standard:connect'];
      const result = await connectFeature.connect();

      if (result.accounts.length > 0) {
        const connectedAccount = result.accounts[0];
        setAccount(connectedAccount);
        onConnect?.(connectedAccount);
      } else {
        throw new Error('No accounts returned from wallet');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setConnecting(false);
    }
  }, [wallet, onConnect, onError]);

  // Disconnect from wallet
  const disconnect = useCallback(async () => {
    if (!wallet) {
      return;
    }

    try {
      const disconnectFeature = wallet.features['standard:disconnect'];
      if (disconnectFeature) {
        await disconnectFeature.disconnect();
      }
    } catch (err) {
      // Disconnect errors are typically not critical
      console.warn('Disconnect error:', err);
    } finally {
      setAccount(null);
      onDisconnect?.();
    }
  }, [wallet, onDisconnect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && wallet && !connected && !connecting) {
      // Try silent connect first
      const connectFeature = wallet.features['standard:connect'];
      connectFeature.connect({ silent: true }).then((result: Awaited<ReturnType<StandardConnectFeature['standard:connect']['connect']>>) => {
        if (result.accounts.length > 0) {
          setAccount(result.accounts[0]);
          onConnect?.(result.accounts[0]);
        }
      }).catch(() => {
        // Silent connect failed, that's okay
      });
    }
  }, [autoConnect, wallet, connected, connecting, onConnect]);

  // Listen for account changes
  useEffect(() => {
    if (!wallet) return undefined;

    // Listen for standard:events if supported
    const eventsFeature = (wallet.features as any)['standard:events'];
    if (eventsFeature?.on) {
      const unsubscribe = eventsFeature.on('change', () => {
        // Re-check accounts
        if (wallet.accounts.length > 0) {
          setAccount(wallet.accounts[0]);
        } else {
          setAccount(null);
          onDisconnect?.();
        }
      });
      return () => {
        unsubscribe?.();
      };
    }
    return undefined;
  }, [wallet, onDisconnect]);

  // Build context value
  const value = useMemo<WalletContextValue>(
    () => ({
      wallet,
      account,
      connected,
      connecting,
      wallets,
      select,
      connect,
      disconnect,
      error,
    }),
    [wallet, account, connected, connecting, wallets, select, connect, disconnect, error]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
