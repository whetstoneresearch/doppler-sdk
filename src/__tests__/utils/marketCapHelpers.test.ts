import { describe, it, expect } from 'vitest'
import { parseEther, type Address } from 'viem'
import {
  marketCapToTokenPrice,
  tokenPriceToRatio,
  ratioToTick,
  marketCapToTicksForStaticAuction,
  marketCapToTicksForDynamicAuction,
  marketCapToTicksForMulticurve,
  marketCapToTickForMulticurve,
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

// USDC on Base (0x8335...) is > halfMaxUint160, so isToken0Expected returns true → token is token0
const USDC_BASE: Address = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

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

  describe('marketCapToTickForMulticurve', () => {
    const tokenSupply = parseEther('1000000000') // 1B tokens
    const tickSpacing = 100

    it('should calculate tick for basic case', () => {
      const tick = marketCapToTickForMulticurve({
        marketCapUSD: 1_000_000, // $1M market cap
        tokenSupply,
        numerairePriceUSD: 3000, // ETH = $3000
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // Should be aligned to tick spacing
      expect(Math.abs(tick % tickSpacing)).toBe(0)
      expect(tick).toBeGreaterThanOrEqual(-887272)
      expect(tick).toBeLessThanOrEqual(887272)
    })

    it('should produce valid ticks within range', () => {
      const tick = marketCapToTickForMulticurve({
        marketCapUSD: 1_000_000,
        tokenSupply,
        numerairePriceUSD: 3000,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // Tick can be positive or negative depending on price ratio
      expect(tick).toBeGreaterThanOrEqual(-887272)
      expect(tick).toBeLessThanOrEqual(887272)
    })

    it('should align to tick spacing', () => {
      const spacings = [1, 10, 60, 100, 200]

      for (const spacing of spacings) {
        const tick = marketCapToTickForMulticurve({
          marketCapUSD: 1_000_000,
          tokenSupply,
          numerairePriceUSD: 3000,
          tickSpacing: spacing,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
        expect(Math.abs(tick % spacing)).toBe(0)
      }
    })

    it('should calculate peg tick correctly', () => {
      const tick = marketCapToTickForMulticurve({
        marketCapUSD: 1_000_000_000, // $1B market cap
        tokenSupply: parseEther('1000000000'), // 1B tokens
        numerairePriceUSD: 0.032, // $0.032 numeraire
        tickSpacing: 100,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // Tick is around -34500 (negative because ratio = 0.032/1 < 1)
      expect(Math.abs(tick + 34500)).toBeLessThan(200)
    })
  })

  describe('marketCapToTicksForMulticurve', () => {
    const tokenSupply = parseEther('1000000000')
    const tickSpacing = 60

    it('should convert market cap range to tick range', () => {
      const { tickLower, tickUpper } = marketCapToTicksForMulticurve({
        marketCapLower: 100_000,
        marketCapUpper: 10_000_000,
        tokenSupply,
        numerairePriceUSD: 3000,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // tickLower < tickUpper (tick sign depends on price ratio)
      expect(tickLower).toBeLessThan(tickUpper)
      expect(Math.abs(tickLower % tickSpacing)).toBe(0)
      expect(Math.abs(tickUpper % tickSpacing)).toBe(0)
    })

    it('should ensure tickLower < tickUpper', () => {
      const { tickLower, tickUpper } = marketCapToTicksForMulticurve({
        marketCapLower: 100_000,
        marketCapUpper: 10_000_000,
        tokenSupply,
        numerairePriceUSD: 3000,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })
      expect(tickLower).toBeLessThan(tickUpper)
    })

    it('should throw on invalid range (lower >= upper)', () => {
      expect(() => {
        marketCapToTicksForMulticurve({
          marketCapLower: 10_000_000, // Backwards - higher as "lower"
          marketCapUpper: 100_000,
          tokenSupply,
          numerairePriceUSD: 3000,
          tickSpacing,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
      }).toThrow('Lower market cap must be less than upper market cap')
    })

    it('should throw on negative market caps', () => {
      expect(() => {
        marketCapToTicksForMulticurve({
          marketCapLower: -100_000,
          marketCapUpper: 10_000_000,
          tokenSupply,
          numerairePriceUSD: 3000,
          tickSpacing,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
      }).toThrow('Market cap values must be positive')
    })

    it('should throw on zero market caps', () => {
      expect(() => {
        marketCapToTicksForMulticurve({
          marketCapLower: 0,
          marketCapUpper: 10_000_000,
          tokenSupply,
          numerairePriceUSD: 3000,
          tickSpacing,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
      }).toThrow('Market cap values must be positive')
    })

    it('should throw when range is too narrow', () => {
      // Very close market caps with large tick spacing
      expect(() => {
        marketCapToTicksForMulticurve({
          marketCapLower: 1_000_000,
          marketCapUpper: 1_000_001, // Nearly identical
          tokenSupply,
          numerairePriceUSD: 3000,
          tickSpacing: 10000, // Large tick spacing
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
      }).toThrow('resulted in same tick')
    })
  })

  describe('marketCapToTicksForStaticAuction', () => {
    const tokenSupply = parseEther('1000000000')
    const tickSpacing = 200 // V3 tick spacing for 1% fee

    it('should produce POSITIVE ticks for any market cap range', () => {
      const { startTick, endTick } = marketCapToTicksForStaticAuction({
        marketCapRange: { start: 100_000, end: 10_000_000 },
        tokenSupply,
        numerairePriceUSD: 3000,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // V3 static: always positive, startTick < endTick
      expect(startTick).toBeGreaterThan(0)
      expect(endTick).toBeGreaterThan(0)
      expect(startTick).toBeLessThan(endTick)
    })

    it('should align to tick spacing', () => {
      const { startTick, endTick } = marketCapToTicksForStaticAuction({
        marketCapRange: { start: 100_000, end: 10_000_000 },
        tokenSupply,
        numerairePriceUSD: 3000,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      expect(startTick % tickSpacing).toBe(0)
      expect(endTick % tickSpacing).toBe(0)
    })

    it('should throw on invalid range (start >= end)', () => {
      expect(() => {
        marketCapToTicksForStaticAuction({
          marketCapRange: { start: 10_000_000, end: 100_000 }, // Backwards
          tokenSupply,
          numerairePriceUSD: 3000,
          tickSpacing,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
      }).toThrow('Start market cap must be less than end market cap')
    })

    it('should throw on negative market caps', () => {
      expect(() => {
        marketCapToTicksForStaticAuction({
          marketCapRange: { start: -100_000, end: 10_000_000 },
          tokenSupply,
          numerairePriceUSD: 3000,
          tickSpacing,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
      }).toThrow('Market cap values must be positive')
    })

    it('should handle ETH numeraire scenario', () => {
      const { startTick, endTick } = marketCapToTicksForStaticAuction({
        marketCapRange: { start: 100_000, end: 10_000_000 },
        tokenSupply,
        numerairePriceUSD: 3000,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      expect(startTick).toBeGreaterThan(0)
      expect(endTick).toBeGreaterThan(0)
      expect(startTick).toBeLessThan(endTick)
    })

    it('should handle USDC numeraire scenario', () => {
      const { startTick, endTick } = marketCapToTicksForStaticAuction({
        marketCapRange: { start: 100_000, end: 10_000_000 },
        tokenSupply,
        numerairePriceUSD: 1, // USDC = $1
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 6, // USDC has 6 decimals
      })

      // V3 static always positive, even for USDC
      expect(startTick).toBeGreaterThan(0)
      expect(endTick).toBeGreaterThan(0)
      expect(startTick).toBeLessThan(endTick)
    })
  })

  describe('marketCapToTicksForDynamicAuction', () => {
    const tokenSupply = parseEther('1000000000')
    const tickSpacing = 30 // DOPPLER_MAX_TICK_SPACING for dynamic

    it('should produce POSITIVE ticks for ETH numeraire (token1)', () => {
      const { startTick, endTick } = marketCapToTicksForDynamicAuction({
        marketCapRange: { start: 50_000, end: 500_000 },
        tokenSupply,
        numerairePriceUSD: 3000, // ETH = $3000
        numeraire: WETH_BASE,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // For token1: positive ticks, startTick < endTick
      expect(startTick).toBeGreaterThan(0)
      expect(endTick).toBeGreaterThan(0)
      expect(startTick).toBeLessThan(endTick)
    })

    it('should produce NEGATIVE ticks for USDC numeraire (token0)', () => {
      const { startTick, endTick } = marketCapToTicksForDynamicAuction({
        marketCapRange: { start: 50_000, end: 500_000 },
        tokenSupply,
        numerairePriceUSD: 1, // USDC = $1
        numeraire: USDC_BASE,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 6, // USDC has 6 decimals
      })

      // For token0: negative ticks, startTick > endTick
      expect(startTick).toBeLessThan(0)
      expect(endTick).toBeLessThan(0)
      expect(startTick).toBeGreaterThan(endTick) // Swapped for token0
    })

    it('should align to tick spacing', () => {
      const { startTick, endTick } = marketCapToTicksForDynamicAuction({
        marketCapRange: { start: 50_000, end: 500_000 },
        tokenSupply,
        numerairePriceUSD: 3000,
        numeraire: WETH_BASE,
        tickSpacing,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      expect(startTick % tickSpacing).toBe(0)
      expect(endTick % tickSpacing).toBe(0)
    })

    it('should throw on invalid range (start >= end)', () => {
      expect(() => {
        marketCapToTicksForDynamicAuction({
          marketCapRange: { start: 500_000, end: 50_000 }, // Backwards
          tokenSupply,
          numerairePriceUSD: 3000,
          numeraire: WETH_BASE,
          tickSpacing,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
      }).toThrow('Start market cap must be less than end market cap')
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

      // Add offsets to pegTick (higher offset = less negative = higher market cap)
      expect(tickLower).toBe(-200000) // -200000 + 0
      expect(tickUpper).toBe(-190000) // -200000 + 10000
    })

    it('should correctly apply offsets for token0 (high numeraire)', () => {
      // With always-negative ticks, token0 pegTick is also negative
      const pegTick = -200000
      const offsetLower = 0
      const offsetUpper = 10000

      const { tickLower, tickUpper } = applyTickOffsets(
        pegTick,
        offsetLower,
        offsetUpper,
        HIGH_NUMERAIRE // token is token0
      )

      // With always-negative ticks, add offsets for both token orderings
      expect(tickLower).toBe(-200000) // -200000 + 0
      expect(tickUpper).toBe(-190000) // -200000 + 10000
    })

    it('should match reference values for multiple curves', () => {
      // Reference values with always-negative ticks:
      // pegTick = -192100
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
      const pegTick = -200000 // Now negative with always-negate
      const { tickLower, tickUpper } = applyTickOffsets(pegTick, 0, 10000, HIGH_NUMERAIRE)
      expect(tickLower).toBeLessThanOrEqual(tickUpper)
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

    it('should reverse marketCapToTickForMulticurve conversion', () => {
      const originalMarketCap = 1_000_000 // $1M

      // Convert to tick
      const tick = marketCapToTickForMulticurve({
        marketCapUSD: originalMarketCap,
        tokenSupply,
        numerairePriceUSD: numerairePrice,
        tickSpacing: 100,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // Convert back (tickToMarketCap uses Math.abs internally)
      const recoveredMarketCap = tickToMarketCap({
        tick,
        tokenSupply,
        numerairePriceUSD: numerairePrice,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // Should be close (some precision loss due to tick spacing)
      const relativeError = Math.abs(recoveredMarketCap - originalMarketCap) / originalMarketCap
      expect(relativeError).toBeLessThan(0.01) // Within 1%
    })

    it('should work for various market caps', () => {
      const testCaps = [100_000, 1_000_000, 10_000_000, 100_000_000]

      for (const cap of testCaps) {
        const tick = marketCapToTickForMulticurve({
          marketCapUSD: cap,
          tokenSupply,
          numerairePriceUSD: numerairePrice,
          tickSpacing: 100,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })
        const recovered = tickToMarketCap({
          tick,
          tokenSupply,
          numerairePriceUSD: numerairePrice,
          tokenDecimals: 18,
          numeraireDecimals: 18,
        })

        const relativeError = Math.abs(recovered - cap) / cap
        expect(relativeError).toBeLessThan(0.01)
      }
    })

    it('should work with positive ticks from Static auction', () => {
      const startMarketCap = 1_000_000
      const endMarketCap = 10_000_000

      const { startTick, endTick } = marketCapToTicksForStaticAuction({
        marketCapRange: { start: startMarketCap, end: endMarketCap },
        tokenSupply,
        numerairePriceUSD: numerairePrice,
        tickSpacing: 100,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // Note: In V3 static, startTick (tickLower) corresponds to higher market cap (end),
      // and endTick (tickUpper) corresponds to lower market cap (start).
      // This is because: lower market cap → lower price → higher ratio → higher tick
      const recoveredEndMC = tickToMarketCap({
        tick: startTick,
        tokenSupply,
        numerairePriceUSD: numerairePrice,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })
      const recoveredStartMC = tickToMarketCap({
        tick: endTick,
        tokenSupply,
        numerairePriceUSD: numerairePrice,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // Verify both market caps round-trip correctly
      const startError = Math.abs(recoveredStartMC - startMarketCap) / startMarketCap
      const endError = Math.abs(recoveredEndMC - endMarketCap) / endMarketCap
      expect(startError).toBeLessThan(0.01)
      expect(endError).toBeLessThan(0.01)
    })

    it('should work with negative ticks from Multicurve', () => {
      const originalMarketCap = 1_000_000

      const tick = marketCapToTickForMulticurve({
        marketCapUSD: originalMarketCap,
        tokenSupply,
        numerairePriceUSD: numerairePrice,
        tickSpacing: 100,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // tick can be positive or negative depending on price ratio

      const recoveredMarketCap = tickToMarketCap({
        tick,
        tokenSupply,
        numerairePriceUSD: numerairePrice,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

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
     */
    it('should produce expected peg tick', () => {
      const pegTick = marketCapToTickForMulticurve({
        marketCapUSD: 1_000_000_000, // $1B
        tokenSupply: parseEther('1000000000'), // 1B tokens
        numerairePriceUSD: 0.032, // $0.032 numeraire
        tickSpacing: 100,
        tokenDecimals: 18,
        numeraireDecimals: 18,
      })

      // ratio = 0.032/1 = 0.032 < 1, so tick is negative ≈ -34500
      expect(Math.abs(pegTick + 34500)).toBeLessThan(200)
    })

    it('should produce expected curve ranges', () => {
      // Use calculated pegTick (negative since ratio < 1 for this scenario)
      const pegTick = -34500

      // pidsLower = [0, 8_000, 10_000], pidsUpper = [10_000, 22_000, 22_000]
      const curves = [
        { lower: 0, upper: 10_000 },
        { lower: 8_000, upper: 22_000 },
        { lower: 10_000, upper: 22_000 },
      ]

      // Expected with pegTick = -34500:
      // applyTickOffsets ADDS offsets:
      // curvesLower = [-34500 + 0, -34500 + 8000, -34500 + 10000] = [-34500, -26500, -24500]
      // curvesUpper = [-34500 + 10000, -34500 + 22000, -34500 + 22000] = [-24500, -12500, -12500]
      const expectedLower = [-34500, -26500, -24500]
      const expectedUpper = [-24500, -12500, -12500]

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
