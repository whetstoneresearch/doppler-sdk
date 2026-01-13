import { describe, it, expect } from 'vitest'
import { parseEther, type Address } from 'viem'
import { MulticurveBuilder } from '../../builders'
import { CHAIN_IDS } from '../../addresses'
import {
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
  FEE_TIERS,
  TICK_SPACINGS,
  WAD,
  ZERO_ADDRESS,
} from '../../constants'

// WETH on Base - token will be token1
const WETH_BASE: Address = '0x4200000000000000000000000000000000000006'

describe('MulticurveBuilder', () => {
  it('sorts lockable beneficiaries by address during build', () => {
    const beneficiaries = [
      { beneficiary: '0x0000000000000000000000000000000000000002' as Address, shares: WAD / 10n },
      { beneficiary: '0x0000000000000000000000000000000000000001' as Address, shares: WAD / 20n },
      { beneficiary: '0x0000000000000000000000000000000000000003' as Address, shares: WAD / 5n },
    ]

    const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
      .tokenConfig({ type: 'standard', name: 'LockableToken', symbol: 'LOCK', tokenURI: 'ipfs://lock' })
      .saleConfig({ initialSupply: 1_000n * WAD, numTokensToSell: 500n * WAD, numeraire: ZERO_ADDRESS })
      .poolConfig({
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: 1000,
            tickUpper: 2000,
            numPositions: 2,
            shares: WAD / 2n,
          },
          {
            tickLower: 2000,
            tickUpper: 3000,
            numPositions: 2,
            shares: WAD / 2n,
          },
        ],
        beneficiaries,
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

    const params = builder.build()
    const builtBeneficiaries = params.pool.beneficiaries ?? []

    expect(builtBeneficiaries.map(b => b.beneficiary)).toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003',
    ])
  })

  it('configures curves from market cap presets using defaults', () => {
    const expectedTickSpacing = (TICK_SPACINGS as Record<number, number>)[FEE_TIERS.LOW]

    const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
      .tokenConfig({ type: 'standard', name: 'PresetToken', symbol: 'PRE', tokenURI: 'ipfs://preset' })
      .saleConfig({ initialSupply: 1_000n * WAD, numTokensToSell: 500n * WAD, numeraire: ZERO_ADDRESS })
      .withMarketCapPresets({ fee: FEE_TIERS.LOW })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

    const params = builder.build()

    expect(params.pool.fee).toBe(FEE_TIERS.LOW)
    expect(params.pool.tickSpacing).toBe(expectedTickSpacing)
    expect(params.pool.curves).toHaveLength(4)

    const [low, medium, high, filler] = params.pool.curves
    expect(low).toEqual({
      tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[0],
      tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[0],
      numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[0],
      shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[0],
    })
    expect(medium).toEqual({
      tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[1],
      tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[1],
      numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[1],
      shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[1],
    })
    expect(high).toEqual({
      tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[2],
      tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[2],
      numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[2],
      shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[2],
    })
    expect(filler.shares).toBe(WAD - DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[0] - DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[1] - DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[2])
    expect(filler.tickLower).toBe(DEFAULT_MULTICURVE_UPPER_TICKS[2])
    expect(filler.tickUpper).toBe(filler.tickLower + DEFAULT_MULTICURVE_NUM_POSITIONS[2] * expectedTickSpacing)
  })

  it('allows overriding preset parameters', () => {
    const overrideShares = WAD / 2n

    const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
      .tokenConfig({ type: 'standard', name: 'OverrideToken', symbol: 'OVR', tokenURI: 'ipfs://override' })
      .saleConfig({ initialSupply: 1_000n * WAD, numTokensToSell: 400n * WAD, numeraire: ZERO_ADDRESS })
      .withMarketCapPresets({
        fee: 0,
        tickSpacing: 100,
        presets: ['high'],
        overrides: {
          high: {
            shares: overrideShares,
            numPositions: 22,
            tickLower: -160_000,
            tickUpper: -150_000,
          },
        },
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x00000000000000000000000000000000000000AB' as Address)

    const params = builder.build()

    expect(params.pool.fee).toBe(0)
    expect(params.pool.tickSpacing).toBe(100)
    expect(params.pool.curves).toHaveLength(2)

    const [primary, filler] = params.pool.curves

    expect(primary).toEqual({
      tickLower: -160_000,
      tickUpper: -150_000,
      numPositions: 22,
      shares: overrideShares,
    })
    expect(filler.shares).toBe(WAD - overrideShares)
    expect(filler.tickLower).toBe(-150_000)
    expect(filler.tickUpper).toBe(-150_000 + 22 * 100)
    expect(filler.numPositions).toBe(22)
  })

  describe('withCurves', () => {
    it('configures curves from market cap ranges (no tick math)', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'MarketCapToken', symbol: 'MCT', tokenURI: 'ipfs://mct' })
        .saleConfig({
          initialSupply: parseEther('1000000000'), // 1B tokens
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })
        .withCurves({
          numerairePrice: 3000, // ETH = $3000
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.3') },
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') },
            { marketCap: { start: 5_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
          ],
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

      const params = builder.build()

      // Should have 3 curves
      expect(params.pool.curves).toHaveLength(3)

      // Each curve should have valid tick ranges (tickLower < tickUpper)
      for (const curve of params.pool.curves) {
        expect(curve.tickLower).toBeLessThan(curve.tickUpper)
      }

      // Shares should match what we specified
      expect(params.pool.curves[0].shares).toBe(parseEther('0.3'))
      expect(params.pool.curves[1].shares).toBe(parseEther('0.5'))
      expect(params.pool.curves[2].shares).toBe(parseEther('0.2'))

      // Total shares should be 100%
      const totalShares = params.pool.curves.reduce((sum, c) => sum + c.shares, 0n)
      expect(totalShares).toBe(WAD)
    })

    it('works with only a single curve', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'SingleCurve', symbol: 'SC', tokenURI: 'ipfs://sc' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 1_000_000, end: 10_000_000 }, numPositions: 15, shares: WAD },
          ],
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

      const params = builder.build()

      expect(params.pool.curves).toHaveLength(1)
      expect(params.pool.curves[0].shares).toBe(WAD)
      expect(params.pool.curves[0].numPositions).toBe(15)
    })

    it('throws if shares do not equal 100%', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'TooMuch', symbol: 'TM', tokenURI: 'ipfs://tm' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      // Exceeds 100%
      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.6') },
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.6') },
          ],
        })
      }).toThrow('must equal 100%')

      // Less than 100%
      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.5') },
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.3') },
          ],
        })
      }).toThrow('must equal 100%')
    })

    it('throws if saleConfig not called first', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'NoSale', symbol: 'NS', tokenURI: 'ipfs://ns' })

      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: WAD },
          ],
        })
      }).toThrow('Must call saleConfig()')
    })

    it('throws if there is a gap between curves', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'GapToken', symbol: 'GAP', tokenURI: 'ipfs://gap' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      // Gap between first and second curve
      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.5') },
            { marketCap: { start: 2_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') }, // Gap: 1M to 2M
          ],
        })
      }).toThrow('Gap detected')

      // Gap between additional curves
      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.3') },
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.4') },
            { marketCap: { start: 10_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.3') }, // Gap: 5M to 10M
          ],
        })
      }).toThrow('Gap detected')
    })

    it('allows overlapping curves', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'OverlapToken', symbol: 'OVR', tokenURI: 'ipfs://ovr' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 2_000_000 }, numPositions: 10, shares: parseEther('0.3') }, // Ends at $2M
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') }, // Starts at $1M - overlaps!
            { marketCap: { start: 4_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') }, // Overlaps at $4-5M
          ],
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

      const params = builder.build()
      expect(params.pool.curves).toHaveLength(3)
    })

    it('throws if startMarketCap >= endMarketCap', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'BadRange', symbol: 'BAD', tokenURI: 'ipfs://bad' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      // Equal values
      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 1_000_000, end: 1_000_000 }, numPositions: 10, shares: WAD }, // Same as start
          ],
        })
      }).toThrow('must be less than')

      // Inverted
      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 5_000_000, end: 1_000_000 }, numPositions: 10, shares: WAD }, // Less than start
          ],
        })
      }).toThrow('must be less than')
    })

    it('throws if numPositions is not positive', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'ZeroPos', symbol: 'ZP', tokenURI: 'ipfs://zp' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 0, shares: WAD },
          ],
        })
      }).toThrow('numPositions must be greater than 0')
    })

    it('throws if numerairePrice is not positive', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'ZeroPrice', symbol: 'ZPR', tokenURI: 'ipfs://zpr' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      expect(() => {
        builder.withCurves({
          numerairePrice: 0,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: WAD },
          ],
        })
      }).toThrow('numerairePrice must be greater than 0')
    })

    it('throws if market cap is not positive', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'ZeroCap', symbol: 'ZC', tokenURI: 'ipfs://zc' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 0, end: 1_000_000 }, numPositions: 10, shares: WAD },
          ],
        })
      }).toThrow('marketCap.start must be greater than 0')
    })

    it('throws if curves array is empty', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'EmptyCurves', symbol: 'EC', tokenURI: 'ipfs://ec' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [],
        })
      }).toThrow('curves array must contain at least one curve')
    })

    it('accepts curves in reverse order and outputs in ascending market cap order', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'ReverseOrder', symbol: 'REV', tokenURI: 'ipfs://rev' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            // Provided in reverse order (highest to lowest)
            { marketCap: { start: 5_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') },
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.3') },
          ],
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

      const params = builder.build()

      // Should have 3 curves
      expect(params.pool.curves).toHaveLength(3)

      // Output should be sorted by market cap (ascending), so shares should be in order: 0.3, 0.5, 0.2
      expect(params.pool.curves[0].shares).toBe(parseEther('0.3'))
      expect(params.pool.curves[1].shares).toBe(parseEther('0.5'))
      expect(params.pool.curves[2].shares).toBe(parseEther('0.2'))

      // With positive ticks (ETH numeraire), lower market cap = higher tick (more ETH per token)
      // So curves are ordered by market cap ascending, but ticks are descending
      expect(params.pool.curves[0].tickLower).toBeGreaterThan(params.pool.curves[1].tickLower)
      expect(params.pool.curves[1].tickLower).toBeGreaterThan(params.pool.curves[2].tickLower)
    })

    it('accepts curves in random order and outputs in ascending market cap order', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'RandomOrder', symbol: 'RND', tokenURI: 'ipfs://rnd' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            // Provided in random order
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') },
            { marketCap: { start: 5_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.3') },
          ],
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

      const params = builder.build()

      // Output should be sorted by market cap (ascending), so shares should be in order: 0.3, 0.5, 0.2
      expect(params.pool.curves[0].shares).toBe(parseEther('0.3'))
      expect(params.pool.curves[1].shares).toBe(parseEther('0.5'))
      expect(params.pool.curves[2].shares).toBe(parseEther('0.2'))
    })

    it('detects gap between curves regardless of input order', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'GapRandom', symbol: 'GR', tokenURI: 'ipfs://gr' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })

      // Gap between $1M and $2M, but curves provided out of order
      expect(() => {
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 2_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') },
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.5') },
          ],
        })
      }).toThrow('Gap detected')
    })

    it('sorts curves with same start by end market cap', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ type: 'standard', name: 'SameStart', symbol: 'SS', tokenURI: 'ipfs://ss' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH_BASE,
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            // Both start at $500k, but different ends - should sort by end
            { marketCap: { start: 500_000, end: 5_000_000 }, numPositions: 15, shares: parseEther('0.6') },
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.4') },
          ],
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

      const params = builder.build()

      // Should be sorted by (start, end), so the one ending at $1M comes first
      expect(params.pool.curves[0].shares).toBe(parseEther('0.4'))
      expect(params.pool.curves[1].shares).toBe(parseEther('0.6'))
    })
  })
})
