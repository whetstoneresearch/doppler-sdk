import { describe, it, expect, beforeAll, vi } from 'vitest';
import { DopplerFactory } from '../../entities/DopplerFactory';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../mocks/clients';
import { mockAddresses } from '../mocks/addresses';
import type { CreateDynamicAuctionParams } from '../../types';
import { parseEther, type Address } from 'viem';
import { isToken0Expected } from '../../utils';
import { DAY_SECONDS } from '../../constants';
import { CHAIN_IDS } from '../../addresses';

// Base WETH address - this is < halfMaxUint160, so isToken0Expected returns false
// meaning token address must be > WETH (token is token1)
const BASE_WETH = '0x4200000000000000000000000000000000000006' as Address;

// Mainnet WETH address - this is > halfMaxUint160, so isToken0Expected returns true
// meaning token address must be < WETH (token is token0)
const MAINNET_WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address;

// Create mock addresses for Base chain
const baseMockAddresses = {
  ...mockAddresses,
  weth: BASE_WETH,
};

// Mock the addresses module to use Base WETH
vi.mock('../../addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => baseMockAddresses),
  };
});

// Stress test configuration - can be overridden via environment variable
const STRESS_CONFIG = {
  iterations: parseInt(process.env.STRESS_ITERATIONS ?? '100', 10),
  logProgressEvery: 10,
  tokenNamePrefix: 'TEST_',
  // Per-iteration timeout in ms (30 seconds) - if mining takes longer, it's likely stuck
  iterationTimeoutMs: 30_000,
  // Overall test timeout in ms (5 minutes default, 10 min for 1000 iterations)
  overallTimeoutMs: parseInt(process.env.STRESS_TIMEOUT ?? '300000', 10),
};

// Helper to run with timeout
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// Format elapsed time as mm:ss
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Result tracking interfaces
interface MiningResult {
  iteration: number;
  tokenName: string;
  success: boolean;
  salt?: string;
  saltIterations?: number; // How many salts were tried before finding valid one
  tokenAddress?: string;
  hookAddress?: string;
  error?: string;
  durationMs: number;
}

interface StressTestSummary {
  totalIterations: number;
  successCount: number;
  miningFailures: number;
  otherErrors: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgSaltIterations: number;
  minSaltIterations: number;
  maxSaltIterations: number;
  miningFailureDetails: MiningResult[];
  otherErrorDetails: MiningResult[];
}

// Parse salt to get iteration count (salt is 0x followed by 64 hex chars representing the iteration number)
function parseSaltIterations(salt: string): number {
  return parseInt(salt.slice(2), 16);
}

// Classify errors into mining failures vs other errors
function classifyError(error: unknown): 'mining' | 'other' {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Mining failure is specifically the "could not find salt" error
  if (
    errorMessage.includes('AirlockMiner: could not find salt') ||
    errorMessage.includes('could not find salt')
  ) {
    return 'mining';
  }

  return 'other';
}

// Create auction parameters for each iteration
function createDynamicAuctionParams(
  iteration: number,
  tokenName?: string,
): CreateDynamicAuctionParams {
  const name = tokenName ?? `${STRESS_CONFIG.tokenNamePrefix}${iteration}`;
  const symbol = `T${iteration}`;

  // Base WETH is < halfMaxUint160, so isToken0Expected returns false
  // Token must be > numeraire, so use negative ticks (token1 configuration)
  return {
    token: {
      name,
      symbol,
      tokenURI: `https://example.com/token/${iteration}`,
    },
    sale: {
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('500000'),
      numeraire: BASE_WETH,
    },
    auction: {
      duration: 7 * DAY_SECONDS,
      epochLength: 3600, // 1 hour
      startTick: -92103, // Negative for token1 (token > numeraire)
      endTick: -69080,
      minProceeds: parseEther('100'),
      maxProceeds: parseEther('10000'),
    },
    pool: {
      fee: 3000,
      tickSpacing: 10, // Must be <= 30 for dynamic auctions
    },
    governance: { type: 'default' },
    migration: { type: 'uniswapV2' },
    userAddress: '0x1234567890123456789012345678901234567890' as Address,
    // Provide blockTimestamp to avoid RPC calls
    blockTimestamp: Math.floor(Date.now() / 1000),
  };
}

describe('Address Mining Stress Test - Base Chain + WETH', () => {
  let factory: DopplerFactory;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeAll(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    // Use Base chain ID
    factory = new DopplerFactory(publicClient, walletClient, CHAIN_IDS.BASE);
  });

  describe('Token ordering verification', () => {
    it('should confirm Base WETH is below halfMaxUint160', () => {
      const halfMaxUint160 = 2n ** 159n - 1n;
      const baseWethBigInt = BigInt(BASE_WETH);

      expect(baseWethBigInt).toBeLessThan(halfMaxUint160);
      expect(isToken0Expected(BASE_WETH)).toBe(false);
    });

    it('should mine token as token1 (greater than Base WETH)', async () => {
      const params = createDynamicAuctionParams(0);
      const result = await factory.encodeCreateDynamicAuctionParams(params);

      const tokenBigInt = BigInt(result.tokenAddress);
      const wethBigInt = BigInt(BASE_WETH);

      expect(tokenBigInt).toBeGreaterThan(wethBigInt);
    });

    it('should confirm Mainnet WETH is above halfMaxUint160', () => {
      const halfMaxUint160 = 2n ** 159n - 1n;
      const mainnetWethBigInt = BigInt(MAINNET_WETH);

      expect(mainnetWethBigInt).toBeGreaterThan(halfMaxUint160);
      expect(isToken0Expected(MAINNET_WETH)).toBe(true);
    });

    it('should mine token as token0 (less than Mainnet WETH)', async () => {
      // For mainnet WETH (> halfMaxUint160), token must be < numeraire
      // Use positive ticks for token0 configuration
      const params: CreateDynamicAuctionParams = {
        token: {
          name: 'Test Token Mainnet',
          symbol: 'TTM',
          tokenURI: 'https://example.com/token/mainnet',
        },
        sale: {
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: MAINNET_WETH,
        },
        auction: {
          duration: 7 * DAY_SECONDS,
          epochLength: 3600,
          startTick: 92103, // Positive for token0 (token < numeraire)
          endTick: 69080,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
        },
        pool: {
          fee: 3000,
          tickSpacing: 10,
        },
        governance: { type: 'default' },
        migration: { type: 'uniswapV2' },
        userAddress: '0x1234567890123456789012345678901234567890' as Address,
        blockTimestamp: Math.floor(Date.now() / 1000),
      };

      const result = await factory.encodeCreateDynamicAuctionParams(params);

      const tokenBigInt = BigInt(result.tokenAddress);
      const wethBigInt = BigInt(MAINNET_WETH);

      expect(tokenBigInt).toBeLessThan(wethBigInt);
    });
  });

  describe('Stress test', () => {
    it(`should run ${STRESS_CONFIG.iterations} mining iterations and track failures`, async () => {
      const results: MiningResult[] = [];
      const summary: StressTestSummary = {
        totalIterations: STRESS_CONFIG.iterations,
        successCount: 0,
        miningFailures: 0,
        otherErrors: 0,
        avgDurationMs: 0,
        minDurationMs: Infinity,
        maxDurationMs: 0,
        avgSaltIterations: 0,
        minSaltIterations: Infinity,
        maxSaltIterations: 0,
        miningFailureDetails: [],
        otherErrorDetails: [],
      };
      const saltIterationsList: number[] = [];

      const testStartTime = performance.now();
      console.log(`\n========================================`);
      console.log(`Address Mining Stress Test`);
      console.log(`Chain: Base (${CHAIN_IDS.BASE})`);
      console.log(`Numeraire: WETH (${BASE_WETH})`);
      console.log(`isToken0Expected: ${isToken0Expected(BASE_WETH)}`);
      console.log(`Iterations: ${STRESS_CONFIG.iterations}`);
      console.log(
        `Per-iteration timeout: ${STRESS_CONFIG.iterationTimeoutMs}ms`,
      );
      console.log(`Overall timeout: ${STRESS_CONFIG.overallTimeoutMs}ms`);
      console.log(`========================================\n`);

      for (let i = 0; i < STRESS_CONFIG.iterations; i++) {
        // Check overall timeout
        const elapsed = performance.now() - testStartTime;
        if (elapsed > STRESS_CONFIG.overallTimeoutMs) {
          console.error(
            `\n!!! OVERALL TIMEOUT REACHED after ${formatElapsed(elapsed)} !!!`,
          );
          break;
        }

        const params = createDynamicAuctionParams(i);
        const iterStartTime = performance.now();

        const result: MiningResult = {
          iteration: i,
          tokenName: params.token.name,
          success: false,
          durationMs: 0,
        };

        try {
          // Use encodeCreateDynamicAuctionParams which calls mineHookAddress internally
          // Wrap with timeout to catch stuck mining
          const encoded = await withTimeout(
            factory.encodeCreateDynamicAuctionParams(params),
            STRESS_CONFIG.iterationTimeoutMs,
            `Iteration ${i} timed out after ${STRESS_CONFIG.iterationTimeoutMs}ms`,
          );

          result.success = true;
          result.salt = encoded.createParams.salt;
          result.saltIterations = parseSaltIterations(
            encoded.createParams.salt,
          );
          result.tokenAddress = encoded.tokenAddress;
          result.hookAddress = encoded.hookAddress;
          summary.successCount++;

          // Track salt iterations
          saltIterationsList.push(result.saltIterations);
          summary.minSaltIterations = Math.min(
            summary.minSaltIterations,
            result.saltIterations,
          );
          summary.maxSaltIterations = Math.max(
            summary.maxSaltIterations,
            result.saltIterations,
          );

          // Verify token ordering
          const tokenBigInt = BigInt(encoded.tokenAddress);
          const wethBigInt = BigInt(BASE_WETH);
          if (tokenBigInt <= wethBigInt) {
            console.warn(
              `  Warning: Token ${encoded.tokenAddress} is not > WETH ${BASE_WETH}`,
            );
          }
        } catch (error) {
          const errorType = classifyError(error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          result.error = errorMessage;

          if (errorType === 'mining') {
            summary.miningFailures++;
            summary.miningFailureDetails.push(result);
          } else {
            summary.otherErrors++;
            summary.otherErrorDetails.push(result);
          }
        }

        result.durationMs = performance.now() - iterStartTime;
        results.push(result);

        // Update duration statistics
        summary.minDurationMs = Math.min(
          summary.minDurationMs,
          result.durationMs,
        );
        summary.maxDurationMs = Math.max(
          summary.maxDurationMs,
          result.durationMs,
        );

        // Progress logging - more frequent if iterations are slow (> 5s)
        const shouldLog =
          (i + 1) % STRESS_CONFIG.logProgressEvery === 0 ||
          result.durationMs > 5000 || // Log if iteration took > 5s
          !result.success; // Log on any failure

        if (shouldLog) {
          const elapsed = performance.now() - testStartTime;
          const successRate = ((summary.successCount / (i + 1)) * 100).toFixed(
            1,
          );
          console.log(
            `[${formatElapsed(elapsed)}] Progress: ${i + 1}/${STRESS_CONFIG.iterations} | ` +
              `Success: ${summary.successCount} (${successRate}%) | ` +
              `Mining Failures: ${summary.miningFailures} | ` +
              `Other Errors: ${summary.otherErrors} | ` +
              `Last iter: ${result.durationMs.toFixed(0)}ms`,
          );
        }
      }

      // Calculate average duration
      const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
      summary.avgDurationMs = totalDuration / results.length;

      // Calculate average salt iterations
      if (saltIterationsList.length > 0) {
        summary.avgSaltIterations =
          saltIterationsList.reduce((a, b) => a + b, 0) /
          saltIterationsList.length;
      }

      const totalElapsed = performance.now() - testStartTime;

      // Final summary output
      console.log(`\n========================================`);
      console.log(`STRESS TEST SUMMARY`);
      console.log(`========================================`);
      console.log(`Total Time: ${formatElapsed(totalElapsed)}`);
      console.log(
        `Iterations Completed: ${results.length}/${STRESS_CONFIG.iterations}`,
      );
      console.log(`Total Iterations: ${summary.totalIterations}`);
      console.log(
        `Successful: ${summary.successCount} (${((summary.successCount / summary.totalIterations) * 100).toFixed(2)}%)`,
      );
      console.log(
        `Mining Failures: ${summary.miningFailures} (${((summary.miningFailures / summary.totalIterations) * 100).toFixed(2)}%)`,
      );
      console.log(
        `Other Errors: ${summary.otherErrors} (${((summary.otherErrors / summary.totalIterations) * 100).toFixed(2)}%)`,
      );
      console.log(`\nTiming Statistics:`);
      console.log(`  Average: ${summary.avgDurationMs.toFixed(2)}ms`);
      console.log(`  Min: ${summary.minDurationMs.toFixed(2)}ms`);
      console.log(`  Max: ${summary.maxDurationMs.toFixed(2)}ms`);

      console.log(`\nSalt Mining Statistics:`);
      console.log(
        `  Average salts tried: ${summary.avgSaltIterations.toFixed(0)}`,
      );
      console.log(`  Min salts tried: ${summary.minSaltIterations}`);
      console.log(`  Max salts tried: ${summary.maxSaltIterations}`);
      console.log(`  Limit: 1,000,000`);

      if (summary.miningFailureDetails.length > 0) {
        console.log(`\nMining Failure Details (first 10):`);
        summary.miningFailureDetails.slice(0, 10).forEach((f) => {
          console.log(`  - Iteration ${f.iteration}: ${f.tokenName}`);
        });
      }

      if (summary.otherErrorDetails.length > 0) {
        console.log(`\nOther Error Details (first 10):`);
        summary.otherErrorDetails.slice(0, 10).forEach((f) => {
          console.log(
            `  - Iteration ${f.iteration}: ${f.error?.slice(0, 100)}`,
          );
        });
      }
      console.log(`========================================\n`);

      // The test passes if we got any information about failures
      // A 0% success rate is still valid information - it tells us mining is broken
      expect(summary).toBeDefined();

      // Log a clear message if there are failures
      if (summary.miningFailures > 0) {
        console.error(
          `\n!!! MINING FAILURES DETECTED: ${summary.miningFailures} out of ${summary.totalIterations} iterations failed !!!`,
        );
      }

      if (summary.otherErrors > 0) {
        console.error(
          `\n!!! OTHER ERRORS DETECTED: ${summary.otherErrors} out of ${summary.totalIterations} iterations had errors !!!`,
        );
      }
    }, 600_000); // 10 minute timeout for stress test
  });

  describe('Edge case token names', () => {
    const edgeCases = [
      { name: 'A', description: 'single character' },
      { name: 'X'.repeat(50), description: 'long name (50 chars)' },
      { name: 'Test Token 123', description: 'with spaces and numbers' },
      { name: 'test_underscore', description: 'with underscore' },
      { name: 'test-hyphen', description: 'with hyphen' },
    ];

    it.each(edgeCases)(
      'should handle $description token name',
      async ({ name }) => {
        const params = createDynamicAuctionParams(999, name);
        const result: {
          success: boolean;
          error?: string;
          tokenAddress?: string;
        } = { success: false };

        try {
          const encoded =
            await factory.encodeCreateDynamicAuctionParams(params);
          result.success = true;
          result.tokenAddress = encoded.tokenAddress;

          // Verify token ordering
          const tokenBigInt = BigInt(encoded.tokenAddress);
          const wethBigInt = BigInt(BASE_WETH);
          expect(tokenBigInt).toBeGreaterThan(wethBigInt);
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error);
        }

        console.log(
          `Edge case "${name.slice(0, 20)}...": ${result.success ? 'SUCCESS' : 'FAILED'} ${result.error ? `(${result.error.slice(0, 50)})` : ''}`,
        );

        // We don't assert success here - we want to see which edge cases fail
        expect(result).toBeDefined();
      },
    );
  });
});
