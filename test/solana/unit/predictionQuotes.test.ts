import { describe, expect, it, vi } from 'vitest';
import { getTokenDecoder, getTokenEncoder } from '@solana-program/token';
import * as predictionMarkets from '@/solana/predictionMarkets/index.js';
import * as initializer from '@/solana/initializer/index.js';
import * as generated from '@/solana/generated/initializer/index.js';
import {
  buyFixture,
  encoded,
  quoteVaults,
  ZERO,
} from '../fixtures/prediction.js';

describe('prediction quote snapshots', () => {
  it('quotes a known launch without getProgramAccounts and batches all price inputs', async () => {
    const fixture = await buyFixture();
    const discovery = vi.spyOn(fixture.rpc, 'getProgramAccounts');
    const singleReads = vi.spyOn(fixture.rpc, 'getAccountInfo');
    const snapshots = vi.spyOn(fixture.rpc, 'getMultipleAccounts');
    const quote = await predictionMarkets.fetchPredictionBuyQuote(fixture.rpc, {
      ...fixture.input,
      launch: fixture.launches[0].pubkey,
    });
    expect(quote.amountOut).toBe(102n);
    expect(discovery).not.toHaveBeenCalled();
    expect(singleReads).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveBeenCalledTimes(1);
    expect(snapshots.mock.calls[0][0]).toContain(quote.outcome.launchFeeState);
    expect(snapshots.mock.calls[0][0]).toContain(
      quote.outcome.launch.account.quoteVault,
    );
  });

  it.each(['buy', 'payout'] as const)(
    'does not mix fee counters with vault balances across a fee collection (%s)',
    async (kind) => {
      const fixture = await buyFixture();
      fixture.launchData.baseForDistribution = 0n;
      fixture.launchData.baseForLiquidity = 0n;
      fixture.feeData.cumulatedBaseFees = 0n;
      fixture.feeData.distributedProtocolBaseFees = 0n;
      fixture.feeData.distributedBaseByBeneficiary.fill(0n);
      fixture.feeData.distributedProtocolQuoteFees = 0n;
      fixture.feeData.distributedQuoteByBeneficiary[0] = 25n;
      fixture.update();
      const input = { ...fixture.input, launch: fixture.launches[0].pubkey };
      const quote = async () =>
        kind === 'buy'
          ? (
              await predictionMarkets.fetchPredictionBuyQuote(
                fixture.rpc,
                input,
              )
            ).amountOut
          : (
              await predictionMarkets.fetchPotentialPayoutIfWinner(
                fixture.rpc,
                {
                  market: input.market,
                  candidateMint: input.baseMint,
                  tokenAmount: 9000n,
                },
              )
            ).payoutQuoteForTokenAmount;
      const before = await quote();
      const [feeAddress] = await initializer.getLaunchFeeStateAddress(
        input.launch,
      );
      let collected = false;
      const collectFees = () => {
        if (collected) return;
        collected = true;
        const vault = fixture.accounts.get(quoteVaults[0]);
        if (!vault) throw new Error('Missing quote vault fixture');
        const token = getTokenDecoder().decode(
          Buffer.from(vault.data[0], 'base64'),
        );
        fixture.accounts.set(
          quoteVaults[0],
          encoded(
            getTokenEncoder().encode({ ...token, amount: token.amount - 25n }),
            vault.owner,
          ),
        );
        fixture.feeData.distributedQuoteByBeneficiary[0] += 25n;
        fixture.update();
      };
      // The old reader reached this fee read after reading the pre-collection vault.
      fixture.readHook.current = (key) => {
        if (key === feeAddress) collectFees();
      };
      // A batched response retains one snapshot even if collection lands before it returns.
      fixture.afterBatchRead.current = (keys) => {
        if (keys.includes(feeAddress)) collectFees();
      };
      const during = await quote();
      expect(collected).toBe(true);
      fixture.readHook.current = undefined;
      fixture.afterBatchRead.current = undefined;
      const after = await quote();
      expect(before).toBe(kind === 'buy' ? 123n : 500n);
      expect(during).toBe(before);
      expect(after).toBe(before);
    },
  );

  it.each([
    { authority: ZERO },
    { namespace: ZERO },
    { hookProgram: ZERO },
    { migratorProgram: ZERO },
    { baseMint: ZERO },
    { quoteMint: ZERO },
  ])('rejects a known launch with an unrelated binding: %s', async (patch) => {
    const fixture = await buyFixture();
    Object.assign(fixture.launchData, patch);
    fixture.update();
    await expect(
      predictionMarkets.fetchPredictionBuyQuote(fixture.rpc, {
        ...fixture.input,
        launch: fixture.launches[0].pubkey,
      }),
    ).rejects.toThrow();
  });

  it('rechecks trading flags from the snapshot rather than trusting discovery', async () => {
    const fixture = await buyFixture();
    const originalBatch = fixture.rpc.getMultipleAccounts;
    vi.spyOn(fixture.rpc, 'getMultipleAccounts').mockImplementation(
      (...args) => {
        fixture.launchData.allowBuy = 0;
        fixture.update();
        return originalBatch(...args);
      },
    );
    await expect(
      predictionMarkets.fetchPredictionBuyQuote(fixture.rpc, {
        ...fixture.input,
        launch: fixture.launches[0].pubkey,
      }),
    ).rejects.toThrow('not open for buys');
  });

  it('rejects an invalid launch discriminator in the batched account', async () => {
    const fixture = await buyFixture();
    const launch = fixture.launches[0].pubkey;
    const bytes = Uint8Array.from(
      generated.getLaunchEncoder().encode(fixture.launchData),
    );
    bytes[0] ^= 255;
    fixture.accounts.set(
      launch,
      encoded(bytes, initializer.INITIALIZER_PROGRAM_ID),
    );
    await expect(
      predictionMarkets.fetchPredictionBuyQuote(fixture.rpc, {
        ...fixture.input,
        launch,
      }),
    ).rejects.toThrow('Invalid prediction launch binding');
  });
});
