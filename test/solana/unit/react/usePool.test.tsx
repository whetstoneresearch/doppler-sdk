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
  usePool,
  usePools,
  type UsePoolOptions,
} from '@/solana/react/index.js';
import { poolDataCodec } from '@/solana/core/codecs.js';
import { ACCOUNT_DISCRIMINATORS } from '@/solana/core/constants.js';
import type { Pool } from '@/solana/core/types.js';

const addressA = getAddressDecoder().decode(new Uint8Array(32).fill(1));
const addressB = getAddressDecoder().decode(new Uint8Array(32).fill(2));
const addressesA = [addressA];
const addressesB = [addressB];
const noAddresses: Address[] = [];

type QueryResult = {
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refetching?: boolean;
};
type ConsumerProps = {
  addresses: Address[];
  options: UsePoolOptions;
  onResult: (result: QueryResult) => void;
};

function renderResult(result: QueryResult, reserves: string): ReactElement {
  return createElement(
    'output',
    {
      'data-loading': result.loading,
      'data-refetching': result.refetching ?? false,
      'data-error': result.error?.message ?? null,
    },
    reserves,
  );
}

function PoolConsumer({ addresses, options, onResult }: ConsumerProps) {
  const result = usePool(addresses[0], options);
  onResult(result);
  return renderResult(result, result.pool?.reserve0.toString() ?? 'empty');
}

function PoolsConsumer({ addresses, options, onResult }: ConsumerProps) {
  const result = usePools(addresses, options);
  onResult(result);
  return renderResult(
    result,
    [...result.pools.values()]
      .map((pool) => pool.reserve0.toString())
      .join(',') || 'empty',
  );
}

function accountResponse(reserve0: bigint) {
  const pool: Pool = {
    config: addressA,
    token0Mint: addressA,
    token1Mint: addressB,
    vault0: addressA,
    vault1: addressB,
    authority: addressA,
    bump: 0,
    reserve0,
    reserve1: 100n,
    totalShares: 100n,
    swapFeeBps: 30,
    feeSplitBps: 0,
    feeGrowthGlobal0Q64: 0n,
    feeGrowthGlobal1Q64: 0n,
    feesUnclaimed0: 0n,
    feesUnclaimed1: 0n,
    hookProgram: addressA,
    hookFlags: 0,
    liquidityMeasureTokenIndex: 0,
    kLast: 0n,
    protocolFeePosition: addressA,
    locked: 0,
    version: 1,
    reserved: new Uint8Array(7),
  };
  const bytes = Buffer.concat([
    ACCOUNT_DISCRIMINATORS.Pool,
    new Uint8Array(poolDataCodec.encode(pool)),
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
    resolve: (reserve0: bigint) => void;
    reject: (error: Error) => void;
  }[] = [];
  const transport: RpcTransport = <TResponse,>({
    payload,
  }: Parameters<RpcTransport>[0]) => {
    const request = payload as {
      id: string;
      method: string;
      params: [Address];
    };
    expect(request.method).toBe('getAccountInfo');
    return new Promise<TResponse>((resolve, reject) => {
      requests.push({
        address: request.params[0],
        resolve: (reserve0) =>
          resolve({
            jsonrpc: '2.0',
            id: request.id,
            result: accountResponse(reserve0),
          } as TResponse),
        reject,
      });
    });
  };
  return { rpc: createSolanaRpcFromTransport(transport), requests };
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
  ['usePool', PoolConsumer],
  ['usePools', PoolsConsumer],
] as const)('%s request lifecycle', (_name, Consumer) => {
  async function mount(options: UsePoolOptions = {}) {
    const { rpc, requests } = deferredTransport();
    let latest: QueryResult;
    let renders = 0;
    const onResult = (result: QueryResult) => {
      latest = result;
      renders += 1;
    };
    const tree = (
      addresses: Address[],
      commitment: 'confirmed' | 'finalized' = 'confirmed',
    ) =>
      createElement(
        AmmProvider,
        { rpc, refreshInterval: 0, commitment, children: null },
        createElement(Consumer, { addresses, options, onResult }),
      );
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(tree(addressesA));
    });
    renderers.push(renderer);
    return {
      requests,
      result: () => latest!,
      renders: () => renders,
      output: () => {
        const node = renderer.root.findByType('output');
        return {
          reserves: node.children.join(''),
          loading: node.props['data-loading'],
          refetching: node.props['data-refetching'],
          error: node.props['data-error'],
        };
      },
      update: async (
        addresses: Address[],
        commitment: 'confirmed' | 'finalized' = 'confirmed',
      ) => {
        await act(async () => renderer.update(tree(addresses, commitment)));
      },
      unmount: async () => {
        await act(async () => renderer.unmount());
      },
    };
  }

  it('keeps B when an earlier A response completes last', async () => {
    const view = await mount();
    await view.update(addressesB);
    expect(view.requests.map((request) => request.address)).toEqual([
      addressA,
      addressB,
    ]);
    await act(async () => view.requests[1].resolve(22n));
    expect(view.output().reserves).toBe('22');
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output()).toEqual({
      reserves: '22',
      loading: false,
      refetching: false,
      error: null,
    });
  });

  it('invalidates requests when provider commitment changes', async () => {
    const view = await mount();
    await view.update(addressesA, 'finalized');
    await act(async () => view.requests[1].resolve(22n));
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output()).toMatchObject({ reserves: '22', loading: false });
  });

  it('keeps the result empty after the address is cleared', async () => {
    const view = await mount();
    await view.update(noAddresses);
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output()).toEqual({
      reserves: 'empty',
      loading: false,
      refetching: false,
      error: null,
    });
  });

  it('ignores an old error and finally while B is loading', async () => {
    const view = await mount();
    await view.update(addressesB);
    await act(async () => view.requests[0].reject(new Error('old A failed')));
    expect(view.output()).toMatchObject({ loading: true, error: null });
    await act(async () => view.requests[1].resolve(22n));
    expect(view.output()).toMatchObject({ reserves: '22', loading: false });
  });

  it('does not replace B with an old failed request', async () => {
    const view = await mount();
    await view.update(addressesB);
    await act(async () => view.requests[1].resolve(22n));
    await act(async () => view.requests[0].reject(new Error('old A failed')));
    expect(view.output()).toEqual({
      reserves: '22',
      loading: false,
      refetching: false,
      error: null,
    });
  });

  it('keeps current refetch state when an old request settles', async () => {
    const view = await mount();
    await view.update(addressesB);
    await act(async () => view.requests[1].resolve(22n));
    let pending!: Promise<void>;
    await act(async () => {
      pending = view.result().refetch();
    });
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output()).toMatchObject({
      reserves: '22',
      ...(_name === 'usePool' ? { refetching: true } : { loading: true }),
    });
    await act(async () => {
      view.requests[2].resolve(33n);
      await pending;
    });
    expect(view.output()).toMatchObject({ reserves: '33', loading: false });
  });

  it('clears a pending refetch when the query is removed', async () => {
    const view = await mount();
    await act(async () => view.requests[0].resolve(11n));
    let pending!: Promise<void>;
    await act(async () => {
      pending = view.result().refetch();
    });
    await view.update(noAddresses);
    expect(view.output()).toEqual({
      reserves: 'empty',
      loading: false,
      refetching: false,
      error: null,
    });
    await act(async () => {
      view.requests[1].resolve(22n);
      await pending;
    });
    expect(view.output().reserves).toBe('empty');
  });

  it('does not render after an in-flight request is unmounted', async () => {
    const view = await mount();
    await view.unmount();
    const renders = view.renders();
    await act(async () => view.requests[0].resolve(11n));
    expect(view.renders()).toBe(renders);
  });

  it('does not start a retained refetch after unmount', async () => {
    const view = await mount();
    const refetch = view.result().refetch;
    await view.unmount();
    await refetch();
    expect(view.requests).toHaveLength(1);
  });

  it('still supports explicit refetch with fetchOnMount disabled', async () => {
    const view = await mount({ fetchOnMount: false });
    expect(view.requests).toHaveLength(0);
    let pending!: Promise<void>;
    await act(async () => {
      pending = view.result().refetch();
    });
    expect(view.requests).toHaveLength(1);
    await act(async () => {
      view.requests[0].resolve(11n);
      await pending;
    });
    expect(view.output()).toMatchObject({ reserves: '11', loading: false });
  });

  it('preserves completion ordering for overlapping same-query refetches', async () => {
    const view = await mount();
    let pending!: Promise<void>;
    await act(async () => {
      pending = view.result().refetch();
    });
    await act(async () => {
      view.requests[1].resolve(22n);
      await pending;
    });
    expect(view.output().reserves).toBe('22');
    await act(async () => view.requests[0].resolve(11n));
    expect(view.output().reserves).toBe('11');
  });

  it('keeps polling and stops its interval on unmount', async () => {
    vi.useFakeTimers();
    const view = await mount({ refreshInterval: 100 });
    await act(async () => view.requests[0].resolve(11n));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(view.requests).toHaveLength(2);
    await act(async () => view.requests[1].resolve(22n));
    expect(view.output()).toMatchObject({ reserves: '22', loading: false });
    await view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(view.requests).toHaveLength(2);
  });
});
