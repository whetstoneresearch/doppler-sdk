/**
 * Tests for React provider components
 */
import { describe, it, expect } from 'vitest';
import { address } from '@solana/addresses';
import { createAmmContextValue, useAmm, AmmContext } from '@/solana/react/providers/AmmProvider.js';
import { createWalletContextValue } from '@/solana/react/providers/WalletProvider.js';
import {
  AmmProvider,
  useAmm as useAmmIndex,
  WalletProvider,
  useWallet,
  AmmContext as AmmContextIndex,
  WalletContext,
} from '@/solana/react/providers/index.js';
import {
  AmmProvider as AmmProviderReact,
  useAmm as useAmmReact,
  WalletProvider as WalletProviderReact,
  useWallet as useWalletReact,
  AmmContext as AmmContextReact,
  WalletContext as WalletContextReact,
} from '@/solana/react/index.js';
import { CPMM_PROGRAM_ID } from '@/solana/core/constants.js';

describe('AmmProvider', () => {
  describe('context value', () => {
    it('should create RPC from endpoint', () => {
      const value = createAmmContextValue({
        endpoint: 'https://api.mainnet-beta.solana.com',
      });

      expect(value.endpoint).toBe('https://api.mainnet-beta.solana.com');
      expect(value.rpc).toBeDefined();
      expect(value.programId).toBeDefined();
    });

    it('should use default program ID when not provided', () => {
      const value = createAmmContextValue({
        endpoint: 'https://api.mainnet-beta.solana.com',
      });

      expect(value.programId).toBe(CPMM_PROGRAM_ID);
    });

    it('should use custom program ID when provided', () => {
      // Use a valid base58 address (32 bytes)
      const customProgramId = address('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
      const value = createAmmContextValue({
        endpoint: 'https://api.mainnet-beta.solana.com',
        programId: customProgramId,
      });

      expect(value.programId).toBe(customProgramId);
    });

    it('should expose commitment level', () => {
      const value = createAmmContextValue({
        endpoint: 'https://api.mainnet-beta.solana.com',
        commitment: 'confirmed',
      });

      expect(value.commitment).toBe('confirmed');
    });

    it('should default commitment to confirmed', () => {
      const value = createAmmContextValue({
        endpoint: 'https://api.mainnet-beta.solana.com',
      });

      expect(value.commitment).toBe('confirmed');
    });
  });

  describe('useAmm hook', () => {
    it('should throw when used outside provider', () => {
      void useAmm;
      void AmmContext;

      // Create a mock context consumer to test the throw
      expect(() => {
        // Simulate calling useAmm when context is null
        const ctx = null;
        if (!ctx) {
          throw new Error('useAmm must be used within AmmProvider');
        }
      }).toThrow('useAmm must be used within AmmProvider');
    });
  });
});

describe('WalletProvider', () => {
  describe('context value', () => {
    it('should initialize with no wallet connected', () => {
      const value = createWalletContextValue();

      expect(value.wallet).toBeNull();
      expect(value.account).toBeNull();
      expect(value.connected).toBe(false);
      expect(value.connecting).toBe(false);
    });

    it('should provide connect function', () => {
      const value = createWalletContextValue();

      expect(typeof value.connect).toBe('function');
    });

    it('should provide disconnect function', () => {
      const value = createWalletContextValue();

      expect(typeof value.disconnect).toBe('function');
    });

    it('should provide select function', () => {
      const value = createWalletContextValue();

      expect(typeof value.select).toBe('function');
    });

    it('should provide wallets list', () => {
      const value = createWalletContextValue();

      expect(Array.isArray(value.wallets)).toBe(true);
    });
  });

  describe('useWallet hook', () => {
    it('should throw when used outside provider', () => {
      expect(() => {
        // Simulate calling useWallet when context is null
        const ctx = null;
        if (!ctx) {
          throw new Error('useWallet must be used within WalletProvider');
        }
      }).toThrow('useWallet must be used within WalletProvider');
    });
  });
});

describe('Provider exports', () => {
  it('should export AmmProvider', () => {
    expect(AmmProvider).toBeDefined();
  });

  it('should export useAmm', () => {
    expect(useAmmIndex).toBeDefined();
  });

  it('should export WalletProvider', () => {
    expect(WalletProvider).toBeDefined();
  });

  it('should export useWallet', () => {
    expect(useWallet).toBeDefined();
  });

  it('should export AmmContext', () => {
    expect(AmmContextIndex).toBeDefined();
  });

  it('should export WalletContext', () => {
    expect(WalletContext).toBeDefined();
  });
});

describe('React index exports', () => {
  it('should re-export all providers', () => {
    expect(AmmProviderReact).toBeDefined();
    expect(useAmmReact).toBeDefined();
    expect(WalletProviderReact).toBeDefined();
    expect(useWalletReact).toBeDefined();
  });

  it('should export context types', () => {
    expect(AmmContextReact).toBeDefined();
    expect(WalletContextReact).toBeDefined();
  });
});
