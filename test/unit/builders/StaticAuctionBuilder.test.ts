import { describe, it, expect } from 'vitest';
import { StaticAuctionBuilder } from '../../../src/builders';
import { CHAIN_IDS } from '../../../src/addresses';
import { WAD, ZERO_ADDRESS } from '../../../src/constants';
import type { Address } from 'viem';

describe('StaticAuctionBuilder', () => {
  describe('withBeneficiaries', () => {
    it('sorts beneficiaries by address during build', () => {
      const beneficiaries = [
        {
          beneficiary: '0x0000000000000000000000000000000000000003' as Address,
          shares: WAD / 5n,
        },
        {
          beneficiary: '0x0000000000000000000000000000000000000001' as Address,
          shares: WAD / 20n,
        },
        {
          beneficiary: '0x0000000000000000000000000000000000000002' as Address,
          shares: (WAD * 3n) / 4n,
        },
      ];

      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          type: 'standard',
          name: 'LockableToken',
          symbol: 'LOCK',
          tokenURI: 'ipfs://lock',
        })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolByTicks({
          startTick: 174960, // Must be multiple of 60 for fee 3000
          endTick: 225000,
          fee: 3000,
        })
        .withBeneficiaries(beneficiaries)
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'noOp' })
        .withUserAddress(
          '0x00000000000000000000000000000000000000AA' as Address,
        );

      const params = builder.build();
      const builtBeneficiaries = params.pool.beneficiaries ?? [];

      // Verify beneficiaries are sorted in ascending order by address
      expect(builtBeneficiaries.map((b) => b.beneficiary)).toEqual([
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000003',
      ]);

      // Verify shares are preserved after sorting
      expect(builtBeneficiaries[0].shares).toBe(WAD / 20n); // 5%
      expect(builtBeneficiaries[1].shares).toBe((WAD * 3n) / 4n); // 75%
      expect(builtBeneficiaries[2].shares).toBe(WAD / 5n); // 20%
    });

    it('includes beneficiaries in pool config when provided', () => {
      const beneficiaries = [
        {
          beneficiary: '0x0000000000000000000000000000000000000001' as Address,
          shares: WAD / 10n,
        },
        {
          beneficiary: '0x0000000000000000000000000000000000000002' as Address,
          shares: (WAD * 9n) / 10n,
        },
      ];

      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          type: 'standard',
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolByTicks({ startTick: 174960, endTick: 225000, fee: 3000 })
        .withBeneficiaries(beneficiaries)
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'noOp' })
        .withUserAddress(
          '0x00000000000000000000000000000000000000AA' as Address,
        );

      const params = builder.build();

      expect(params.pool.beneficiaries).toBeDefined();
      expect(params.pool.beneficiaries).toHaveLength(2);
    });

    it('does not include beneficiaries when not provided', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          type: 'standard',
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolByTicks({ startTick: 174960, endTick: 225000, fee: 3000 })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(
          '0x00000000000000000000000000000000000000AA' as Address,
        );

      const params = builder.build();

      expect(params.pool.beneficiaries).toBeUndefined();
    });

    it('handles case-insensitive address sorting', () => {
      const beneficiaries = [
        {
          beneficiary: '0xABCDEF0000000000000000000000000000000001' as Address,
          shares: WAD / 2n,
        },
        {
          beneficiary: '0xabcdef0000000000000000000000000000000000' as Address,
          shares: WAD / 2n,
        },
      ];

      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          type: 'standard',
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolByTicks({ startTick: 174960, endTick: 225000, fee: 3000 })
        .withBeneficiaries(beneficiaries)
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'noOp' })
        .withUserAddress(
          '0x00000000000000000000000000000000000000AA' as Address,
        );

      const params = builder.build();
      const builtBeneficiaries = params.pool.beneficiaries ?? [];

      // Lower address should come first (case-insensitive)
      expect(builtBeneficiaries[0].beneficiary.toLowerCase()).toBe(
        '0xabcdef0000000000000000000000000000000000',
      );
      expect(builtBeneficiaries[1].beneficiary.toLowerCase()).toBe(
        '0xabcdef0000000000000000000000000000000001',
      );
    });

    it('preserves pool config when beneficiaries are added', () => {
      const builder = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({
          type: 'standard',
          name: 'Test',
          symbol: 'TST',
          tokenURI: 'ipfs://test',
        })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolByTicks({
          startTick: 174960,
          endTick: 225000,
          fee: 3000,
          numPositions: 20,
          maxShareToBeSold: WAD / 2n,
        })
        .withBeneficiaries([
          {
            beneficiary:
              '0x0000000000000000000000000000000000000001' as Address,
            shares: WAD,
          },
        ])
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'noOp' })
        .withUserAddress(
          '0x00000000000000000000000000000000000000AA' as Address,
        );

      const params = builder.build();

      // Original pool config should be preserved
      expect(params.pool.startTick).toBe(174960);
      expect(params.pool.endTick).toBe(225000);
      expect(params.pool.fee).toBe(3000);
      expect(params.pool.numPositions).toBe(20);
      expect(params.pool.maxShareToBeSold).toBe(WAD / 2n);
      // And beneficiaries should be added
      expect(params.pool.beneficiaries).toHaveLength(1);
    });
  });
});
