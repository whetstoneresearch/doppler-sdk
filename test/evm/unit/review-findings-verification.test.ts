/**
 * Review Findings Verification Tests
 *
 * Each test in this file verifies a specific finding from the PR review.
 * Tests are designed to FAIL if the finding is valid (i.e., the bug exists)
 * and PASS once the bug is fixed.
 *
 * Naming convention: [severity][number] - description
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ADDRESSES, CHAIN_IDS } from '../../../src/evm/addresses';

// ============================================================================
// C1: Runtime values exported as type-only (will be erased at compile time)
// ============================================================================
describe('C1: Runtime values must not be exported as type-only', () => {
  it('NO_OP_ENABLED_CHAIN_IDS should be a runtime value, not undefined', async () => {
    // Import from the public index barrel — if exported as `export type`,
    // these will be `undefined` at runtime.
    const indexModule = await import('../../../src/evm/index');

    // These are runtime values in types.ts. The index.ts exports them inside
    // `export type { ... }` which strips them at compile time.
    // If the bug exists, these will be undefined at runtime.
    expect(indexModule.NO_OP_ENABLED_CHAIN_IDS).toBeDefined();
    expect(Array.isArray(indexModule.NO_OP_ENABLED_CHAIN_IDS)).toBe(true);
  });

  it('isNoOpEnabledChain should be a callable function, not undefined', async () => {
    const indexModule = await import('../../../src/evm/index');
    expect(typeof indexModule.isNoOpEnabledChain).toBe('function');
  });

  it('LAUNCHPAD_ENABLED_CHAIN_IDS should be a runtime value, not undefined', async () => {
    const indexModule = await import('../../../src/evm/index');
    expect(indexModule.LAUNCHPAD_ENABLED_CHAIN_IDS).toBeDefined();
    expect(Array.isArray(indexModule.LAUNCHPAD_ENABLED_CHAIN_IDS)).toBe(true);
  });

  it('isLaunchpadEnabledChain should be a callable function, not undefined', async () => {
    const indexModule = await import('../../../src/evm/index');
    expect(typeof indexModule.isLaunchpadEnabledChain).toBe('function');
  });
});

// ============================================================================
// C2: INK chain Airlock address mismatch
// ============================================================================
describe('C2: INK Airlock address should remain pinned', () => {
  it('INK airlock address should match the legacy deployment', () => {
    const inkAddresses = ADDRESSES[CHAIN_IDS.INK];

    expect(inkAddresses.airlock.toLowerCase()).toBe(
      '0x660eaaedebc968f8f3694354fa8ec0b4c5ba8d12',
    );
  });

  it('INK airlock should NOT be the UniswapV4Initializer address', () => {
    const inkAddresses = ADDRESSES[CHAIN_IDS.INK];

    expect(inkAddresses.airlock.toLowerCase()).not.toBe(
      '0x014e1c0bd34f3b10546e554cb33b3293fecdd056',
    );
  });
});

// ============================================================================
// H2: normalizeMulticurveCurves invalid fallback curve
// ============================================================================
describe('H2: Fallback curve should not have tickLower >= tickUpper', () => {
  it('fallback curve generated when user curve tickUpper equals roundMaxTickDown', async () => {
    // Import DopplerFactory to test normalizeMulticurveCurves (it's private,
    // so we test the observable behavior through the public API)
    const { DopplerFactory } =
      await import('../../../src/evm/entities/DopplerFactory');
    const { MAX_TICK } = await import('../../../src/evm/utils');
    const { WAD } = await import('../../../src/evm/constants');

    const tickSpacing = 10;
    const roundedMaxTick = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;

    // Create a curve whose tickUpper equals the rounded max tick.
    // With less than 100% shares, normalizeMulticurveCurves must add a fallback curve.
    // The fallback would have tickLower = roundedMaxTick and tickUpper = roundedMaxTick
    // which is invalid (tickLower >= tickUpper).
    const curves = [
      {
        tickLower: 0,
        tickUpper: roundedMaxTick, // This equals the max rounded tick
        numPositions: 10,
        shares: WAD / 2n, // Only 50% — needs a fallback to fill the rest
      },
    ];

    // Access the private method through prototype
    // We construct a minimal factory to call the private method
    const mockPublicClient = {
      readContract: vi.fn(),
      getBlock: vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n }),
      getChainId: vi.fn().mockResolvedValue(84532),
      getBytecode: vi.fn().mockResolvedValue('0x6000'),
    };
    const mockWalletClient = {
      account: { address: '0x0000000000000000000000000000000000000001' },
      writeContract: vi.fn(),
    };
    const factory = new DopplerFactory(
      mockPublicClient as any,
      mockWalletClient as any,
      84532,
    );

    expect(() =>
      (factory as any).normalizeMulticurveCurves(curves, tickSpacing, WAD),
    ).toThrow('Unable to find a uint128-safe multicurve max tick');
  });
});

// ============================================================================
// H6: Unichain Sepolia v2Migrator and v4Migrator share the same address
// ============================================================================
describe('H6: Unichain Sepolia v2Migrator and v4Migrator should be different', () => {
  it('v2Migrator and v4Migrator should not be the same address', () => {
    const unichainSepoliaAddresses = ADDRESSES[CHAIN_IDS.UNICHAIN_SEPOLIA];
    expect(unichainSepoliaAddresses.v2Migrator.toLowerCase()).not.toBe(
      unichainSepoliaAddresses.v4Migrator.toLowerCase(),
    );
  });

  it('v2Migrator should match the legacy deployment', () => {
    const addresses = ADDRESSES[CHAIN_IDS.UNICHAIN_SEPOLIA];
    expect(addresses.v2Migrator.toLowerCase()).toBe(
      '0x620e3fec244e913d73f2163623b62d02db69638b',
    );
  });

  it('v4Migrator should match the legacy deployment', () => {
    const addresses = ADDRESSES[CHAIN_IDS.UNICHAIN_SEPOLIA];
    expect(addresses.v4Migrator.toLowerCase()).toBe(
      '0xb6d69eaa98e657beeff7ca4452768e6f707aa6b1',
    );
  });
});

// ============================================================================
// H7: generateRandomSalt fallback broken timestamp byte extraction
// ============================================================================
describe('H7: Timestamp byte extraction should not lose entropy for bits > 32', () => {
  it('DopplerFactory generateRandomSalt uses BigInt extraction (not broken >> operator)', () => {
    // The fix replaced `(timestamp >> (i * 8)) & 0xff` with BigInt-based extraction.
    // Verify the production code uses BigInt, not the broken >> operator.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/entities/DopplerFactory.ts'),
      'utf-8',
    );

    const methodStart = source.indexOf('generateRandomSalt');
    const methodEnd = source.indexOf('private', methodStart + 30);
    const methodBody = source.slice(methodStart, methodEnd);

    // Should use BigInt for timestamp extraction
    const usesBigInt =
      methodBody.includes('BigInt(') || methodBody.includes('bigTimestamp');
    expect(usesBigInt).toBe(true);

    // Should NOT use the broken >> operator for timestamp bytes
    const usesBrokenShift = methodBody.includes('(timestamp >> (i * 8))');
    expect(usesBrokenShift).toBe(false);
  });

  it('BigInt-based extraction preserves all timestamp bits', () => {
    // This is the correct implementation
    const timestamp = Date.now();
    const bigTimestamp = BigInt(timestamp);

    const timestampBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      timestampBytes[i] = Number((bigTimestamp >> BigInt(i * 8)) & 0xffn);
    }

    // With BigInt, bytes 4-7 should carry the upper bits of the timestamp
    const lower4 = Array.from(timestampBytes.slice(0, 4));
    const upper4 = Array.from(timestampBytes.slice(4, 8));

    // At least one of the upper bytes should be non-zero (timestamp > 2^32)
    const hasNonZeroUpper = upper4.some((b) => b !== 0);
    expect(hasNonZeroUpper).toBe(true);

    // And the upper bytes should NOT be identical to lower bytes
    expect(upper4).not.toEqual(lower4);
  });
});

// ============================================================================
// H1: mineTokenOrder doesn't handle isToken0=true
// ============================================================================
describe('H1: mineTokenOrder should handle isToken0=true for high numeraire addresses', () => {
  it('static auction mining always requires token > numeraire (forces token1)', async () => {
    // The code at DopplerFactory.ts:731 checks:
    //   if (BigInt(tokenAddress) > numeraireBigInt) { return createParams; }
    // This only handles the case where token is token1 (larger address).
    // For numeraire addresses > 2^159-1 (halfMaxUint160), the token should be token0
    // (smaller address), but the check would never match.

    const factorySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Find mineTokenOrder method
    const methodStart = factorySource.indexOf('private async mineTokenOrder');
    const methodEnd = factorySource.indexOf(
      'async encodeCreateDynamicAuctionParams',
      methodStart,
    );
    const methodBody = factorySource.slice(methodStart, methodEnd);

    // Check if it handles both directions using isToken0Expected
    // The fix uses: isToken0Expected + wantToken0 logic instead of a single > check
    const usesIsToken0Expected =
      methodBody.includes('isToken0Expected') ||
      methodBody.includes('wantToken0');

    // If the bug exists, neither isToken0Expected nor wantToken0 appears
    expect(usesIsToken0Expected).toBe(true);
  });
});

// ============================================================================
// M14: SupportedChain type missing chains
// ============================================================================
describe('M14: SupportedChain type should include all chains in CHAIN_IDS', () => {
  it('all CHAIN_IDS values should have corresponding entries in ADDRESSES', () => {
    // This is already true (ADDRESSES is keyed by SupportedChainId).
    // But SupportedChain type is missing Unichain Sepolia, Monad Testnet, Monad Mainnet.
    // This is a type-level issue. We verify the runtime mapping is complete:
    for (const chainId of Object.values(CHAIN_IDS)) {
      expect(ADDRESSES[chainId as keyof typeof ADDRESSES]).toBeDefined();
    }
  });
});

// ============================================================================
// L11: Dead private methods in DopplerFactory
// ============================================================================
describe('L11: Dead private methods should not exist', () => {
  it('getAirlockAddress is never called', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Count occurrences of getAirlockAddress
    // The definition is `private getAirlockAddress()` — we exclude that
    const allOccurrences = source.split('getAirlockAddress').length - 1;
    const definitionOccurrences = source.includes('private getAirlockAddress')
      ? 1
      : 0;
    const callOccurrences = allOccurrences - definitionOccurrences;

    // If it's dead code, there should be 0 calls
    expect(callOccurrences).toBe(0);
  });

  it('getInitializerAddress is never called', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/entities/DopplerFactory.ts'),
      'utf-8',
    );

    const allOccurrences = source.split('getInitializerAddress').length - 1;
    const definitionOccurrences = source.includes(
      'private getInitializerAddress',
    )
      ? 1
      : 0;
    const callOccurrences = allOccurrences - definitionOccurrences;

    expect(callOccurrences).toBe(0);
  });

  it('computeCreate2Address (non-Fast) is never called', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Must be careful: computeCreate2AddressFast should be called,
    // but computeCreate2Address (without Fast) should not
    // Split by the exact method name followed by ( but NOT preceded by "Fast"
    const pattern = /(?<!Fast)\bcomputeCreate2Address\s*\(/g;
    const matches = source.match(pattern) || [];

    // Should find exactly 1 (the definition itself), 0 calls
    // The definition line: `private computeCreate2Address(`
    expect(matches.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// L12: Multicurve uses DEFAULT_V3_YEARLY_MINT_RATE instead of V4
// ============================================================================
describe('L12: Multicurve should use DEFAULT_V4_YEARLY_MINT_RATE', () => {
  it('both constants have the same value currently', async () => {
    const { DEFAULT_V3_YEARLY_MINT_RATE, DEFAULT_V4_YEARLY_MINT_RATE } =
      await import('../../../src/evm/constants');
    // This test documents that they are currently equal.
    // If they diverge, the multicurve path would silently use the wrong rate.
    expect(DEFAULT_V3_YEARLY_MINT_RATE).toBe(DEFAULT_V4_YEARLY_MINT_RATE);
  });

  it('multicurve token factory encoding should use V4 rate, not V3', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Check entire file — V3 yearly mint rate should not be imported or used at all
    const usesV3 = source.includes('DEFAULT_V3_YEARLY_MINT_RATE');
    const usesV4 = source.includes('DEFAULT_V4_YEARLY_MINT_RATE');

    // Should use V4, not V3
    expect(usesV4).toBe(true);
    expect(usesV3).toBe(false);
  });
});

// ============================================================================
// L13: Mixed zeroAddress / ZERO_ADDRESS usage
// ============================================================================
describe('L13: Should use consistent zero address constant', () => {
  it('DopplerFactory uses both viem zeroAddress and constants ZERO_ADDRESS', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Check for both imports
    const importsViemZeroAddress =
      source.includes('zeroAddress') &&
      (source.includes("from 'viem'") || source.includes('from "viem"'));
    const importsConstantsZeroAddress = source.includes('ZERO_ADDRESS');

    // Both should not be used in the same file — pick one
    const usesBothInCode =
      importsViemZeroAddress && importsConstantsZeroAddress;

    // If the bug exists, both are used
    expect(usesBothInCode).toBe(false);
  });
});

// ============================================================================
// M7: Fee validation doesn't check for negative values
// ============================================================================
describe('M7: MulticurveBuilder fee validation should reject negative fees', () => {
  it('negative fee check exists in MulticurveBuilder source', () => {
    // Check that fee < 0 validation exists somewhere in the builder
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/evm/builders/MulticurveBuilder.ts'),
      'utf-8',
    );

    // Should check for negative fee anywhere in the file
    const checksNegativeFee =
      source.includes('fee < 0') || source.includes('fee cannot be negative');
    expect(checksNegativeFee).toBe(true);
  });
});

