import { describe, it, expect } from 'vitest'
import { parseEther, type Address } from 'viem'
import {
  marketCapToTokenPrice,
  tokenPriceToRatio,
  ratioToTick,
  marketCapToTick,
  marketCapRangeToTicks,
  transformTicksForAuction,
  applyTickOffsets,
  isToken1,
  validateMarketCapParameters,
  tickToMarketCap,
} from '../../utils/marketCapHelpers'

// Mock numeraire addresses for testing token ordering
// isToken0Expected returns:
//   - false when numeraire <= halfMaxUint160 (token will be token1)
//   - true when numeraire > halfMaxUint160 (token will be token0)
// halfMaxUint160 = 2^159 - 1 ≈ 0x7FFF...FFFF (39 hex chars of F)

// WETH on Base (0x4200...) is < halfMaxUint160, so isToken0Expected returns false → token is token1
const WETH_BASE: Address = '0x4200000000000000000000000000000000000006'

// A numeraire > halfMaxUint160 makes isToken0Expected return true → token is token0
// halfMaxUint160 ≈ 0x8000000000000000000000000000000000000000, so use something larger
const HIGH_NUMERAIRE: Address = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' // token is token0

describe('marketCapHelpers', () => {
  describe('marketCapToTokenPrice', () => {
    it('should correctly convert market cap to token price', () => {
      const marketCap = 1_000_000 // $1M
      const supply = parseEther('1000000000') // 1B tokens

      const price = marketCapToTokenPrice(marketCap, supply)

      // $1M / 1B tokens = $0.001 per token
      expect(price).toBeCloseTo(0.001, 10)
    })

    it('should handle different market caps', () => {
      const supply = parseEther('1000000000') // 1B tokens

      expect(marketCapToTokenPrice(100_000, supply)).toBeCloseTo(0.0001, 10)
      expect(marketCapToTokenPrice(10_000_000, supply)).toBeCloseTo(0.01, 10)
      expect(marketCapToTokenPrice(1_000_000_000, supply)).toBeCloseTo(1, 10)
    })

    it('should handle 6-decimal tokens', () => {
      // 1B tokens with 6 decimals
      const supply = BigInt(1_000_000_000) * BigInt(10 ** 6)
      const price = marketCapToTokenPrice(1_000_000, supply, 6)

      // Should still be $0.001 per token
      expect(price).toBeCloseTo(0.001, 10)
    })

    it('should throw on negative market cap', () => {
      expect(() => {
        marketCapToTokenPrice(-1000, parseEther('1000000'))
      }).toThrow('Market cap must be positive')
    })

    it('should throw on zero market cap', () => {
      expect(() => {
        marketCapToTokenPrice(0, parseEther('1000000'))
      }).toThrow('Market cap must be positive')
    })

    it('should throw on zero supply', () => {
      expect(() => {
        marketCapToTokenPrice(1000, 0n)
      }).toThrow('Token supply must be positive')
    })

    it('should throw on negative supply', () => {
      expect(() => {
        marketCapToTokenPrice(1000, -1n)
      }).toThrow('Token supply must be positive')
    })
  })

  describe('tokenPriceToRatio', () => {
    it('should correctly calculate ratio with equal decimals', () => {
      const tokenPrice = 0.001 // $0.001 per token
      const numerairePrice = 3000 // $3000 per ETH

      const ratio = tokenPriceToRatio(tokenPrice, numerairePrice, 18, 18)

      // 3000 / 0.001 = 3,000,000 (how much numeraire per token)
      expect(ratio).toBeCloseTo(3_000_000, 0)
    })

    it('should correctly handle different decimals (token 6, numeraire 18)', () => {
      const tokenPrice = 0.001
      const numerairePrice = 3000

      // Token has 6 decimals (like USDC), numeraire has 18 (like WETH)
      const ratio = tokenPriceToRatio(tokenPrice, numerairePrice, 6, 18)

      // Ratio should be adjusted by 10^(6-18) = 10^-12
      expect(ratio).toBeCloseTo(3_000_000 * 1e-12, 20)
    })

    it('should correctly handle different decimals (token 18, numeraire 6)', () => {
      const tokenPrice = 0.001
      const numerairePrice = 3000

      // Token has 18 decimals, numeraire has 6 (like USDC)
      const ratio = tokenPriceToRatio(tokenPrice, numerairePrice, 18, 6)

      // Ratio should be adjusted by 10^(18-6) = 10^12
      expect(ratio).toBeCloseTo(3_000_000 * 1e12, 0)
    })

    it('should throw on negative token price', () => {
      expect(() => {
        tokenPriceToRatio(-0.001, 3000)
      }).toThrow('Token price must be positive')
    })

    it('should throw on zero numeraire price', () => {
      expect(() => {
        tokenPriceToRatio(0.001, 0)
      }).toThrow('Numeraire price must be positive')
    })
  })

  describe('ratioToTick', () => {
    it('should convert ratio of 1 to tick 0', () => {
      expect(ratioToTick(1)).toBeCloseTo(0, 5)
    })

    it('should convert ratio of 1.0001 to tick 1', () => {
      expect(ratioToTick(1.0001)).toBeCloseTo(1, 1)
    })

    it('should convert powers of 1.0001 correctly', () => {
      expect(ratioToTick(Math.pow(1.0001, 100))).toBeCloseTo(100, 0)
      expect(ratioToTick(Math.pow(1.0001, 1000))).toBeCloseTo(1000, 0)
      expect(ratioToTick(Math.pow(1.0001, -100))).toBeCloseTo(-100, 0)
    })

    it('should throw on zero ratio', () => {
      expect(() => ratioToTick(0)).toThrow('Ratio must be positive')
    })

    it('should throw on negative ratio', () => {
      expect(() => ratioToTick(-1)).toThrow('Ratio must be positive')
    })
  })

  describe('isToken1', () => {
    it('should return true when token > numeraire', () => {
      const token = '0xB000000000000000000000000000000000000000'
      const numeraire = '0xA000000000000000000000000000000000000000'

      expect(isToken1(token, numeraire)).toBe(true)
    })

    it('should return false when token < numeraire', () => {
      const token = '0xA000000000000000000000000000000000000000'
      const numeraire = '0xB000000000000000000000000000000000000000'

      expect(isToken1(token, numeraire)).toBe(false)
    })

    it('should be case insensitive', () => {
      const token = '0xb000000000000000000000000000000000000000'
      const numeraire = '0xA000000000000000000000000000000000000000'

      expect(isToken1(token, numeraire)).toBe(true)
    })

    it('should handle real WETH address on Base', () => {
      const weth = '0x4200000000000000000000000000000000000006'
      const higherToken = '0x5000000000000000000000000000000000000000'
      const lowerToken = '0x3000000000000000000000000000000000000000'

      expect(isToken1(higherToken, weth)).toBe(true)
      expect(isToken1(lowerToken, weth)).toBe(false)
    })
  })

  describe('marketCapToTick', () => {
    const tokenSupply = parseEther('1000000000') // 1B tokens
    const tickSpacing = 100

    it('should calculate tick for basic case', () => {
      const tick = marketCapToTick(
        1_000_000, // $1M market cap
        tokenSupply,
        3000, // ETH = $3000
        18,
        18,
        tickSpacing,
        WETH_BASE
      )

      // Should return a valid tick aligned to spacing
      // Note: use Math.abs because (-149100 % 100) returns -0 in JS
      expect(Math.abs(tick % tickSpacing)).toBe(0)
      expect(tick).toBeGreaterThanOrEqual(-887272)
      expect(tick).toBeLessThanOrEqual(887272)
    })

    it('should negate tick when token is token1 (WETH numeraire)', () => {
      const tickToken1 = marketCapToTick(
        1_000_000,
        tokenSupply,
        3000,
        18,
        18,
        tickSpacing,
        WETH_BASE // token is token1
      )

      const tickToken0 = marketCapToTick(
        1_000_000,
        tokenSupply,
        3000,
        18,
        18,
        tickSpacing,
        HIGH_NUMERAIRE // token is token0
      )

      // Ticks should be negatives of each other (approximately, due to rounding)
      expect(Math.abs(tickToken1 + tickToken0)).toBeLessThanOrEqual(tickSpacing)
    })

    it('should align to tick spacing', () => {
      const spacings = [1, 10, 60, 100, 200]

      for (const spacing of spacings) {
        const tick = marketCapToTick(
          1_000_000,
          tokenSupply,
          3000,
          18,
          18,
          spacing,
          WETH_BASE
        )
        expect(Math.abs(tick % spacing)).toBe(0)
      }
    })

    it('should calculate peg tick correctly', () => {
      const tick = marketCapToTick(
        1_000_000_000, // $1B market cap
        parseEther('1000000000'), // 1B tokens
        0.032, // $0.032 numeraire
        18,
        18,
        100,
        WETH_BASE
      )

      expect(Math.abs(tick - 34500)).toBeLessThan(200)
    })

    it('should handle extreme but valid inputs without throwing', () => {
      // Very small market cap with huge supply produces large tick, but still valid
      // Tick bounds are ±887272. To exceed that, ratio would need to be ~10^38.5
      // This extreme case produces tick ~632715, which is within bounds
      const tick = marketCapToTick(
        0.000001, // Very small market cap
        parseEther('1000000000000000000'), // Huge supply (1e18 tokens)
        3000,
        18,
        18,
        1,
        WETH_BASE
      )

      // Should produce a large negative tick (tiny price = huge ratio, negated for token1)
      // With extremely small market cap and huge supply, ratio is huge → large positive raw tick → negated
      expect(tick).toBeLessThan(0)
      expect(tick).toBeGreaterThanOrEqual(-887272)
    })
  })

  describe('marketCapRangeToTicks', () => {
    const tokenSupply = parseEther('1000000000')
    const tickSpacing = 60

    it('should convert market cap range to tick range', () => {
      const { startTick, endTick } = marketCapRangeToTicks(
        { start: 100_000, end: 10_000_000 },
        tokenSupply,
        3000,
        18,
        18,
        tickSpacing,
        WETH_BASE
      )

      expect(startTick).toBeLessThan(endTick)
      // Note: use Math.abs because negative tick % spacing returns -0 in JS
      expect(Math.abs(startTick % tickSpacing)).toBe(0)
      expect(Math.abs(endTick % tickSpacing)).toBe(0)
    })

    it('should ensure startTick < endTick regardless of token ordering', () => {
      // Test with token as token1 (WETH numeraire)
      const result1 = marketCapRangeToTicks(
        { start: 100_000, end: 10_000_000 },
        tokenSupply,
        3000,
        18,
        18,
        tickSpacing,
        WETH_BASE
      )
      expect(result1.startTick).toBeLessThan(result1.endTick)

      // Test with token as token0 (low numeraire)
      const result2 = marketCapRangeToTicks(
        { start: 100_000, end: 10_000_000 },
        tokenSupply,
        3000,
        18,
        18,
        tickSpacing,
        HIGH_NUMERAIRE
      )
      expect(result2.startTick).toBeLessThan(result2.endTick)
    })

    it('should throw on invalid range (start >= end)', () => {
      expect(() => {
        marketCapRangeToTicks(
          { start: 10_000_000, end: 100_000 }, // Backwards
          tokenSupply,
          3000,
          18,
          18,
          tickSpacing,
          WETH_BASE
        )
      }).toThrow('Start market cap must be less than end market cap')
    })

    it('should throw on negative market caps', () => {
      expect(() => {
        marketCapRangeToTicks(
          { start: -100_000, end: 10_000_000 },
          tokenSupply,
          3000,
          18,
          18,
          tickSpacing,
          WETH_BASE
        )
      }).toThrow('Market cap values must be positive')
    })

    it('should throw on zero market caps', () => {
      expect(() => {
        marketCapRangeToTicks(
          { start: 0, end: 10_000_000 },
          tokenSupply,
          3000,
          18,
          18,
          tickSpacing,
          WETH_BASE
        )
      }).toThrow('Market cap values must be positive')
    })

    it('should throw when range is too narrow', () => {
      // Very close market caps with large tick spacing
      expect(() => {
        marketCapRangeToTicks(
          { start: 1_000_000, end: 1_000_001 }, // Nearly identical
          tokenSupply,
          3000,
          18,
          18,
          10000, // Large tick spacing
          WETH_BASE
        )
      }).toThrow('resulted in same tick')
    })
  })

  describe('applyTickOffsets', () => {
    it('should correctly apply offsets for token1 (WETH numeraire)', () => {
      const pegTick = -200000
      const offsetLower = 0
      const offsetUpper = 10000

      const { tickLower, tickUpper } = applyTickOffsets(
        pegTick,
        offsetLower,
        offsetUpper,
        WETH_BASE // token is token1
      )

      // For token1, add offsets: pegTick + offset
      expect(tickLower).toBe(-200000) // -200000 + 0
      expect(tickUpper).toBe(-190000) // -200000 + 10000
    })

    it('should correctly apply offsets for token0 (low numeraire)', () => {
      const pegTick = 200000
      const offsetLower = 0
      const offsetUpper = 10000

      const { tickLower, tickUpper } = applyTickOffsets(
        pegTick,
        offsetLower,
        offsetUpper,
        HIGH_NUMERAIRE // token is token0
      )

      // For token0, subtract in reverse: pegTick - offsetUpper, pegTick - offsetLower
      expect(tickLower).toBe(190000) // 200000 - 10000
      expect(tickUpper).toBe(200000) // 200000 - 0
    })

    it('should match reference values for multiple curves', () => {
      // Reference values:
      // pegTick = -192100 (after negation for token1)
      // pidsLower = [0, 8_000, 10_000]
      // pidsUpper = [10_000, 22_000, 22_000]
      // Expected curvesLower = [-192100, -184100, -182100]
      // Expected curvesUpper = [-182100, -170100, -170100]

      const pegTick = -192100

      const curve1 = applyTickOffsets(pegTick, 0, 10000, WETH_BASE)
      expect(curve1.tickLower).toBe(-192100)
      expect(curve1.tickUpper).toBe(-182100)

      const curve2 = applyTickOffsets(pegTick, 8000, 22000, WETH_BASE)
      expect(curve2.tickLower).toBe(-184100)
      expect(curve2.tickUpper).toBe(-170100)

      const curve3 = applyTickOffsets(pegTick, 10000, 22000, WETH_BASE)
      expect(curve3.tickLower).toBe(-182100)
      expect(curve3.tickUpper).toBe(-170100)
    })

    it('should maintain tickLower <= tickUpper for token1', () => {
      const pegTick = -200000
      const { tickLower, tickUpper } = applyTickOffsets(pegTick, 0, 10000, WETH_BASE)
      expect(tickLower).toBeLessThanOrEqual(tickUpper)
    })

    it('should maintain tickLower <= tickUpper for token0', () => {
      const pegTick = 200000
      const { tickLower, tickUpper } = applyTickOffsets(pegTick, 0, 10000, HIGH_NUMERAIRE)
      expect(tickLower).toBeLessThanOrEqual(tickUpper)
    })
  })

  describe('transformTicksForAuction', () => {
    it('should negate and swap ticks for token1 (WETH numeraire)', () => {
      // Raw ticks from marketCapRangeToTicks are negative for token1
      const rawStartTick = -170000 // lower market cap
      const rawEndTick = -120000   // higher market cap

      const { startTick, endTick } = transformTicksForAuction(
        rawStartTick,
        rawEndTick,
        WETH_BASE
      )

      // Should negate and swap: startTick = -rawEndTick, endTick = -rawStartTick
      expect(startTick).toBe(120000)
      expect(endTick).toBe(170000)
      expect(startTick).toBeLessThan(endTick)
    })

    it('should pass through ticks unchanged for token0 (high numeraire)', () => {
      const rawStartTick = 120000
      const rawEndTick = 170000

      const { startTick, endTick } = transformTicksForAuction(
        rawStartTick,
        rawEndTick,
        HIGH_NUMERAIRE
      )

      // Should be unchanged
      expect(startTick).toBe(rawStartTick)
      expect(endTick).toBe(rawEndTick)
    })

    it('should maintain startTick < endTick for both token orderings', () => {
      // Test token1 case
      const result1 = transformTicksForAuction(-170000, -120000, WETH_BASE)
      expect(result1.startTick).toBeLessThan(result1.endTick)

      // Test token0 case
      const result2 = transformTicksForAuction(120000, 170000, HIGH_NUMERAIRE)
      expect(result2.startTick).toBeLessThan(result2.endTick)
    })
  })

  describe('validateMarketCapParameters', () => {
    it('should pass for reasonable values', () => {
      const result = validateMarketCapParameters(1_000_000, parseEther('1000000000'))

      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should warn on very small market caps', () => {
      const result = validateMarketCapParameters(500, parseEther('1000000'))

      expect(result.valid).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('very small')
    })

    it('should warn on very large market caps', () => {
      const result = validateMarketCapParameters(10_000_000_000_000, parseEther('1000000'))

      expect(result.valid).toBe(false)
      expect(result.warnings.some((w) => w.includes('very large'))).toBe(true)
    })

    it('should warn on extremely small token price', () => {
      // Huge supply with small market cap = tiny token price
      const result = validateMarketCapParameters(
        1000, // $1k market cap
        parseEther('1000000000000000') // 1 quadrillion tokens
      )

      expect(result.valid).toBe(false)
      expect(result.warnings.some((w) => w.includes('token price'))).toBe(true)
    })

    it('should warn on extremely large token price', () => {
      // Tiny supply with large market cap = huge token price
      const result = validateMarketCapParameters(
        1_000_000_000_000, // $1T market cap
        parseEther('1000') // Only 1000 tokens
      )

      expect(result.valid).toBe(false)
      expect(result.warnings.some((w) => w.includes('token price'))).toBe(true)
    })
  })

  describe('tickToMarketCap (reverse conversion)', () => {
    const tokenSupply = parseEther('1000000000')
    const numerairePrice = 3000

    it('should reverse marketCapToTick conversion', () => {
      const originalMarketCap = 1_000_000 // $1M

      // Convert to tick
      const tick = marketCapToTick(
        originalMarketCap,
        tokenSupply,
        numerairePrice,
        18,
        18,
        100,
        WETH_BASE
      )

      // Convert back
      const recoveredMarketCap = tickToMarketCap(
        tick,
        tokenSupply,
        numerairePrice,
        18,
        18,
        WETH_BASE
      )

      // Should be close (some precision loss due to tick spacing)
      const relativeError = Math.abs(recoveredMarketCap - originalMarketCap) / originalMarketCap
      expect(relativeError).toBeLessThan(0.01) // Within 1%
    })

    it('should work for various market caps', () => {
      const testCaps = [100_000, 1_000_000, 10_000_000, 100_000_000]

      for (const cap of testCaps) {
        const tick = marketCapToTick(cap, tokenSupply, numerairePrice, 18, 18, 100, WETH_BASE)
        const recovered = tickToMarketCap(tick, tokenSupply, numerairePrice, 18, 18, WETH_BASE)

        const relativeError = Math.abs(recovered - cap) / cap
        expect(relativeError).toBeLessThan(0.01)
      }
    })

    it('should handle token0 ordering', () => {
      const originalMarketCap = 1_000_000

      const tick = marketCapToTick(
        originalMarketCap,
        tokenSupply,
        numerairePrice,
        18,
        18,
        100,
        HIGH_NUMERAIRE // token is token0
      )

      const recoveredMarketCap = tickToMarketCap(
        tick,
        tokenSupply,
        numerairePrice,
        18,
        18,
        HIGH_NUMERAIRE
      )

      const relativeError = Math.abs(recoveredMarketCap - originalMarketCap) / originalMarketCap
      expect(relativeError).toBeLessThan(0.01)
    })
  })

  describe('integration: reference validation', () => {
    /**
     * Validates tick calculations against known reference values:
     *
     * Test values:
     * startingTgtMarketCapUSD = 1_000_000_000 ($1B)
     * numeraireUSD = 0.032
     * tokenSupply = 1_000_000_000 (human readable)
     * tickSpacing = 100
     * assetIsToken1 = true (WETH numeraire)
     *
     * Math produces pegTick = 34500 (see detailed trace in earlier test)
     */
    it('should produce expected peg tick', () => {
      const pegTick = marketCapToTick(
        1_000_000_000, // $1B
        parseEther('1000000000'), // 1B tokens
        0.032, // $0.032 numeraire
        18,
        18,
        100,
        WETH_BASE
      )

      // With token as token1, tick is negated
      // ratio = 0.032/1 = 0.032, rawTick ≈ -34500, negated → tick ≈ +34500
      expect(Math.abs(pegTick - 34500)).toBeLessThan(200)
    })

    it('should produce expected curve ranges', () => {
      // Use calculated pegTick (positive due to negation for token1)
      const pegTick = 34500

      // pidsLower = [0, 8_000, 10_000], pidsUpper = [10_000, 22_000, 22_000]
      const curves = [
        { lower: 0, upper: 10_000 },
        { lower: 8_000, upper: 22_000 },
        { lower: 10_000, upper: 22_000 },
      ]

      // Expected with pegTick = 34500 and token as token1 (WETH numeraire):
      // curvesLower = [34500 + 0, 34500 + 8000, 34500 + 10000] = [34500, 42500, 44500]
      // curvesUpper = [34500 + 10000, 34500 + 22000, 34500 + 22000] = [44500, 56500, 56500]
      const expectedLower = [34500, 42500, 44500]
      const expectedUpper = [44500, 56500, 56500]

      curves.forEach((curve, i) => {
        const { tickLower, tickUpper } = applyTickOffsets(
          pegTick,
          curve.lower,
          curve.upper,
          WETH_BASE
        )

        expect(tickLower).toBe(expectedLower[i])
        expect(tickUpper).toBe(expectedUpper[i])
      })
    })
  })
})

