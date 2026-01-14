import { describe, it, expect, beforeEach } from 'vitest';
import { type Address, type Chain } from 'viem';
import {
  base,
  baseSepolia,
  mainnet,
  ink,
  unichain,
  unichainSepolia,
} from 'viem/chains';
import {
  CHAIN_IDS,
  getAddresses,
  airlockAbi,
  type SupportedChainId,
} from '../src';
import { createRateLimitedClient, delay } from './utils/rpc';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

// Use more conservative delay for this test file (many sequential RPC calls)
// Can be overridden via RPC_DELAY_MS env var for workflow_dispatch
const RPC_DELAY_MS = Number(process.env.RPC_DELAY_MS) || 500;

// Chain name mapping for TEST_CHAINS env var filtering
const CHAIN_NAME_TO_ID: Record<string, SupportedChainId> = {
  base: CHAIN_IDS.BASE,
  'base-sepolia': CHAIN_IDS.BASE_SEPOLIA,
  mainnet: CHAIN_IDS.MAINNET,
  ink: CHAIN_IDS.INK,
  unichain: CHAIN_IDS.UNICHAIN,
  'unichain-sepolia': CHAIN_IDS.UNICHAIN_SEPOLIA,
  'monad-testnet': CHAIN_IDS.MONAD_TESTNET,
  'monad-mainnet': CHAIN_IDS.MONAD_MAINNET,
};

// Parse TEST_CHAINS env var (comma-separated chain names or 'all')
function getTestChainIds(): SupportedChainId[] {
  const testChains = process.env.TEST_CHAINS?.toLowerCase().trim();
  if (!testChains || testChains === 'all') {
    return Object.values(CHAIN_IDS) as SupportedChainId[];
  }
  const chainNames = testChains.split(',').map((s) => s.trim());
  const chainIds: SupportedChainId[] = [];
  for (const name of chainNames) {
    const id = CHAIN_NAME_TO_ID[name];
    if (id !== undefined) {
      chainIds.push(id);
    } else {
      console.warn(`Unknown chain name: ${name}`);
    }
  }
  return chainIds;
}

enum ModuleState {
  NotWhitelisted = 0,
  TokenFactory = 1,
  GovernanceFactory = 2,
  PoolInitializer = 3,
  LiquidityMigrator = 4,
}

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const getAlchemyRpc = (network: string) =>
  ALCHEMY_API_KEY
    ? `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : undefined;

// Custom chain definition for Monad Testnet
const monadTestnet: Chain = {
  id: CHAIN_IDS.MONAD_TESTNET,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
};

// Custom chain definition for Monad Mainnet
const monadMainnet: Chain = {
  id: CHAIN_IDS.MONAD_MAINNET,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
};

const CHAINS: Partial<Record<SupportedChainId, { chain: Chain; rpc?: string }>> =
  {
    [CHAIN_IDS.MAINNET]: {
      chain: mainnet,
      rpc: getAlchemyRpc('eth-mainnet'),
    },
    [CHAIN_IDS.BASE]: {
      chain: base,
      rpc: getAlchemyRpc('base-mainnet'),
    },
    [CHAIN_IDS.BASE_SEPOLIA]: {
      chain: baseSepolia,
      rpc: getAlchemyRpc('base-sepolia'),
    },
    [CHAIN_IDS.INK]: {
      chain: ink,
      rpc: getAlchemyRpc('ink-mainnet'),
    },
    [CHAIN_IDS.UNICHAIN]: {
      chain: unichain,
      rpc: getAlchemyRpc('unichain-mainnet'),
    },
    [CHAIN_IDS.UNICHAIN_SEPOLIA]: {
      chain: unichainSepolia,
      rpc: getAlchemyRpc('unichain-sepolia'),
    },
    [CHAIN_IDS.MONAD_TESTNET]: {
      chain: monadTestnet,
      rpc: getAlchemyRpc('monad-testnet'),
    },
    [CHAIN_IDS.MONAD_MAINNET]: {
      chain: monadMainnet,
      rpc: getAlchemyRpc('monad-mainnet'),
    },
  };

describe('Airlock Module Whitelisting', () => {
  // Use filtered chain IDs from env var (defaults to all)
  const supportedChainIds = getTestChainIds();

  for (const chainId of supportedChainIds) {
    describe(`Chain ${chainId}`, () => {
      const addresses = getAddresses(chainId);
      const config = CHAINS[chainId];

      if (!config) {
        it.skip(`Chain config not defined for chain ${chainId}`);
        return;
      }

      if (addresses.airlock === ZERO_ADDRESS) {
        it.skip(`Airlock not deployed on chain ${chainId}`);
        return;
      }

      const publicClient = createRateLimitedClient(
        config.chain,
        config.rpc,
        { retryCount: 5, retryDelay: 2000 }
      );

      // Add delay before each test to avoid rate limiting
      beforeEach(async () => {
        await delay(RPC_DELAY_MS);
      });

      (addresses.tokenFactory === ZERO_ADDRESS ? it.skip : it)(
        'should have TokenFactory whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.tokenFactory],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.TokenFactory);
        }
      );

      (addresses.governanceFactory === ZERO_ADDRESS ? it.skip : it)(
        'should have GovernanceFactory whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.governanceFactory],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.GovernanceFactory);
        }
      );

      (addresses.v3Initializer === ZERO_ADDRESS ? it.skip : it)(
        'should have V3Initializer whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v3Initializer],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        }
      );

      (addresses.v4Initializer === ZERO_ADDRESS ? it.skip : it)(
        'should have V4Initializer whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4Initializer],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        }
      );

      if (
        addresses.lockableV3Initializer &&
        addresses.lockableV3Initializer !== ZERO_ADDRESS
      ) {
        it('should have LockableV3Initializer whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.lockableV3Initializer!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        });
      }

      if (
        addresses.v4MulticurveInitializer &&
        addresses.v4MulticurveInitializer !== ZERO_ADDRESS
      ) {
        it('should have V4MulticurveInitializer whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4MulticurveInitializer!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        });
      }

      if (
        addresses.v4ScheduledMulticurveInitializer &&
        addresses.v4ScheduledMulticurveInitializer !== ZERO_ADDRESS
      ) {
        it('should have V4ScheduledMulticurveInitializer whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4ScheduledMulticurveInitializer!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        });
      }

      (addresses.v2Migrator === ZERO_ADDRESS ? it.skip : it)(
        'should have V2Migrator whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v2Migrator],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.LiquidityMigrator);
        }
      );

      (addresses.v4Migrator === ZERO_ADDRESS ? it.skip : it)(
        'should have V4Migrator whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4Migrator],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.LiquidityMigrator);
        }
      );

      if (addresses.noOpMigrator && addresses.noOpMigrator !== ZERO_ADDRESS) {
        it('should have NoOpMigrator whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.noOpMigrator!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.LiquidityMigrator);
        });
      }

      if (
        addresses.noOpGovernanceFactory &&
        addresses.noOpGovernanceFactory !== ZERO_ADDRESS
      ) {
        it('should have NoOpGovernanceFactory whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.noOpGovernanceFactory!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.GovernanceFactory);
        });
      }
    });
  }
});
