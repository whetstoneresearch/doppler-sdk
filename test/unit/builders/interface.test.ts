import { describe, it, expect } from 'vitest';
import {
  StaticAuctionBuilder,
  DynamicAuctionBuilder,
  MulticurveBuilder,
  type BaseAuctionBuilder,
} from '../../../src/builders';
import { CHAIN_IDS } from '../../../src/addresses';

describe('BaseAuctionBuilder interface', () => {
  it('StaticAuctionBuilder implements BaseAuctionBuilder', () => {
    const builder: BaseAuctionBuilder<typeof CHAIN_IDS.BASE> =
      StaticAuctionBuilder.forChain(CHAIN_IDS.BASE);

    expect(builder.chainId).toBe(CHAIN_IDS.BASE);
    expect(typeof builder.tokenConfig).toBe('function');
    expect(typeof builder.saleConfig).toBe('function');
    expect(typeof builder.withVesting).toBe('function');
    expect(typeof builder.withGovernance).toBe('function');
    expect(typeof builder.withMigration).toBe('function');
    expect(typeof builder.withUserAddress).toBe('function');
    expect(typeof builder.withIntegrator).toBe('function');
    expect(typeof builder.withGasLimit).toBe('function');
  });

  it('DynamicAuctionBuilder implements BaseAuctionBuilder', () => {
    const builder: BaseAuctionBuilder<typeof CHAIN_IDS.BASE> =
      DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE);

    expect(builder.chainId).toBe(CHAIN_IDS.BASE);
    expect(typeof builder.tokenConfig).toBe('function');
    expect(typeof builder.saleConfig).toBe('function');
    expect(typeof builder.withVesting).toBe('function');
    expect(typeof builder.withGovernance).toBe('function');
    expect(typeof builder.withMigration).toBe('function');
    expect(typeof builder.withUserAddress).toBe('function');
    expect(typeof builder.withIntegrator).toBe('function');
    expect(typeof builder.withGasLimit).toBe('function');
  });

  it('MulticurveBuilder implements BaseAuctionBuilder', () => {
    const builder: BaseAuctionBuilder<typeof CHAIN_IDS.BASE> =
      MulticurveBuilder.forChain(CHAIN_IDS.BASE);

    expect(builder.chainId).toBe(CHAIN_IDS.BASE);
    expect(typeof builder.tokenConfig).toBe('function');
    expect(typeof builder.saleConfig).toBe('function');
    expect(typeof builder.withVesting).toBe('function');
    expect(typeof builder.withGovernance).toBe('function');
    expect(typeof builder.withMigration).toBe('function');
    expect(typeof builder.withUserAddress).toBe('function');
    expect(typeof builder.withIntegrator).toBe('function');
    expect(typeof builder.withGasLimit).toBe('function');
  });
});
