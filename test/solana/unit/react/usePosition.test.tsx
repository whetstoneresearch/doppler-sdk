import { createElement } from 'react';
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
  WalletProvider,
  usePosition,
  useUserPositions,
  type UsePositionOptions,
  type UsePositionResult,
  type UseUserPositionsResult,
} from '@/solana/react/index.js';
import { poolDataCodec, positionDataCodec } from '@/solana/core/codecs.js';
import { ACCOUNT_DISCRIMINATORS } from '@/solana/core/constants.js';
import type { Pool, Position } from '@/solana/core/types.js';

const addressA = getAddressDecoder().decode(new Uint8Array(32).fill(1));
const addressB = getAddressDecoder().decode(new Uint8Array(32).fill(2));
const ownerA = getAddressDecoder().decode(new Uint8Array(32).fill(3));
const ownerB = getAddressDecoder().decode(new Uint8Array(32).fill(4));

const pool: Pool = {
  config: addressA,
  token0Mint: addressA,
  token1Mint: addressB,
  vault0: addressA,
  vault1: addressB,
  authority: addressA,
  bump: 0,
  reserve0: 100n,
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

function position(shares: bigint): Position {
  return {
    pool: addressA,
    owner: ownerA,
    positionId: 0n,
    shares,
    feeGrowthLast0Q64: 0n,
    feeGrowthLast1Q64: 0n,
    feeOwed0: shares,
    feeOwed1: 0n,
    version: 1,
    reserved: new Uint8Array(7),
  };
}

function account(kind: 'Pool' | 'Position', shares: bigint) {
  const bytes = Buffer.concat([
    ACCOUNT_DISCRIMINATORS[kind],
    new Uint8Array(
      kind === 'Pool'
        ? poolDataCodec.encode(pool)
        : positionDataCodec.encode(position(shares)),
    ),
  ]);
  return {
    data: [bytes.toString('base64'), 'base64'],
    executable: false,
    lamports: 1,
    owner: addressA,
    space: bytes.length,
  };
}

function deferredTransport() {
  const requests: {
    method: string;
    params: unknown[];
    resolve: (shares: bigint) => void;
    reject: (error: Error) => void;
  }[] = [];
  const arrivals: { count: number; resolve: () => void }[] = [];
  const transport: RpcTransport = <TResponse,>({
    payload,
  }: Parameters<RpcTransport>[0]) => {
    const request = payload as {
      id: string;
      method: string;
      params: unknown[];
    };
    expect(['getAccountInfo', 'getProgramAccounts']).toContain(request.method);
    return new Promise<TResponse>((resolve, reject) => {
      requests.push({
        method: request.method,
        params: request.params,
        resolve: (shares) => {
          const result =
            request.method === 'getProgramAccounts'
              ? [
                  { pubkey: addressA, account: account('Position', shares) },
                  { pubkey: addressB, account: account('Position', 0n) },
                ]
              : {
                  context: { slot: 1 },
                  value: account(
                    request.params[0] === addressA ||
                      request.params[0] === addressB
                      ? 'Pool'
                      : 'Position',
                    shares,
                  ),
                };
          resolve({ jsonrpc: '2.0', id: request.id, result } as TResponse);
        },
        reject,
      });
      for (const arrival of arrivals) {
        if (requests.length >= arrival.count) arrival.resolve();
      }
    });
  };
  return {
    rpc: createSolanaRpcFromTransport(transport),
    requests,
    waitForCount: (count: number) =>
      requests.length >= count
        ? Promise.resolve()
        : new Promise<void>((resolve) => arrivals.push({ count, resolve })),
  };
}

type QueryResult = UsePositionResult | UseUserPositionsResult;
type ConsumerProps = {
  poolAddress?: Address;
  positionId: bigint;
  options: UsePositionOptions;
  onResult: (result: QueryResult) => void;
};

function PositionConsumer({
  poolAddress,
  positionId,
  options,
  onResult,
}: ConsumerProps) {
  const result = usePosition(poolAddress, positionId, options);
  onResult(result);
  return createElement(
    'output',
    {
      'data-loading': result.loading,
      'data-error': result.error?.message ?? null,
      'data-address': result.positionAddress,
      'data-value': result.value?.amount0.toString() ?? null,
    },
    result.position?.shares.toString() ?? 'empty',
  );
}

function UserPositionsConsumer({
  poolAddress,
  options,
  onResult,
}: ConsumerProps) {
  const result = useUserPositions(poolAddress, options);
  onResult(result);
  return createElement(
    'output',
    {
      'data-loading': result.loading,
      'data-error': result.error?.message ?? null,
    },
    result.positions
      .map(({ account }) => account.shares.toString())
      .join(',') || 'empty',
  );
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
  'position',
  'position with supplied pool',
  'user positions',
] as const)('%s request lifecycle', (variant) => {
  const isList = variant === 'user positions';
  const requestsPerFetch = variant === 'position' ? 2 : 1;

  async function mount(options: UsePositionOptions = {}) {
    const transport = deferredTransport();
    let latest!: QueryResult;
    let renders = 0;
    let query: {
      poolAddress?: Address;
      owner?: Address;
      positionId: bigint;
      commitment: 'confirmed' | 'finalized';
      suppliedPool?: Pool;
    } = {
      poolAddress: addressA,
      owner: ownerA,
      positionId: 0n,
      commitment: 'confirmed',
      suppliedPool:
        variant === 'position with supplied pool' ? pool : undefined,
    };
    const tree = () =>
      createElement(
        AmmProvider,
        {
          rpc: transport.rpc,
          refreshInterval: 0,
          commitment: query.commitment,
          children: null,
        },
        createElement(
          WalletProvider,
          {
            wallet: { connected: !!query.owner, address: query.owner },
            children: null,
          },
          createElement(isList ? UserPositionsConsumer : PositionConsumer, {
            poolAddress: query.poolAddress,
            positionId: query.positionId,
            options: { ...options, pool: query.suppliedPool },
            onResult: (result: QueryResult) => {
              latest = result;
              renders += 1;
            },
          }),
        ),
      );
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(tree());
    });
    renderers.push(renderer);
    if (options.fetchOnMount !== false) {
      await act(async () => transport.waitForCount(requestsPerFetch));
    }
    return {
      requests: transport.requests,
      result: () => latest,
      renders: () => renders,
      waitForCount: async (count: number) => {
        await act(async () => transport.waitForCount(count));
      },
      output: () => {
        const node = renderer.root.findByType('output');
        return {
          shares: node.children.join(''),
          loading: node.props['data-loading'],
          error: node.props['data-error'],
        };
      },
      address: () => renderer.root.findByType('output').props['data-address'],
      value: () => renderer.root.findByType('output').props['data-value'],
      update: async (changes: Partial<typeof query>) => {
        const count = transport.requests.length;
        query = { ...query, ...changes };
        await act(async () => renderer.update(tree()));
        if (
          options.fetchOnMount !== false &&
          query.owner &&
          (isList || query.poolAddress)
        ) {
          const expected = !isList && !query.suppliedPool ? 2 : 1;
          await act(async () => transport.waitForCount(count + expected));
        }
      },
      resolve: async (start: number, shares: bigint) => {
        await act(async () => {
          for (
            let index = start;
            index < start + requestsPerFetch;
            index += 1
          ) {
            transport.requests[index].resolve(shares);
          }
        });
      },
      unmount: async () => {
        await act(async () => renderer.unmount());
      },
    };
  }

  it('keeps B when A succeeds last, including decoded values and active-position filtering', async () => {
    const view = await mount();
    await view.update({ poolAddress: addressB });
    const addressBResult = view.address();
    await view.resolve(requestsPerFetch, 22n);
    await view.resolve(0, 11n);
    expect(view.output()).toEqual({
      shares: '22',
      loading: false,
      error: null,
    });
    if (!isList) {
      expect(view.address()).toBe(addressBResult);
      expect(view.value()).toBe('22');
    }
  });

  it('ignores old errors and finally while B is pending', async () => {
    const view = await mount();
    await view.update({ poolAddress: addressB });
    await act(async () =>
      view.requests[0].reject(new Error('old query failed')),
    );
    expect(view.output()).toEqual({
      shares: 'empty',
      loading: true,
      error: null,
    });
    await view.resolve(requestsPerFetch, 22n);
    expect(view.output()).toEqual({
      shares: '22',
      loading: false,
      error: null,
    });
  });

  it('clears canceled loading and errors on wallet disconnect without reviving old data', async () => {
    const view = await mount();
    await view.update({ owner: undefined });
    await view.resolve(0, 11n);
    expect(view.output()).toEqual({
      shares: 'empty',
      loading: false,
      error: null,
    });
    if (!isList) expect(view.address()).toBeUndefined();
  });

  it('clears a current error when the wallet disconnects', async () => {
    const view = await mount();
    await act(async () =>
      view.requests[0].reject(new Error('current query failed')),
    );
    expect(view.output().error).toContain('current query failed');
    await view.update({ owner: undefined });
    expect(view.output()).toEqual({
      shares: 'empty',
      loading: false,
      error: null,
    });
  });

  it.each(['owner', 'commitment', ...(!isList ? ['positionId'] : [])])(
    'invalidates a pending request when %s changes',
    async (key) => {
      const view = await mount();
      await view.update(
        key === 'owner'
          ? { owner: ownerB }
          : key === 'commitment'
            ? { commitment: 'finalized' }
            : { positionId: 1n },
      );
      await view.resolve(requestsPerFetch, 22n);
      await view.resolve(0, 11n);
      expect(view.output()).toEqual({
        shares: '22',
        loading: false,
        error: null,
      });
    },
  );

  it.each(['success', 'error'] as const)(
    'does not render after unmount on %s',
    async (outcome) => {
      const view = await mount();
      await view.unmount();
      const renders = view.renders();
      if (outcome === 'success') await view.resolve(0, 11n);
      else
        await act(async () =>
          view.requests[0].reject(new Error('unmounted query failed')),
        );
      expect(view.renders()).toBe(renders);
    },
  );

  it('supports explicit refetch with fetchOnMount disabled and preserves same-query overlaps', async () => {
    const view = await mount({ fetchOnMount: false });
    expect(view.requests).toHaveLength(0);
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = view.result().refetch();
    });
    await view.waitForCount(requestsPerFetch);
    await act(async () => {
      second = view.result().refetch();
    });
    await view.waitForCount(requestsPerFetch * 2);
    await view.resolve(requestsPerFetch, 22n);
    await act(async () => {
      await second;
    });
    await view.resolve(0, 11n);
    await act(async () => {
      await first;
    });
    expect(view.output()).toEqual({
      shares: '11',
      loading: false,
      error: null,
    });
  });

  it('polls and stops polling on unmount', async () => {
    vi.useFakeTimers();
    const view = await mount({ refreshInterval: 100 });
    await view.resolve(0, 11n);
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await view.waitForCount(requestsPerFetch * 2);
    await view.resolve(requestsPerFetch, 22n);
    expect(view.output().shares).toBe('22');
    await view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(view.requests).toHaveLength(requestsPerFetch * 2);
  });

  if (!isList) {
    it('keeps the position empty when its pool address is cleared', async () => {
      const view = await mount();
      await view.update({ poolAddress: undefined });
      await view.resolve(0, 11n);
      expect(view.output()).toEqual({
        shares: 'empty',
        loading: false,
        error: null,
      });
      expect(view.address()).toBeUndefined();
    });

    it('invalidates a pending request when supplied pool data changes', async () => {
      const view = await mount();
      const suppliedPool = { ...pool, reserve0: 200n };
      const oldCount = view.requests.length;
      await view.update({ suppliedPool });
      await act(async () => view.requests[oldCount].resolve(22n));
      await view.resolve(0, 11n);
      expect(view.output().shares).toBe('22');
      expect(view.value()).toBe('44');
    });
  }
});
