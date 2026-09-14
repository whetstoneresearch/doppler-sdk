import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Address,
  Rpc,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  GetProgramAccountsApi,
} from '@solana/kit';
import type { PrepareBuyInput } from '../../../src/solana/predictionMarkets/builders.js';
import type { curveSwapExactIn } from '../../../src/solana/swaps.js';
import {
  buyFixture,
  encoded,
  QUOTE,
  TOKEN_QUOTE,
  ZERO,
  creator,
} from '../../../test/solana/fixtures/prediction.js';
import * as generated from '../../../src/solana/generated/initializer/index.js';
import { INITIALIZER_PROGRAM_ID } from '../../../src/solana/initializer/index.js';

type Client = Rpc<
  GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi
>;
const state = vi.hoisted(() => ({
  rpc: undefined as Client | undefined,
  plans: [] as Awaited<ReturnType<typeof curveSwapExactIn>>[],
  buy: vi.fn(),
  sign: vi.fn(),
  walletAddress: '',
}));
vi.mock('@solana/kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@solana/kit')>()),
  createSolanaRpc: () => state.rpc,
}));
vi.mock('@wallet-standard/app', () => ({
  getWallets: () => ({
    on: () => () => {},
    get: () => [
      {
        name: 'Test wallet',
        chains: ['solana:devnet'],
        features: {
          'standard:connect': {
            connect: async () => ({
              accounts: [
                { address: state.walletAddress, chains: ['solana:devnet'] },
              ],
            }),
          },
          'solana:signAndSendTransaction': {
            supportedTransactionVersions: [0],
            signAndSendTransaction: state.sign,
          },
        },
      },
    ],
  }),
}));
vi.mock(
  '../../../src/solana/predictionMarkets/index.ts',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../src/solana/predictionMarkets/index.js')
      >();
    return {
      ...actual,
      prepareBuy: async (input: PrepareBuyInput) => {
        state.buy(input);
        state.plans.push(await actual.prepareBuy(input));
        // Exercise the real UI and SDK instruction construction, but stop before any signing/RPC submission.
        throw new Error('Test stopped before signing');
      },
    };
  },
);
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
function edit(id: string, value: string) {
  input(id).value = value;
  input(id).dispatchEvent(new Event('input', { bubbles: true }));
}
async function click(id: string) {
  const button = document.getElementById(id) as HTMLButtonElement;
  button.click();
  await vi.waitFor(() => expect(button.disabled).toBe(false));
}
async function mount(quote: Address = QUOTE) {
  const f = await buyFixture([], quote);
  state.rpc = f.rpc;
  await import('../main.ts');
  edit('market', f.market);
  await click('inspect');
  expect(document.getElementById('status')?.textContent).toBe(
    'Market state refreshed from RPC.',
  );
  return f;
}
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('crypto', webcrypto);
  state.buy.mockReset();
  state.sign.mockReset();
  state.plans = [];
  state.walletAddress = creator.address;
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prediction browser DOM workflows with real SDK account decoding', () => {
  it.each([
    ['wrapped SOL', QUOTE, 4],
    ['classic SPL token', TOKEN_QUOTE, 2],
  ] as const)(
    'builds a %s buy with correct funding instructions',
    async (_, mint, setupCount) => {
      await mount(mint);
      await click('connect');
      edit('amount', '100');
      await click('quote-buy');
      expect(input('minimum').value).toBe('101');
      await click('buy');
      expect(state.buy).toHaveBeenCalledTimes(1);
      expect(state.plans[0].setupInstructions).toHaveLength(setupCount);
      expect(
        state.plans[0].setupInstructions.filter(
          (ix) => ix.programAddress === ZERO,
        ),
      ).toHaveLength(mint === QUOTE ? 1 : 0);
      expect(state.sign).not.toHaveBeenCalled();
      expect(document.getElementById('status')?.textContent).toContain(
        'Test stopped before signing',
      );
    },
  );
  it('selects the canonical prediction launch despite a same-mint lookalike', async () => {
    const f = await buyFixture();
    const canonical = f.launches[0];
    const data = generated
      .getLaunchDecoder()
      .decode(Buffer.from(canonical.account.data[0], 'base64'));
    f.launches.unshift({
      pubkey: ZERO,
      account: encoded(
        generated.getLaunchEncoder().encode({ ...data, hookProgram: ZERO }),
        INITIALIZER_PROGRAM_ID,
      ),
    });
    state.rpc = f.rpc;
    await import('../main.ts');
    edit('market', f.market);
    await click('inspect');
    expect(input('launch').value).toBe(canonical.pubkey);
    await click('connect');
    edit('launch', ZERO);
    edit('minimum', '1');
    await click('buy');
    expect(state.buy).not.toHaveBeenCalled();
    expect(document.getElementById('status')?.textContent).toContain(
      'does not match the selected market outcome',
    );
  });
  it.each(['amount', 'launch', 'market', 'rpc'])(
    'clears a quoted minimum after %s edits',
    async (field) => {
      await mount();
      edit('amount', '100');
      await click('quote-buy');
      expect(input('minimum').value).toBe('101');
      edit(field, field === 'amount' ? '200' : ZERO);
      expect(input('minimum').value).toBe('');
      expect(document.getElementById('buy-quote')?.textContent).toBe(
        'Fetch a current quote before buying.',
      );
    },
  );
  it('clears a quoted minimum when switching outcomes', async () => {
    await mount();
    edit('amount', '100');
    await click('quote-buy');
    expect(input('minimum').value).toBe('101');
    input('outcome').value = '1';
    input('outcome').dispatchEvent(new Event('change', { bubbles: true }));
    expect(input('minimum').value).toBe('');
  });
});
