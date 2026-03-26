/**
 * AMM Context Provider
 *
 * Provides RPC connection and program configuration for CPMM SDK hooks.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Address } from '@solana/kit';
import type { Rpc, SolanaRpcApi } from '@solana/kit';
import { CPMM_PROGRAM_ID } from '../../core/constants.js';

/**
 * Configuration for the AMM provider
 */
export interface AmmConfig {
  /** Solana RPC client */
  rpc: Rpc<SolanaRpcApi>;
  /** CPMM Program ID (defaults to mainnet program) */
  programId?: Address;
  /** Default commitment level for queries */
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Default slippage tolerance in basis points (default: 50 = 0.5%) */
  defaultSlippageBps?: number;
}

/**
 * Context value provided to consumers
 */
export interface AmmContextValue extends Required<Omit<AmmConfig, 'rpc'>> {
  /** Solana RPC client */
  rpc: Rpc<SolanaRpcApi>;
}

export const AmmContext = createContext<AmmContextValue | null>(null);

/**
 * Props for the AmmProvider component
 */
export interface AmmProviderProps extends AmmConfig {
  children: ReactNode;
}

/**
 * Provider component for CPMM SDK hooks
 *
 * @example
 * ```tsx
 * import { createSolanaRpc } from '@solana/kit';
 *
 * const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
 *
 * function App() {
 *   return (
 *     <AmmProvider rpc={rpc}>
 *       <YourApp />
 *     </AmmProvider>
 *   );
 * }
 * ```
 */
export function AmmProvider({
  rpc,
  programId = CPMM_PROGRAM_ID,
  commitment = 'confirmed',
  refreshInterval = 30000,
  defaultSlippageBps = 50,
  children,
}: AmmProviderProps) {
  const value = useMemo<AmmContextValue>(
    () => ({
      rpc,
      programId,
      commitment,
      refreshInterval,
      defaultSlippageBps,
    }),
    [rpc, programId, commitment, refreshInterval, defaultSlippageBps],
  );

  return <AmmContext.Provider value={value}>{children}</AmmContext.Provider>;
}

/**
 * Hook to access the AMM context
 *
 * @throws Error if used outside of AmmProvider
 */
export function useAmm(): AmmContextValue {
  const context = useContext(AmmContext);
  if (!context) {
    throw new Error('useAmm must be used within an AmmProvider');
  }
  return context;
}

/**
 * Hook to access the AMM context, returning null if not available
 */
export function useAmmOptional(): AmmContextValue | null {
  return useContext(AmmContext);
}
