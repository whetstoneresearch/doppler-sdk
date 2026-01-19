import { describe, it, expect } from 'vitest';
import { StaticAuctionBuilder } from '../../../static/StaticAuctionBuilder';
import { DynamicAuctionBuilder } from '../../../dynamic/DynamicAuctionBuilder';
import { MulticurveBuilder } from '../../../multicurve/MulticurveBuilder';
import { CHAIN_IDS } from '../../../common/addresses';
import { parseEther, type Address } from 'viem';
import { WAD } from '../../../common/constants';

const WETH = '0x4200000000000000000000000000000000000006' as Address;
const USER = '0x00000000000000000000000000000000000000AA' as Address;

describe('Builder withMarketCapRange ordering', () => {
  describe('StaticAuctionBuilder', () => {
    it('allows withMarketCapRange before saleConfig (order-independent)', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .withMarketCapRange({
          marketCap: { start: 100_000, end: 10_000_000 },
          numerairePrice: 3000,
        })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.pool.startTick).toBeDefined();
      expect(params.pool.endTick).toBeDefined();
      expect(params.pool.startTick).toBeLessThan(params.pool.endTick);
    });

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
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.pool.startTick).toBeDefined();
      expect(params.pool.endTick).toBeDefined();
      expect(params.pool.startTick).toBeLessThan(params.pool.endTick);
    });

    it('throws in build if neither saleConfig nor tokenSupply is provided', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .withMarketCapRange({
          marketCap: { start: 100_000, end: 10_000_000 },
          numerairePrice: 3000,
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      expect(() => builder.build()).toThrow('saleConfig is required');
    });

    it('throws if poolByTicks is called after withMarketCapRange', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .withMarketCapRange({
          marketCap: { start: 100_000, end: 10_000_000 },
          numerairePrice: 3000,
        });

      expect(() => builder.poolByTicks({ startTick: 0, endTick: 100 })).toThrow(
        'Cannot use poolByTicks() after withMarketCapRange()',
      );
    });

    it('throws if withMarketCapRange is called after poolByTicks', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .poolByTicks({ startTick: 0, endTick: 100 });

      expect(() =>
        builder.withMarketCapRange({
          marketCap: { start: 100_000, end: 10_000_000 },
          numerairePrice: 3000,
        }),
      ).toThrow('Cannot use withMarketCapRange() after poolByTicks()');
    });
  });

  describe('DynamicAuctionBuilder', () => {
    it('allows withMarketCapRange before saleConfig (order-independent)', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
        })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.auction.startTick).toBeDefined();
      expect(params.auction.endTick).toBeDefined();
      expect(params.auction.startTick).toBeLessThan(params.auction.endTick);
      expect(params.pool.fee).toBe(10000);
      expect(params.pool.tickSpacing).toBe(30);
    });

    it('throws in build if saleConfig not provided', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      expect(() => builder.build()).toThrow('saleConfig is required');
    });

    it('throws if poolConfig is called after withMarketCapRange', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
        });

      expect(() => builder.poolConfig({ fee: 3000, tickSpacing: 30 })).toThrow(
        'Cannot use poolConfig() after withMarketCapRange()',
      );
    });

    it('throws if withMarketCapRange is called after poolConfig', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .poolConfig({ fee: 3000, tickSpacing: 30 });

      expect(() =>
        builder.withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
        }),
      ).toThrow('Cannot use withMarketCapRange() after poolConfig()');
    });

    it('throws if poolConfig tickSpacing exceeds Doppler max', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        });

      // poolConfig with tickSpacing > 30 should throw
      expect(() => builder.poolConfig({ fee: 3000, tickSpacing: 60 })).toThrow(
        'Dynamic auctions require tickSpacing <= 30',
      );
    });

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
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.auction.startTick).toBeDefined();
      expect(params.auction.endTick).toBeDefined();
      expect(params.auction.startTick).toBeLessThan(params.auction.endTick);
      // Verify fee was derived (default is HIGH = 10000 / 1%)
      // tickSpacing is always 30 (max) for withMarketCapRange
      expect(params.pool.fee).toBe(10000);
      expect(params.pool.tickSpacing).toBe(30);
    });

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
          fee: 500, // 0.05% fee tier
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.pool.fee).toBe(500);
      // tickSpacing is always 30 (max) for withMarketCapRange
      expect(params.pool.tickSpacing).toBe(30);
    });

    it('allows custom fee with explicit tickSpacing', () => {
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
          fee: 2500, // Custom 0.25% fee
          tickSpacing: 10, // Required for custom fees
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.pool.fee).toBe(2500);
      expect(params.pool.tickSpacing).toBe(10);
    });

    it('auto-derives tickSpacing for custom fee', () => {
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
          fee: 2500, // Custom fee without explicit tickSpacing
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      const params = builder.build();
      expect(params.pool.fee).toBe(2500);
      // Should default to DOPPLER_MAX_TICK_SPACING (30)
      expect(params.pool.tickSpacing).toBe(30);
    });

    it('throws for fee exceeding V4_MAX_FEE', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        });

      expect(() =>
        builder.withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
          fee: 200000, // Exceeds V4_MAX_FEE (100_000)
          tickSpacing: 10,
        }),
      ).toThrow('Fee 200000 exceeds maximum allowed for V4 pools');
    });

    it('throws for tickSpacing exceeding DOPPLER_MAX_TICK_SPACING', () => {
      const builder = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'ipfs://test' })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        });

      expect(() =>
        builder.withMarketCapRange({
          marketCap: { start: 100_000, min: 10_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('10'),
          maxProceeds: parseEther('1000'),
          fee: 2500,
          tickSpacing: 60, // Exceeds DOPPLER_MAX_TICK_SPACING (30)
        }),
      ).toThrow('tickSpacing 60 exceeds maximum allowed for Doppler pools');
    });
  });

  describe('MulticurveBuilder', () => {
    it('allows withCurves before saleConfig (order-independent)', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            {
              marketCap: { start: 500_000, end: 1_000_000 },
              numPositions: 10,
              shares: parseEther('0.5'),
            },
            {
              marketCap: { start: 1_000_000, end: 5_000_000 },
              numPositions: 20,
              shares: parseEther('0.5'),
            },
          ],
        })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.pool.curves).toHaveLength(2);
      expect(params.pool.curves[0].tickLower).toBeDefined();
      expect(params.pool.curves[0].tickUpper).toBeDefined();
    });

    it('throws in build if saleConfig not provided', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            {
              marketCap: { start: 1_000_000, end: 10_000_000 },
              numPositions: 10,
              shares: WAD,
            },
          ],
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      expect(() => builder.build()).toThrow('saleConfig is required');
    });

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
            {
              marketCap: { start: 500_000, end: 1_000_000 },
              numPositions: 10,
              shares: parseEther('0.5'),
            },
            {
              marketCap: { start: 1_000_000, end: 5_000_000 },
              numPositions: 20,
              shares: parseEther('0.5'),
            },
          ],
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(USER);

      const params = builder.build();

      expect(params.pool.curves).toHaveLength(2);
      expect(params.pool.curves[0].tickLower).toBeDefined();
      expect(params.pool.curves[0].tickUpper).toBeDefined();
    });

    it('throws if poolConfig is called after withCurves', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .withCurves({
          numerairePrice: 3000,
          curves: [
            {
              marketCap: { start: 1_000_000, end: 10_000_000 },
              numPositions: 10,
              shares: WAD,
            },
          ],
        });

      expect(() =>
        builder.poolConfig({
          fee: 3000,
          tickSpacing: 60,
          curves: [
            { tickLower: 0, tickUpper: 100, numPositions: 10, shares: WAD },
          ],
        }),
      ).toThrow('Cannot use poolConfig() after withCurves()');
    });

    it('throws if withCurves is called after poolConfig', () => {
      const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('900000000'),
          numeraire: WETH,
        })
        .poolConfig({
          fee: 3000,
          tickSpacing: 60,
          curves: [
            { tickLower: 0, tickUpper: 100, numPositions: 10, shares: WAD },
          ],
        });

      expect(() =>
        builder.withCurves({
          numerairePrice: 3000,
          curves: [
            {
              marketCap: { start: 1_000_000, end: 10_000_000 },
              numPositions: 10,
              shares: WAD,
            },
          ],
        }),
      ).toThrow('Cannot use withCurves() after poolConfig()');
    });
  });

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
        .withUserAddress(USER);

      const params = builder.build();

      // For V3 static auction with token as token1, ticks are POSITIVE (flipped for V3 compatibility)
      // marketCapToTick returns negative, then builder negates again → positive
      expect(params.pool.startTick).toBeGreaterThan(0);
      expect(params.pool.endTick).toBeGreaterThan(0);
    });
  });
});
