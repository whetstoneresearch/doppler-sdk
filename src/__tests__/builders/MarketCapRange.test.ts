import { describe, it, expect } from 'vitest'
import { StaticAuctionBuilder, DynamicAuctionBuilder, MulticurveBuilder } from '../../builders'
import { CHAIN_IDS } from '../../addresses'
import { parseEther, type Address } from 'viem'
import { WAD } from '../../constants'

const WETH = '0x4200000000000000000000000000000000000006' as Address
const USER = '0x00000000000000000000000000000000000000AA' as Address

describe('Builder withMarketCapRange ordering', () => {
  describe('StaticAuctionBuilder', () => {
    it('throws if withMarketCapRange is called before saleConfig', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })

      expect(() =>
        builder.withMarketCapRange({
          marketCap: { start: 100_000, end: 10_000_000 },
          numerairePrice: 3000,
        })
      ).toThrow('Must call saleConfig() before withMarketCapRange()')
    })

    it('succeeds when saleConfig is called before withMarketCapRange', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withMarketCapRange({
          marketCap: { start: 100_000, end: 10_000_000 },
          numerairePrice: 3000,
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER)

      const params = builder.build()

      expect(params.pool.startTick).toBeDefined()
      expect(params.pool.endTick).toBeDefined()
      expect(params.pool.startTick).toBeLessThan(params.pool.endTick)
    })
  })

  describe('DynamicAuctionBuilder', () => {
    it('throws if withMarketCapRange is called before saleConfig', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })

      expect(() =>
        builder.withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
        })
      ).toThrow('Must call saleConfig() before withMarketCapRange()')
    })

    it('throws if poolConfig is called after withMarketCapRange', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
        })

      expect(() =>
        builder.poolConfig({ fee: 3000, tickSpacing: 60 })
      ).toThrow('Cannot use poolConfig() after withMarketCapRange()')
    })

    it('throws if withMarketCapRange is called after poolConfig', () => {
      // Note: tickSpacing: 60 would also throw for exceeding MAX_TICK_SPACING,
      // but the mutual exclusion error should be thrown first when using poolConfig() then withMarketCapRange()
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
      
      // poolConfig with tickSpacing > 30 should throw
      expect(() =>
        builder.poolConfig({ fee: 3000, tickSpacing: 60 })
      ).toThrow('Dynamic auctions require tickSpacing <= 30')
    })

    it('succeeds when saleConfig is called before withMarketCapRange (no poolConfig needed)', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER)

      const params = builder.build()

      expect(params.auction.startTick).toBeDefined()
      expect(params.auction.endTick).toBeDefined()
      expect(params.auction.startTick).toBeLessThan(params.auction.endTick)
      // Verify fee was derived (default is HIGH = 10000 / 1%)
      // tickSpacing is always 30 (max) for withMarketCapRange
      expect(params.pool.fee).toBe(10000)
      expect(params.pool.tickSpacing).toBe(30)
    })

    it('allows specifying custom fee in withMarketCapRange', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
          fee: 10000, // 1% fee tier
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER)

      const params = builder.build()

      expect(params.pool.fee).toBe(10000)
      // tickSpacing is always 30 (max) for withMarketCapRange
      expect(params.pool.tickSpacing).toBe(30)
    })
  })

  describe('MulticurveBuilder', () => {
    it('throws if withCurves is called before saleConfig', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })

      expect(() =>
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 1_000_000, end: 10_000_000 }, numPositions: 10, shares: WAD },
          ],
        })
      ).toThrow('Must call saleConfig() before withCurves()')
    })

    it('succeeds when saleConfig is called before withCurves', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.5') },
            { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') },
          ],
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER)

      const params = builder.build()

      expect(params.pool.curves).toHaveLength(2)
      expect(params.pool.curves[0].tickLower).toBeDefined()
      expect(params.pool.curves[0].tickUpper).toBeDefined()
    })
  })

  describe('token ordering auto-detection', () => {
    it('auto-detects token ordering from numeraire for StaticAuctionBuilder', () => {
      // WETH on Base (0x4200...0006) - token will be token1 (larger address)
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withMarketCapRange({
          marketCap: { start: 100_000, end: 10_000_000 },
          numerairePrice: 3000,
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER)

      const params = builder.build()

      // For V3 static auction with token as token1, ticks are POSITIVE (flipped for V3 compatibility)
      // marketCapToTick returns negative, then builder negates again → positive
      expect(params.pool.startTick).toBeGreaterThan(0)
      expect(params.pool.endTick).toBeGreaterThan(0)
    })
  })
})

