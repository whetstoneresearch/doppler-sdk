import { createElement, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSolanaRpcFromTransport,
  getAddressDecoder,
  type Address,
  type RpcTransport,
} from '@solana/kit';
import {
  AmmProvider,
  useOracle,
  useOracles,
  useTwap,
  type AmmConfig,
  type UseOracleOptions,
} from '@/solana/react/index.js';
import { oracleStateDataCodec } from '@/solana/core/codecs.js';
import {
  ACCOUNT_DISCRIMINATORS,
  MAX_ORACLE_OBSERVATIONS,
  Q64_ONE,
} from '@/solana/core/constants.js';
import { getOracleAddress } from '@/solana/core/pda.js';
import type { OracleState } from '@/solana/core/types.js';

const addressA = getAddressDecoder().decode(new Uint8Array(32).fill(1));
const addressB = getAddressDecoder().decode(new Uint8Array(32).fill(2));
const addressesA = [addressA];
const addressesB = [addressB];
const noAddresses: Address[] = [];

type QueryResult = {
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};
type ConsumerProps = {
  addresses: Address[];
  options: UseOracleOptions;
  onResult: (result: QueryResult) => void;
};

function renderResult(
  result: QueryResult,
  price: string,
  oracleAddress: Address | null = null,
): ReactElement {
  return createElement(
    'output',
    {
      'data-loading': result.loading,
      'data-error': result.error?.message ?? null,
      'data-address': oracleAddress,
    },
    price,
  );
}

function OracleConsumer({ addresses, options, onResult }: ConsumerProps) {
  const result = useOracle(addresses[0], options);
  onResult(result);
  return renderResult(
    result,
    result.spotPrice?.price0.toString() ?? 'empty',
    result.oracleAddress,
  );
}

function OraclesConsumer({ addresses, options, onResult }: ConsumerProps) {
  const result = useOracles(addresses, options);
  onResult(result);
  return renderResult(
    result,
    [...result.oracles.values()]
      .map(({ account }) => (account.truncPrice0Q64 / Q64_ONE).toString())
      .join(',') || 'empty',
  );
}

function TwapConsumer({ addresses, options, onResult }: ConsumerProps) {
  const result = useTwap(addresses[0], 0, options);
  onResult(result);
  return renderResult(result, result.twap?.price0.toString() ?? 'empty');
}

function accountResponse(price: bigint) {
  const oracle: OracleState = {
    pool: addressA,
    initialized: true,
    maxPriceChangeRatioQ64: Q64_ONE,
    lastSlot: 1n,
    truncPrice0Q64: price * Q64_ONE,
    truncPrice1Q64: Q64_ONE,
    deviation0Q64: 0n,
    deviation1Q64: 0n,
    price0Cumulative: 0n,
    price1Cumulative: 0n,
    lastTimestamp: 100,
    lastObservationTimestamp: 100,
    observationIntervalSec: 60,
    observationIndex: 0,
    observations: Array.from({ length: MAX_ORACLE_OBSERVATIONS }, () => ({
      timestamp: 0,
      price0Cumulative: 0n,
      price1Cumulative: 0n,
    })),
    version: 1,
    reserved: new Uint8Array(7),
  };
  const bytes = Buffer.concat([
    ACCOUNT_DISCRIMINATORS.OracleState,
    new Uint8Array(oracleStateDataCodec.encode(oracle)),
  ]);
  return {
    context: { slot: 1 },
    value: {
      data: [bytes.toString('base64'), 'base64'],
      executable: false,
      lamports: 1,
      owner: addressA,
      space: bytes.length,
    },
  };
}

function deferredTransport() {
  const requests: {
    address: Address;
    commitment: string;
    resolve: (price: bigint) => void;
    reject: (error: Error) => void;
  }[] = [];
  const waiters: { count: number; resolve: () => void }[] = [];
  const transport: RpcTransport = <TResponse,>({
    payload,
  }: Parameters<RpcTransport>[0]) => {
    const request = payload as {
      id: string;
      method: string;
      params: [Address, { commitment: string }];
    };
    expect(request.method).toBe('getAccountInfo');
    return new Promise<TResponse>((resolve, reject) => {
      requests.push({
        address: request.params[0],
        commitment: request.params[1].commitment,
        resolve: (price) =>
          resolve({
            jsonrpc: '2.0',
            id: request.id,
            result: accountResponse(price),
          } as TResponse),
        reject,
      });
      for (const waiter of waiters) {
        if (requests.length >= waiter.count) waiter.resolve();
      }
    });
  };
  return {
    rpc: createSolanaRpcFromTransport(transport),
    requests,
    waitForRequests: (count: number) =>
      requests.length >= count
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiters.push({ count, resolve })),
  };
}

const renderers: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    for (const renderer of renderers) renderer.unmount();
  });
  renderers.length = 0;
  vi.useRealTimers();
});

describe.each([
  ['useOracle', OracleConsumer],
  ['useOracles', OraclesConsumer],
  ['useTwap', TwapConsumer],
] as const)('%s request lifecycle', (name, Consumer) => {
  async function mount(options: UseOracleOptions = {}) {
    const transport = deferredTransport();
    let config: AmmConfig = { rpc: transport.rpc, refreshInterval: 0 };
    let latest: QueryResult;
    let renders = 0;
    const onResult = (result: QueryResult) => {
      latest = result;
      renders += 1;
    };
    const tree = (addresses: Address[]) =>
      createElement(
        AmmProvider,
        { ...config, children: null },
        createElement(Consumer, { addresses, options, onResult }),
      );
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(tree(addressesA));
    });
    renderers.push(renderer);
    if (options.fetchOnMount !== false) {
      await act(async () => transport.waitForRequests(1));
    }
    return {
      ...transport,
      result: () => latest!,
      renders: () => renders,
      output: () => {
        const node = renderer.root.findByType('output');
        return {
          price: node.children.join(''),
          loading: node.props['data-loading'],
          error: node.props['data-error'],
          address: node.props['data-address'],
        };
      },
      update: async (
        addresses: Address[],
        overrides: Partial<AmmConfig> = {},
      ) => {
        config = { ...config, ...overrides };
        await act(async () => renderer.update(tree(addresses)));
      },
      unmount: async () => {
        await act(async () => renderer.unmount());
      },
    };
  }

  async function changeToB(view: {
    update: (addresses: Address[]) => Promise<void>;
    waitForRequests: (count: number) => Promise<void>;
  }) {
    await view.update(addressesB);
    await act(async () => view.waitForRequests(2));
  }

  it('keeps B when an earlier A response completes last', async () => {
    const view = await mount();
    await changeToB(view);
    const [oracleA] = await getOracleAddress(addressA);
    const [oracleB] = await getOracleAddress(addressB);
    expect(view.requests.map((request) => request.address)).toEqual([
      oracleA,
      oracleB,
    ]);
    await act(async () => view.requests[1].resolve(22n));
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output()).toMatchObject({
      price: '22',
      loading: false,
      error: null,
    });
    if (name === 'useOracle') expect(view.output().address).toBe(oracleB);
  });

  it('ignores old success and finally while B is pending', async () => {
    const view = await mount();
    await changeToB(view);
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output()).toMatchObject({
      price: 'empty',
      loading: true,
      error: null,
    });
    await act(async () => view.requests[1].resolve(22n));
    expect(view.output()).toMatchObject({ price: '22', loading: false });
  });

  it('ignores old errors and finally while B is pending', async () => {
    const view = await mount();
    await changeToB(view);
    await act(async () => view.requests[0].reject(new Error('old A failed')));
    expect(view.output()).toMatchObject({
      price: 'empty',
      loading: true,
      error: null,
    });
    await act(async () => view.requests[1].resolve(22n));
    expect(view.output()).toMatchObject({ price: '22', loading: false });
  });

  it('does not replace B with an old failed request', async () => {
    const view = await mount();
    await changeToB(view);
    await act(async () => view.requests[1].resolve(22n));
    await act(async () => view.requests[0].reject(new Error('old A failed')));
    expect(view.output()).toMatchObject({
      price: '22',
      loading: false,
      error: null,
    });
  });

  it.each(['success', 'error'] as const)(
    'keeps a missing query empty after an old %s',
    async (completion) => {
      const view = await mount();
      await view.update(noAddresses);
      expect(view.output()).toMatchObject({
        price: 'empty',
        loading: false,
        error: null,
      });
      await act(async () => {
        if (completion === 'success') view.requests[0].resolve(11n);
        else view.requests[0].reject(new Error('old A failed'));
      });
      expect(view.output()).toMatchObject({
        price: 'empty',
        loading: false,
        error: null,
        address: null,
      });
    },
  );

  it('preserves current-query errors and clears them for a missing query', async () => {
    const view = await mount();
    await act(async () => view.requests[0].reject(new Error('current failed')));
    expect(view.output()).toMatchObject({
      price: 'empty',
      loading: false,
      // Batch requests deliberately omit individual failed oracles.
      error: name === 'useOracles' ? null : 'current failed',
    });
    await view.update(noAddresses);
    expect(view.output()).toMatchObject({
      price: 'empty',
      loading: false,
      error: null,
    });
  });

  it.each(['success', 'error'] as const)(
    'does not render after an unmounted request completes with %s',
    async (completion) => {
      const view = await mount();
      await view.unmount();
      const renders = view.renders();
      await act(async () => {
        if (completion === 'success') view.requests[0].resolve(11n);
        else view.requests[0].reject(new Error('unmounted failed'));
      });
      expect(view.renders()).toBe(renders);
    },
  );

  it('invalidates requests when the provider RPC changes', async () => {
    const view = await mount();
    const replacement = deferredTransport();
    await view.update(addressesA, { rpc: replacement.rpc });
    await act(async () => replacement.waitForRequests(1));
    await act(async () => view.requests[0].reject(new Error('old RPC failed')));
    expect(view.output()).toMatchObject({ loading: true, error: null });
    await act(async () => replacement.requests[0].resolve(22n));
    expect(view.output()).toMatchObject({ price: '22', loading: false });
  });

  it.each(['programId', 'commitment'] as const)(
    'invalidates requests when provider %s changes',
    async (setting) => {
      const view = await mount();
      await view.update(
        addressesA,
        setting === 'programId'
          ? { programId: addressB }
          : { commitment: 'finalized' },
      );
      await act(async () => view.waitForRequests(2));
      if (setting === 'programId') {
        const [oracleAddress] = await getOracleAddress(addressA, addressB);
        expect(view.requests[1].address).toBe(oracleAddress);
      } else {
        // The real RPC transformer omits the default finalized commitment.
        expect(view.requests[1].commitment).toBeUndefined();
      }
      await act(async () => view.requests[1].resolve(22n));
      await act(async () => view.requests[0].resolve(11n));
      expect(view.output()).toMatchObject({
        price: '22',
        loading: false,
        error: null,
      });
    },
  );

  it('supports explicit refetch with fetchOnMount disabled', async () => {
    const view = await mount({ fetchOnMount: false });
    expect(view.requests).toHaveLength(0);
    let pending!: Promise<void>;
    await act(async () => {
      pending = view.result().refetch();
    });
    await act(async () => view.waitForRequests(1));
    await act(async () => {
      view.requests[0].resolve(11n);
      await pending;
    });
    expect(view.output()).toMatchObject({ price: '11', loading: false });
  });

  it('preserves completion ordering for overlapping same-query refetches', async () => {
    const view = await mount();
    let pending!: Promise<void>;
    await act(async () => {
      pending = view.result().refetch();
    });
    await act(async () => view.waitForRequests(2));
    await act(async () => {
      view.requests[1].resolve(22n);
      await pending;
    });
    expect(view.output()).toMatchObject({ price: '22', loading: false });
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output()).toMatchObject({ price: '11', loading: false });
  });

  if (name === 'useOracles') {
    it('preserves successful oracles when an individual batch fetch fails', async () => {
      const view = await mount();
      await act(async () => view.requests[0].resolve(11n));
      await view.update([addressA, addressB]);
      await act(async () => view.waitForRequests(3));
      await act(async () => {
        view.requests[1].resolve(22n);
        view.requests[2].reject(new Error('individual oracle failed'));
      });
      expect(view.output()).toMatchObject({
        price: '22',
        loading: false,
        error: null,
      });
    });
  }

  it('keeps polling on the new query and stops its interval on unmount', async () => {
    vi.useFakeTimers();
    const view = await mount({ refreshInterval: 100 });
    await act(async () => view.requests[0].resolve(11n));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await act(async () => view.waitForRequests(2));
    await view.update(addressesB);
    await act(async () => view.waitForRequests(3));
    await act(async () => view.requests[1].resolve(12n));
    expect(view.output()).toMatchObject({ price: '11', loading: true });
    await act(async () => view.requests[2].resolve(22n));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await act(async () => view.waitForRequests(4));
    expect(view.requests[3].address).toBe(view.requests[2].address);
    await act(async () => view.requests[3].resolve(23n));
    expect(view.output()).toMatchObject({ price: '23', loading: false });
    await view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(view.requests).toHaveLength(4);
  });
});
