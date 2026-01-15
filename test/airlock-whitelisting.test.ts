import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set shorter timeout for individual tests (10s instead of default 60s)
vi.setConfig({ testTimeout: 10_000 });
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

const MODULE_STATE_NAMES: Record<number, string> = {
  0: 'NotWhitelisted',
  1: 'TokenFactory',
  2: 'GovernanceFactory',
  3: 'PoolInitializer',
  4: 'LiquidityMigrator',
};

// Track results for summary
interface TestResult {
  chain: string;
  chainId: number;
  module: string;
  address: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'RPC_ERROR';
  expected?: number;
  actual?: number;
  error?: string;
}

const testResults: TestResult[] = [];

// Chain ID to name mapping
const CHAIN_ID_NAMES: Record<number, string> = {
  1: 'Mainnet',
  8453: 'Base',
  84532: 'Base Sepolia',
  57073: 'Ink',
  130: 'Unichain',
  1301: 'Unichain Sepolia',
  10143: 'Monad Testnet',
  143: 'Monad Mainnet',
};

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

  // Print summary after all tests
  afterAll(() => {
    const failed = testResults.filter(r => r.status === 'FAIL' || r.status === 'RPC_ERROR');
    if (failed.length > 0 || testResults.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('  TEST RESULTS SUMMARY');
      console.log('='.repeat(80));

      // Group by chain
      const byChain = new Map<number, TestResult[]>();
      for (const r of testResults) {
        if (!byChain.has(r.chainId)) byChain.set(r.chainId, []);
        byChain.get(r.chainId)!.push(r);
      }

      for (const [chainId, results] of byChain) {
        const chainName = results[0]?.chain || `Chain ${chainId}`;
        const passed = results.filter(r => r.status === 'PASS').length;
        const failedCount = results.filter(r => r.status === 'FAIL' || r.status === 'RPC_ERROR').length;
        console.log(`\n  ${chainName} (${chainId}): ${passed} passed, ${failedCount} failed`);

        for (const r of results) {
          const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'SKIP' ? '[SKIP]' : '[FAIL]';
          console.log(`    ${icon} ${r.module}: ${r.address}`);
          if (r.status === 'FAIL') {
            console.log(`           Expected: ${MODULE_STATE_NAMES[r.expected!] || r.expected} (${r.expected})`);
            console.log(`           Actual:   ${MODULE_STATE_NAMES[r.actual!] || r.actual} (${r.actual})`);
          } else if (r.status === 'RPC_ERROR') {
            console.log(`           Error: ${r.error}`);
          }
        }
      }
      console.log('\n' + '='.repeat(80));
    }
  });

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
        { retryCount: 3, retryDelay: 1000 }
      );

      // Add delay before each test to avoid rate limiting
      beforeEach(async () => {
        await delay(RPC_DELAY_MS);
      });

      const chainName = CHAIN_ID_NAMES[chainId] || `Chain ${chainId}`;

      // Helper to test and record results
      async function testModule(
        moduleName: string,
        moduleAddress: Address,
        expectedState: ModuleState
      ) {
        const result: TestResult = {
          chain: chainName,
          chainId,
          module: moduleName,
          address: moduleAddress,
          status: 'PASS',
          expected: expectedState,
        };

        try {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [moduleAddress],
          })) as unknown as number;

          result.actual = Number(state);

          if (result.actual !== expectedState) {
            result.status = 'FAIL';
            testResults.push(result);
            throw new Error(
              `${moduleName} at ${moduleAddress} has wrong state.\n` +
              `  Expected: ${MODULE_STATE_NAMES[expectedState]} (${expectedState})\n` +
              `  Actual:   ${MODULE_STATE_NAMES[result.actual]} (${result.actual})`
            );
          }

          testResults.push(result);
        } catch (err) {
          if (result.status !== 'FAIL') {
            result.status = 'RPC_ERROR';
            result.error = err instanceof Error ? err.message : String(err);
            testResults.push(result);
          }
          throw err;
        }
      }

      (addresses.tokenFactory === ZERO_ADDRESS ? it.skip : it)(
        `TokenFactory (${addresses.tokenFactory}) whitelisted`,
        () => testModule('TokenFactory', addresses.tokenFactory, ModuleState.TokenFactory)
      );

      (addresses.governanceFactory === ZERO_ADDRESS ? it.skip : it)(
        `GovernanceFactory (${addresses.governanceFactory}) whitelisted`,
        () => testModule('GovernanceFactory', addresses.governanceFactory, ModuleState.GovernanceFactory)
      );

      (addresses.v3Initializer === ZERO_ADDRESS ? it.skip : it)(
        `V3Initializer (${addresses.v3Initializer}) whitelisted`,
        () => testModule('V3Initializer', addresses.v3Initializer, ModuleState.PoolInitializer)
      );

      (addresses.v4Initializer === ZERO_ADDRESS ? it.skip : it)(
        `V4Initializer (${addresses.v4Initializer}) whitelisted`,
        () => testModule('V4Initializer', addresses.v4Initializer, ModuleState.PoolInitializer)
      );

      if (
        addresses.lockableV3Initializer &&
        addresses.lockableV3Initializer !== ZERO_ADDRESS
      ) {
        it(`LockableV3Initializer (${addresses.lockableV3Initializer}) whitelisted`,
          () => testModule('LockableV3Initializer', addresses.lockableV3Initializer!, ModuleState.PoolInitializer)
        );
      }

      if (
        addresses.v4MulticurveInitializer &&
        addresses.v4MulticurveInitializer !== ZERO_ADDRESS
      ) {
        it(`V4MulticurveInitializer (${addresses.v4MulticurveInitializer}) whitelisted`,
          () => testModule('V4MulticurveInitializer', addresses.v4MulticurveInitializer!, ModuleState.PoolInitializer)
        );
      }

      if (
        addresses.v4ScheduledMulticurveInitializer &&
        addresses.v4ScheduledMulticurveInitializer !== ZERO_ADDRESS
      ) {
        it(`V4ScheduledMulticurveInitializer (${addresses.v4ScheduledMulticurveInitializer}) whitelisted`,
          () => testModule('V4ScheduledMulticurveInitializer', addresses.v4ScheduledMulticurveInitializer!, ModuleState.PoolInitializer)
        );
      }

      (addresses.v2Migrator === ZERO_ADDRESS ? it.skip : it)(
        `V2Migrator (${addresses.v2Migrator}) whitelisted`,
        () => testModule('V2Migrator', addresses.v2Migrator, ModuleState.LiquidityMigrator)
      );

      (addresses.v4Migrator === ZERO_ADDRESS ? it.skip : it)(
        `V4Migrator (${addresses.v4Migrator}) whitelisted`,
        () => testModule('V4Migrator', addresses.v4Migrator, ModuleState.LiquidityMigrator)
      );

      if (addresses.noOpMigrator && addresses.noOpMigrator !== ZERO_ADDRESS) {
        it(`NoOpMigrator (${addresses.noOpMigrator}) whitelisted`,
          () => testModule('NoOpMigrator', addresses.noOpMigrator!, ModuleState.LiquidityMigrator)
        );
      }

      if (
        addresses.noOpGovernanceFactory &&
        addresses.noOpGovernanceFactory !== ZERO_ADDRESS
      ) {
        it(`NoOpGovernanceFactory (${addresses.noOpGovernanceFactory}) whitelisted`,
          () => testModule('NoOpGovernanceFactory', addresses.noOpGovernanceFactory!, ModuleState.GovernanceFactory)
        );
      }
    });
  }
});
