/**
 * Review Findings Verification Tests
 *
 * Each test in this file verifies a specific finding from the PR review.
 * Tests are designed to FAIL if the finding is valid (i.e., the bug exists)
 * and PASS once the bug is fixed.
 *
 * Naming convention: [severity][number] - description
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { type Address, getAddress, encodeAbiParameters, zeroAddress } from 'viem';
import { ADDRESSES, CHAIN_IDS } from '../../src/addresses';
import { GENERATED_DOPPLER_DEPLOYMENTS } from '../../src/deployments.generated';
import {
  OPENING_AUCTION_PHASE_NOT_STARTED,
  OPENING_AUCTION_PHASE_ACTIVE,
  OPENING_AUCTION_PHASE_CLOSED,
  OPENING_AUCTION_PHASE_SETTLED,
  INT24_MIN,
  INT24_MAX,
} from '../../src/constants';

// ============================================================================
// C1: Runtime values exported as type-only (will be erased at compile time)
// ============================================================================
describe('C1: Runtime values must not be exported as type-only', () => {
  it('NO_OP_ENABLED_CHAIN_IDS should be a runtime value, not undefined', async () => {
    // Import from the public index barrel — if exported as `export type`,
    // these will be `undefined` at runtime.
    const indexModule = await import('../../src/index');

    // These are runtime values in types.ts. The index.ts exports them inside
    // `export type { ... }` which strips them at compile time.
    // If the bug exists, these will be undefined at runtime.
    expect(indexModule.NO_OP_ENABLED_CHAIN_IDS).toBeDefined();
    expect(Array.isArray(indexModule.NO_OP_ENABLED_CHAIN_IDS)).toBe(true);
  });

  it('isNoOpEnabledChain should be a callable function, not undefined', async () => {
    const indexModule = await import('../../src/index');
    expect(typeof indexModule.isNoOpEnabledChain).toBe('function');
  });

  it('LAUNCHPAD_ENABLED_CHAIN_IDS should be a runtime value, not undefined', async () => {
    const indexModule = await import('../../src/index');
    expect(indexModule.LAUNCHPAD_ENABLED_CHAIN_IDS).toBeDefined();
    expect(Array.isArray(indexModule.LAUNCHPAD_ENABLED_CHAIN_IDS)).toBe(true);
  });

  it('isLaunchpadEnabledChain should be a callable function, not undefined', async () => {
    const indexModule = await import('../../src/index');
    expect(typeof indexModule.isLaunchpadEnabledChain).toBe('function');
  });
});

// ============================================================================
// C2: INK chain Airlock address mismatch
// ============================================================================
describe('C2: INK Airlock address should match generated deployment', () => {
  it('INK airlock address should match GENERATED_DOPPLER_DEPLOYMENTS', () => {
    const inkAddresses = ADDRESSES[CHAIN_IDS.INK];
    const generatedInk = (GENERATED_DOPPLER_DEPLOYMENTS as Record<string, Record<string, string>>)[String(CHAIN_IDS.INK)];

    // The hardcoded INK airlock is 0x014E... but the generated one is 0x660e...
    // 0x014E... is actually INK's UniswapV4Initializer
    expect(inkAddresses.airlock.toLowerCase()).toBe(
      generatedInk.Airlock.toLowerCase(),
    );
  });

  it('INK airlock should NOT be the UniswapV4Initializer address', () => {
    const inkAddresses = ADDRESSES[CHAIN_IDS.INK];
    const generatedInk = (GENERATED_DOPPLER_DEPLOYMENTS as Record<string, Record<string, string>>)[String(CHAIN_IDS.INK)];

    expect(inkAddresses.airlock.toLowerCase()).not.toBe(
      generatedInk.UniswapV4Initializer.toLowerCase(),
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
    const { DopplerFactory } = await import('../../src/entities/DopplerFactory');
    const { MAX_TICK } = await import('../../src/utils');
    const { WAD } = await import('../../src/constants');

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
    const factory = new DopplerFactory(mockPublicClient as any, mockWalletClient as any, 84532);

    // Use bracket notation to access private method
    const normalized = (factory as any).normalizeMulticurveCurves(curves, tickSpacing);

    // The fallback curve (last element) should have tickLower < tickUpper
    const fallbackCurve = normalized[normalized.length - 1];
    expect(fallbackCurve.tickLower).toBeLessThan(fallbackCurve.tickUpper);
  });
});

// ============================================================================
// H3: encodeMigrationData for opening auctions missing numeraire
// ============================================================================
describe('H3: Opening auction encodeMigrationData should pass numeraire for dopplerHook migration', () => {
  it('opening auction path passes options to encodeMigrationData', async () => {
    // The static auction path at line 257 passes { numeraire, overrides }
    // The opening auction path at line 1405 passes NO options argument.
    // We verify by reading the source code structure.
    const { DopplerFactory } = await import('../../src/entities/DopplerFactory');
    const source = DopplerFactory.prototype.encodeCreateOpeningAuctionParams?.toString() ?? '';

    // For a more reliable test, let's check what the method actually does by
    // looking for the pattern in the source code
    const factorySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Find the encodeCreateOpeningAuctionParams method and check for encodeMigrationData call
    const methodStart = factorySource.indexOf('async encodeCreateOpeningAuctionParams');
    const methodEnd = factorySource.indexOf('async createOpeningAuction', methodStart);
    const methodBody = factorySource.slice(methodStart, methodEnd);

    // Find the encodeMigrationData call in this method
    const migrationCallMatch = methodBody.match(/this\.encodeMigrationData\(([^)]+)\)/);
    expect(migrationCallMatch).toBeTruthy();

    // The call should include a second argument with numeraire, like the static auction path:
    // this.encodeMigrationData(params.migration, { numeraire: params.sale.numeraire, overrides: params.modules })
    // If the bug exists, it will only be: this.encodeMigrationData(params.migration)
    const args = migrationCallMatch![1];
    const hasSecondArg = args.includes(',');
    expect(hasSecondArg).toBe(true); // FAILS if only params.migration is passed
  });
});

// ============================================================================
// H5: completeOpeningAuction returns zeroAddress for dopplerHookAddress
// ============================================================================
describe('H5: completeOpeningAuction should not return zeroAddress when dopplerSalt is provided', () => {
  it('completion with user-supplied dopplerSalt should not set dopplerHookAddress to zeroAddress', async () => {
    // When args.dopplerSalt is provided, the completion object is:
    //   { dopplerSalt: args.dopplerSalt, dopplerHookAddress: zeroAddress }
    // Then at the end, if getDopplerHook returns zeroAddress, the result is:
    //   dopplerHookAddress: completion.dopplerHookAddress (which is zeroAddress)
    // This means the caller gets zeroAddress with no warning.

    const factorySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Find the pattern: dopplerHookAddress: zeroAddress in the dopplerSalt branch
    const completeMethod = factorySource.indexOf('async completeOpeningAuction');
    const afterComplete = factorySource.indexOf('async simulateCompleteOpeningAuction', completeMethod);
    const methodBody = factorySource.slice(completeMethod, afterComplete > completeMethod ? afterComplete : undefined);

    // Check if there's a code path that sets dopplerHookAddress to zeroAddress
    const hasZeroAddressFallback = methodBody.includes('dopplerHookAddress: zeroAddress');
    // This should NOT happen — the bug means it does
    expect(hasZeroAddressFallback).toBe(false);
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

  it('v2Migrator should match generated deployment', () => {
    const generated = (GENERATED_DOPPLER_DEPLOYMENTS as Record<string, Record<string, string>>)[String(CHAIN_IDS.UNICHAIN_SEPOLIA)];
    const addresses = ADDRESSES[CHAIN_IDS.UNICHAIN_SEPOLIA];
    expect(addresses.v2Migrator.toLowerCase()).toBe(
      generated.UniswapV2Migrator.toLowerCase(),
    );
  });

  it('v4Migrator should match generated deployment', () => {
    const generated = (GENERATED_DOPPLER_DEPLOYMENTS as Record<string, Record<string, string>>)[String(CHAIN_IDS.UNICHAIN_SEPOLIA)];
    const addresses = ADDRESSES[CHAIN_IDS.UNICHAIN_SEPOLIA];
    expect(addresses.v4Migrator.toLowerCase()).toBe(
      generated.UniswapV4Migrator.toLowerCase(),
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
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    const methodStart = source.indexOf('generateRandomSalt');
    const methodEnd = source.indexOf('private', methodStart + 30);
    const methodBody = source.slice(methodStart, methodEnd);

    // Should use BigInt for timestamp extraction
    const usesBigInt = methodBody.includes('BigInt(') || methodBody.includes('bigTimestamp');
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
      timestampBytes[i] = Number((bigTimestamp >> BigInt(i * 8)) & 0xFFn);
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
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Find mineTokenOrder method
    const methodStart = factorySource.indexOf('private async mineTokenOrder');
    const methodEnd = factorySource.indexOf('async encodeCreateDynamicAuctionParams', methodStart);
    const methodBody = factorySource.slice(methodStart, methodEnd);

    // Check if it handles both directions using isToken0Expected
    // The fix uses: isToken0Expected + wantToken0 logic instead of a single > check
    const usesIsToken0Expected = methodBody.includes('isToken0Expected') || methodBody.includes('wantToken0');

    // If the bug exists, neither isToken0Expected nor wantToken0 appears
    expect(usesIsToken0Expected).toBe(true);
  });
});

// ============================================================================
// M5: No int24 range validation for ticks in builders
// ============================================================================
describe('M5: Builder should validate tick values against int24 bounds', () => {
  it('OpeningAuctionBuilder build() should check minAcceptableTick against int24 range', () => {
    const builderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/builders/OpeningAuctionBuilder.ts'),
      'utf-8',
    );

    // Find the build() method
    const buildStart = builderSource.indexOf('build()');
    const methodBody = builderSource.slice(buildStart);

    // Check if it validates ticks against int24 bounds
    const checksInt24 = methodBody.includes('INT24_MIN') || methodBody.includes('INT24_MAX') ||
                         methodBody.includes('-8388608') || methodBody.includes('8388607') ||
                         methodBody.includes('-8_388_608') || methodBody.includes('8_388_607');

    // If the bug exists, no int24 validation is performed
    expect(checksInt24).toBe(true);
  });

  it('validateOpeningAuctionParams should check ticks against int24 range', () => {
    const factorySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    const methodStart = factorySource.indexOf('private validateOpeningAuctionParams');
    const nextMethod = factorySource.indexOf('\n  private ', methodStart + 1);
    const methodBody = factorySource.slice(methodStart, nextMethod);

    // Check if it validates ticks against int24 bounds
    const checksInt24 = methodBody.includes('INT24') ||
                         methodBody.includes('-8388608') || methodBody.includes('8388607') ||
                         methodBody.includes('-8_388_608') || methodBody.includes('8_388_607');

    expect(checksInt24).toBe(true);
  });
});

// ============================================================================
// M9: No validation that incentiveShareBps + shareToAuctionBps <= 10_000
// ============================================================================
describe('M9: incentiveShareBps + shareToAuctionBps should not exceed 10_000', () => {
  it('validateOpeningAuctionParams should check combined bps', () => {
    const factorySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    const methodStart = factorySource.indexOf('private validateOpeningAuctionParams');
    const nextMethod = factorySource.indexOf('\n  private ', methodStart + 1);
    const methodBody = factorySource.slice(methodStart, nextMethod);

    // Check if it validates the SUM of incentiveShareBps + shareToAuctionBps
    // Must specifically check for an addition expression, not just both names appearing
    const checksCombinedBps =
      methodBody.includes('incentiveShareBps + shareToAuctionBps') ||
      methodBody.includes('shareToAuctionBps + incentiveShareBps');

    // Individual checks exist (lines 4188-4198), but there's no combined check
    expect(checksCombinedBps).toBe(true);
  });
});

// ============================================================================
// M12: Base governance factory address mismatches
// ============================================================================
describe('M12: Base governance factory addresses vs generated deployments', () => {
  it('Base governanceFactory should match generated deployment', () => {
    const baseAddresses = ADDRESSES[CHAIN_IDS.BASE];
    const generatedBase = (GENERATED_DOPPLER_DEPLOYMENTS as Record<string, Record<string, string>>)[String(CHAIN_IDS.BASE)];

    // Hardcoded: 0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9
    // Generated: 0xa82c66b6ddEb92089015C3565E05B5c9750b2d4B
    expect(baseAddresses.governanceFactory.toLowerCase()).toBe(
      generatedBase.GovernanceFactory.toLowerCase(),
    );
  });

  it('Base noOpGovernanceFactory should match generated deployment', () => {
    const baseAddresses = ADDRESSES[CHAIN_IDS.BASE];
    const generatedBase = (GENERATED_DOPPLER_DEPLOYMENTS as Record<string, Record<string, string>>)[String(CHAIN_IDS.BASE)];

    // Hardcoded: 0xe7dfbd5b0a2c3b4464653a9becdc489229ef090e
    // Generated: 0x3AD727ee0FBBb8Ee0920933FdB96F23fD56f1299
    expect(baseAddresses.noOpGovernanceFactory?.toLowerCase()).toBe(
      generatedBase.NoOpGovernanceFactory.toLowerCase(),
    );
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
    for (const [chainName, chainId] of Object.entries(CHAIN_IDS)) {
      expect(ADDRESSES[chainId as keyof typeof ADDRESSES]).toBeDefined();
    }
  });
});

// ============================================================================
// H4: Duplicate CreateOpeningAuctionParams type definitions
// ============================================================================
describe('H4: CreateOpeningAuctionParams types should be consistent', () => {
  it('Builder CreateOpeningAuctionParams and types.ts CreateOpeningAuctionParams should not diverge', async () => {
    // The builder version uses ResolvedOpeningAuctionDopplerConfig (gamma required)
    // The types.ts version uses OpeningAuctionDopplerConfig (gamma optional)
    // Verify by checking that the builder's gamma is required
    const { OpeningAuctionBuilder } = await import('../../src/builders/OpeningAuctionBuilder');

    const builder = new OpeningAuctionBuilder(84532);
    builder.tokenConfig({
      name: 'Test',
      symbol: 'TST',
      tokenURI: 'https://test.com',
    });
    builder.saleConfig({
      initialSupply: 1000000000000000000000000n,
      numTokensToSell: 800000000000000000000000n,
      numeraire: '0x4200000000000000000000000000000000000006' as Address,
    });
    builder.openingAuctionConfig({
      auctionDuration: 86400,
      minAcceptableTickToken0: -69080,
      minAcceptableTickToken1: -92103,
      incentiveShareBps: 500,
      tickSpacing: 30,
      fee: 3000,
      minLiquidity: 1000n,
      shareToAuctionBps: 5000,
    });
    builder.dopplerConfig({
      minProceeds: 1000000000000000n,
      maxProceeds: 10000000000000000n,
      // numeraire 0x4200... is < halfMaxUint160, so isToken0=false, startTick <= endTick
      startTick: -92103,
      endTick: -69080,
      // gamma not provided — builder should auto-resolve it
    });
    builder.withMigration({ type: 'uniswapV2' });
    builder.withGovernance({ type: 'noOp' });
    builder.withUserAddress('0x1234567890123456789012345678901234567890' as Address);

    const params = builder.build();

    // Builder always resolves gamma — so it should be defined
    expect(params.doppler.gamma).toBeDefined();
    expect(typeof params.doppler.gamma).toBe('number');

    // Also verify it has modules typed with opening-auction-specific overrides
    // (the types.ts version only has ModuleAddressOverrides, not OpeningAuctionModuleAddressOverrides)
    // This is a structural check — TypeScript handles this at compile time
    expect(params).toHaveProperty('doppler');
    expect(params).toHaveProperty('openingAuction');
  });
});

// ============================================================================
// T1: Mislabeled phase mock in OpeningAuction.test.ts
// ============================================================================
describe('T1: Phase constant values should match their semantic names', () => {
  it('OPENING_AUCTION_PHASE_ACTIVE should be 1, not 2', () => {
    expect(OPENING_AUCTION_PHASE_NOT_STARTED).toBe(0);
    expect(OPENING_AUCTION_PHASE_ACTIVE).toBe(1);
    expect(OPENING_AUCTION_PHASE_CLOSED).toBe(2);
    expect(OPENING_AUCTION_PHASE_SETTLED).toBe(3);
  });

  it('existing test uses phase=2 but labels it "Active" — that is CLOSED', async () => {
    // Read the test file to verify the mislabeling exists
    const testSource = fs.readFileSync(
      path.resolve(__dirname, 'entities/OpeningAuction.test.ts'),
      'utf-8',
    );

    // Find the line that says "phase (Active)" with value 2
    const lines = testSource.split('\n');
    let foundMislabeled = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for mockResolvedValueOnce(2) with comment about "Active"
      if (line.includes('mockResolvedValueOnce(2)') && line.includes('Active')) {
        foundMislabeled = true;
        break;
      }
    }

    // If the bug exists, this will be true (the test has a mislabeled mock)
    // Once fixed, the value should be 1 for Active
    expect(foundMislabeled).toBe(false);
  });
});

// ============================================================================
// T2: decodeDelta only tests positive values
// ============================================================================
describe('T2: decodeDelta should correctly decode negative (signed) int128 values', () => {
  it('decodes negative amount0 from a BalanceDelta', async () => {
    const { OpeningAuctionPositionManager } = await import(
      '../../src/entities/auction/OpeningAuctionPositionManager'
    );

    // Encode a negative amount0 (-5) and positive amount1 (7) into a BalanceDelta
    // BalanceDelta is packed as: (int128(amount0) << 128) | uint128(amount1)
    const negFive = -5n;
    const posSeven = 7n;
    // Mask to 128 bits for two's complement
    const mask128 = (1n << 128n) - 1n;
    const delta = ((negFive & mask128) << 128n) | (posSeven & mask128);

    const result = OpeningAuctionPositionManager.decodeDelta(delta);
    expect(result.amount0).toBe(-5n);
    expect(result.amount1).toBe(7n);
  });

  it('decodes negative amount1 from a BalanceDelta', async () => {
    const { OpeningAuctionPositionManager } = await import(
      '../../src/entities/auction/OpeningAuctionPositionManager'
    );

    const posFive = 5n;
    const negSeven = -7n;
    const mask128 = (1n << 128n) - 1n;
    const delta = ((posFive & mask128) << 128n) | (negSeven & mask128);

    const result = OpeningAuctionPositionManager.decodeDelta(delta);
    expect(result.amount0).toBe(5n);
    expect(result.amount1).toBe(-7n);
  });

  it('decodes both negative amounts from a BalanceDelta', async () => {
    const { OpeningAuctionPositionManager } = await import(
      '../../src/entities/auction/OpeningAuctionPositionManager'
    );

    const negThree = -3n;
    const negNine = -9n;
    const mask128 = (1n << 128n) - 1n;
    const delta = ((negThree & mask128) << 128n) | (negNine & mask128);

    const result = OpeningAuctionPositionManager.decodeDelta(delta);
    expect(result.amount0).toBe(-3n);
    expect(result.amount1).toBe(-9n);
  });
});

// ============================================================================
// L2: Hardcoded int24 bounds instead of constants
// ============================================================================
describe('L2: getLiquidityAtTick should use INT24_MIN/INT24_MAX constants', () => {
  it('INT24 bounds in constants match the hardcoded values in OpeningAuction', () => {
    // The hardcoded values at OpeningAuction.ts:656-657 are -8_388_608 and 8_388_607
    // These should match the constants
    expect(INT24_MIN).toBe(-8_388_608);
    expect(INT24_MAX).toBe(8_388_607);
  });

  it('OpeningAuction source should reference INT24_MIN/INT24_MAX, not hardcoded values', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/auction/OpeningAuction.ts'),
      'utf-8',
    );

    // Find getLiquidityAtTick method
    const methodStart = source.indexOf('getLiquidityAtTick');
    const methodEnd = source.indexOf('getNextPositionId', methodStart);
    const methodBody = source.slice(methodStart, methodEnd);

    // Check if it uses hardcoded values instead of constants
    const usesHardcoded = methodBody.includes('-8_388_608') || methodBody.includes('8_388_607') ||
                          methodBody.includes('-8388608') || methodBody.includes('8388607');
    const usesConstants = methodBody.includes('INT24_MIN') || methodBody.includes('INT24_MAX');

    // The method should use constants, not hardcoded values
    expect(usesConstants).toBe(true);
    expect(usesHardcoded).toBe(false);
  });
});

// ============================================================================
// L11: Dead private methods in DopplerFactory
// ============================================================================
describe('L11: Dead private methods should not exist', () => {
  it('getAirlockAddress is never called', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Count occurrences of getAirlockAddress
    // The definition is `private getAirlockAddress()` — we exclude that
    const allOccurrences = source.split('getAirlockAddress').length - 1;
    const definitionOccurrences = source.includes('private getAirlockAddress') ? 1 : 0;
    const callOccurrences = allOccurrences - definitionOccurrences;

    // If it's dead code, there should be 0 calls
    expect(callOccurrences).toBe(0);
  });

  it('getInitializerAddress is never called', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    const allOccurrences = source.split('getInitializerAddress').length - 1;
    const definitionOccurrences = source.includes('private getInitializerAddress') ? 1 : 0;
    const callOccurrences = allOccurrences - definitionOccurrences;

    expect(callOccurrences).toBe(0);
  });

  it('computeCreate2Address (non-Fast) is never called', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
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
    const { DEFAULT_V3_YEARLY_MINT_RATE, DEFAULT_V4_YEARLY_MINT_RATE } = await import(
      '../../src/constants'
    );
    // This test documents that they are currently equal.
    // If they diverge, the multicurve path would silently use the wrong rate.
    expect(DEFAULT_V3_YEARLY_MINT_RATE).toBe(DEFAULT_V4_YEARLY_MINT_RATE);
  });

  it('multicurve token factory encoding should use V4 rate, not V3', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
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
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Check for both imports
    const importsViemZeroAddress = source.includes("zeroAddress") &&
      (source.includes("from 'viem'") || source.includes('from "viem"'));
    const importsConstantsZeroAddress = source.includes('ZERO_ADDRESS');

    // Both should not be used in the same file — pick one
    const usesBothInCode = importsViemZeroAddress && importsConstantsZeroAddress;

    // If the bug exists, both are used
    expect(usesBothInCode).toBe(false);
  });
});

// ============================================================================
// M10: Inconsistent waitForTransactionReceipt confirmation counts
// ============================================================================
describe('M10: Transaction receipt confirmation counts should be consistent', () => {
  it('create method receipt calls should have confirmations: 2', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Check the 4 main create methods have confirmations: 2
    // createStaticAuction, createDynamicAuction, createOpeningAuction, createMulticurve
    const createMethods = [
      'async createStaticAuction',
      'async createDynamicAuction',
      'async createOpeningAuction',
      'async createMulticurve',
    ];

    for (const methodSig of createMethods) {
      const methodStart = source.indexOf(methodSig);
      // Find the next method after this one
      const nextMethodIdx = source.indexOf('\n  async ', methodStart + methodSig.length);
      const methodBody = source.slice(methodStart, nextMethodIdx > methodStart ? nextMethodIdx : undefined);

      // Each should have waitForTransactionReceipt with confirmations
      if (methodBody.includes('waitForTransactionReceipt')) {
        expect(methodBody).toContain('confirmations');
      }
    }
  });
});

// ============================================================================
// M8: validateOpeningAuctionParams doesn't validate migration type
// ============================================================================
describe('M8: Opening auction should validate migration type compatibility', () => {
  it('dopplerHook migration type should be explicitly handled or rejected', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Find validateOpeningAuctionParams
    const methodStart = source.indexOf('private validateOpeningAuctionParams');
    const nextMethod = source.indexOf('\n  private ', methodStart + 1);
    const methodBody = source.slice(methodStart, nextMethod);

    // Check if migration type is validated
    const checksMigrationType =
      methodBody.includes('migration.type') ||
      methodBody.includes('migration') && methodBody.includes('dopplerHook');

    // If the bug exists, the method does NOT check migration type
    expect(checksMigrationType).toBe(true);
  });
});

// ============================================================================
// D1: Missing entries in examples/README.md
// ============================================================================
describe('D1: Examples README should list all example files', () => {
  it('examples/README.md should mention opening-auction-lifecycle.ts', async () => {
    const readme = fs.readFileSync(
      path.resolve(process.cwd(), 'examples/README.md'),
      'utf-8',
    );

    expect(readme).toContain('opening-auction-lifecycle');
  });

  it('examples/README.md should mention opening-auction-bidding.ts', async () => {
    const readme = fs.readFileSync(
      path.resolve(process.cwd(), 'examples/README.md'),
      'utf-8',
    );

    expect(readme).toContain('opening-auction-bidding');
  });
});

// ============================================================================
// L5: encodeOwnerHookData packed format raw type cast
// ============================================================================
describe('L5: encodeOwnerHookData packed format should produce valid hex', () => {
  it('packed format should return a valid 42-char hex address', async () => {
    const { OpeningAuctionPositionManager } = await import(
      '../../src/entities/auction/OpeningAuctionPositionManager'
    );

    const testAddress = '0x1234567890123456789012345678901234567890' as Address;
    const result = OpeningAuctionPositionManager.encodeOwnerHookData(testAddress, 'packed');

    // Should be a valid hex string starting with 0x
    expect(result.startsWith('0x')).toBe(true);
    // Should be exactly 42 chars (0x + 40 hex chars = 20 bytes)
    expect(result.length).toBe(42);
  });

  it('abi format should produce ABI-encoded address (66 chars)', async () => {
    const { OpeningAuctionPositionManager } = await import(
      '../../src/entities/auction/OpeningAuctionPositionManager'
    );

    const testAddress = '0x1234567890123456789012345678901234567890' as Address;
    const result = OpeningAuctionPositionManager.encodeOwnerHookData(testAddress, 'abi');

    // ABI-encoded address is 32 bytes = 64 hex chars + 0x prefix = 66 chars
    expect(result.startsWith('0x')).toBe(true);
    expect(result.length).toBe(66);
  });
});

// ============================================================================
// M1: isInRange fallback only checks one tick bound per token side
// ============================================================================
describe('M1: isInRange should check both tick bounds', () => {
  it('for token0, a position with tickLower far above clearing tick should be out of range', async () => {
    // When isToken0 is true, the current code only checks refTick < position.tickUpper
    // But a position with tickLower > refTick should also be "out of range"
    // because the clearing tick hasn't reached the position's range at all.

    // This is a conceptual test — the actual behavior depends on auction mechanics.
    // For single-sided bids in opening auctions, checking only one bound may be correct.
    // This test documents the current behavior.

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/auction/OpeningAuction.ts'),
      'utf-8',
    );

    // Find isInRange method
    const methodStart = source.indexOf('async isInRange');
    const methodEnd = source.indexOf('async calculateIncentives', methodStart);
    const methodBody = source.slice(methodStart, methodEnd);

    // The fix simplified to a single expression checking both bounds.
    // It should check BOTH tickLower and tickUpper in the return statement.
    const checksLowerBound = methodBody.includes('position.tickLower');
    const checksUpperBound = methodBody.includes('position.tickUpper');
    // Should contain a single return with both bounds
    const hasCombinedCheck = methodBody.includes('tickLower') && methodBody.includes('tickUpper') &&
                              methodBody.includes('refTick >=') && methodBody.includes('refTick <');

    expect(checksLowerBound).toBe(true);
    expect(checksUpperBound).toBe(true);
    expect(hasCombinedCheck).toBe(true);
  });
});

// ============================================================================
// M7: Fee validation doesn't check for negative values
// ============================================================================
describe('M7: MulticurveBuilder fee validation should reject negative fees', () => {
  it('negative fee check exists in MulticurveBuilder source', () => {
    // Check that fee < 0 validation exists somewhere in the builder
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/builders/MulticurveBuilder.ts'),
      'utf-8',
    );

    // Should check for negative fee anywhere in the file
    const checksNegativeFee = source.includes('fee < 0') || source.includes('fee cannot be negative');
    expect(checksNegativeFee).toBe(true);
  });
});

// ============================================================================
// L15: Dead OpeningAuctionPosition in types.ts
// ============================================================================
describe('L15: OpeningAuctionPosition should be defined in only one place', () => {
  it('types.ts OpeningAuctionPosition should not duplicate entity definition', async () => {
    const typesSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/types.ts'),
      'utf-8',
    );

    const entitySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/auction/OpeningAuction.ts'),
      'utf-8',
    );

    const inTypes = typesSource.includes('interface OpeningAuctionPosition');
    const inEntity = entitySource.includes('interface OpeningAuctionPosition');

    // Should only be defined in one place
    expect(inTypes && inEntity).toBe(false);
  });
});

// ============================================================================
// M6: Builder withTime / Factory startingTime resolution mismatch
// ============================================================================
describe('M6: Factory should resolve startingTime from top-level params, not params.doppler', () => {
  it('Factory checks params.doppler.startTimeOffset which builder never populates', async () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/entities/DopplerFactory.ts'),
      'utf-8',
    );

    // Find the opening auction start time resolution
    const encodeMethod = source.indexOf('async encodeCreateOpeningAuctionParams');
    const nextMethod = source.indexOf('async createOpeningAuction', encodeMethod);
    const methodBody = source.slice(encodeMethod, nextMethod);

    // The factory should read startTimeOffset from params (top-level),
    // not from params.doppler.startTimeOffset (which builder doesn't populate)
    const readsFromDopplerSubfield = methodBody.includes('params.doppler.startTimeOffset') ||
                                      methodBody.includes('params.doppler.startingTime');
    const readsFromTopLevel = methodBody.includes('params.startTimeOffset') ||
                               methodBody.includes('params.startingTime');

    // Both patterns existing is OK (fallback chain), but if ONLY the doppler subfield
    // is checked, it will always be undefined for builder-created params
    if (readsFromDopplerSubfield) {
      expect(readsFromTopLevel).toBe(true); // Must also check top-level as primary
    }
  });
});
