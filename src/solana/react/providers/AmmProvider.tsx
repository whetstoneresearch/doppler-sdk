/**
 * AMM Context Provider for CPMM SDK
 *
 * Provides RPC connection and program configuration to child components.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Address } from '@solana/kit';
import type { Rpc, SolanaRpcApi } from '@solana/kit';
import { createSolanaRpc } from '@solana/kit';
import { PROGRAM_ID } from '../../core/constants.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Commitment level for RPC requests
 */
export type Commitment = 'processed' | 'confirmed' | 'finalized';

/**
 * AMM context value exposed to consumers
 */
export interface AmmContextValue {
  /** RPC client for Solana interactions */
  rpc: Rpc<SolanaRpcApi>;
  /** RPC endpoint URL */
  endpoint: string;
  /** CPMM program ID */
  programId: Address;
  /** Default commitment level */
  commitment: Commitment;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval: number;
  /** Default slippage tolerance in basis points */
  defaultSlippageBps: number;
}

/**
 * Props for AmmProvider component
 */
export interface AmmProviderProps {
  /** Child components */
  children: ReactNode;
  /** Solana RPC endpoint URL */
  endpoint: string;
  /** Custom CPMM program ID (defaults to mainnet program) */
  programId?: Address;
  /** Default commitment level (defaults to 'confirmed') */
  commitment?: Commitment;
  /** Auto-refresh interval in milliseconds (defaults to 30000) */
  refreshInterval?: number;
  /** Default slippage tolerance in basis points (defaults to 50 = 0.5%) */
  defaultSlippageBps?: number;
}

/**
 * Configuration for creating AMM context value
 */
export interface AmmContextConfig {
  /** Solana RPC endpoint URL */
  endpoint: string;
  /** Custom CPMM program ID */
  programId?: Address;
  /** Default commitment level */
  commitment?: Commitment;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Default slippage tolerance in basis points */
  defaultSlippageBps?: number;
}

// ============================================================================
// Context
// ============================================================================

/**
 * React context for AMM configuration
 */
export const AmmContext = createContext<AmmContextValue | null>(null);

AmmContext.displayName = 'AmmContext';

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access AMM context
 *
 * @returns AMM context value with RPC client and configuration
 * @throws Error if used outside AmmProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { rpc, programId } = useAmm();
 *   // Use rpc to fetch pool data, etc.
 * }
 * ```
 */
export function useAmm(): AmmContextValue {
  const ctx = useContext(AmmContext);
  if (!ctx) {
    throw new Error('useAmm must be used within AmmProvider');
  }
  return ctx;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create AMM context value from configuration
 *
 * This is exposed for testing purposes and internal use.
 *
 * @param config - Configuration for the AMM context
 * @returns AMM context value
 */
export function createAmmContextValue(
  config: AmmContextConfig,
): AmmContextValue {
  const {
    endpoint,
    programId,
    commitment = 'confirmed',
    refreshInterval = 30000,
    defaultSlippageBps = 50,
  } = config;

  // Create RPC client using @solana/rpc
  const rpc = createSolanaRpc(endpoint);

  return {
    rpc,
    endpoint,
    programId: programId ?? PROGRAM_ID,
    commitment,
    refreshInterval,
    defaultSlippageBps,
  };
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * AMM Provider component
 *
 * Provides RPC connection and program configuration to child components.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AmmProvider endpoint="https://api.mainnet-beta.solana.com">
 *       <SwapForm />
 *     </AmmProvider>
 *   );
 * }
 * ```
 *
 * @example
 * With custom program ID:
 * ```tsx
 * import { address } from '@solana/kit';
 *
 * function App() {
 *   return (
 *     <AmmProvider
 *       endpoint="https://api.devnet.solana.com"
 *       programId={address('DevnetProgramId...')}
 *       commitment="confirmed"
 *     >
 *       <SwapForm />
 *     </AmmProvider>
 *   );
 * }
 * ```
 */
export function AmmProvider({
  children,
  endpoint,
  programId,
  commitment = 'confirmed',
  refreshInterval = 30000,
  defaultSlippageBps = 50,
}: AmmProviderProps): JSX.Element {
  const value = useMemo(
    () =>
      createAmmContextValue({
        endpoint,
        programId,
        commitment,
        refreshInterval,
        defaultSlippageBps,
      }),
    [endpoint, programId, commitment, refreshInterval, defaultSlippageBps],
  );

  return <AmmContext.Provider value={value}>{children}</AmmContext.Provider>;
}
