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
  useFees,
  type UseFeesOptions,
  type UseFeesResult,
} from '@/solana/react/index.js';
import { poolDataCodec, positionDataCodec } from '@/solana/core/codecs.js';
import { ACCOUNT_DISCRIMINATORS } from '@/solana/core/constants.js';
import type { Pool, Position } from '@/solana/core/types.js';

const positionA = getAddressDecoder().decode(new Uint8Array(32).fill(1));
const positionB = getAddressDecoder().decode(new Uint8Array(32).fill(2));
const poolA = getAddressDecoder().decode(new Uint8Array(32).fill(3));
const poolB = getAddressDecoder().decode(new Uint8Array(32).fill(4));

function pool(growth: bigint): Pool {
  return {
    config: poolA,
    token0Mint: positionA,
    token1Mint: positionB,
    vault0: positionA,
    vault1: positionB,
    authority: poolA,
    bump: 0,
    reserve0: 100n,
    reserve1: 100n,
    totalShares: 100n,
    swapFeeBps: 30,
    feeSplitBps: 0,
    feeGrowthGlobal0Q64: growth << 64n,
    feeGrowthGlobal1Q64: 0n,
    feesUnclaimed0: 0n,
    feesUnclaimed1: 0n,
    hookProgram: poolA,
    hookFlags: 0,
    liquidityMeasureTokenIndex: 0,
    kLast: 0n,
    protocolFeePosition: positionA,
    locked: 0,
    version: 1,
    reserved: new Uint8Array(7),
  };
}

function position(owed: bigint): Position {
  return {
    pool: poolA,
    owner: positionA,
    positionId: 0n,
    shares: 1n,
    feeGrowthLast0Q64: 0n,
    feeGrowthLast1Q64: 0n,
    feeOwed0: owed,
    feeOwed1: 0n,
    version: 1,
    reserved: new Uint8Array(7),
  };
}

const suppliedPool = pool(0n);
const suppliedPosition = position(0n);

function accountResponse(address: Address, value: bigint) {
  const isPool = address === poolA || address === poolB;
  const bytes = Buffer.concat([
    ACCOUNT_DISCRIMINATORS[isPool ? 'Pool' : 'Position'],
    new Uint8Array(
      isPool
        ? poolDataCodec.encode(pool(value))
        : positionDataCodec.encode(position(value)),
    ),
  ]);
  return {
    context: { slot: 1 },
    value: {
      data: [bytes.toString('base64'), 'base64'],
      executable: false,
      lamports: 1,
      owner: poolA,
      space: bytes.length,
    },
  };
}

function deferredTransport() {
  const requests: {
    address: Address;
    resolve: (value: bigint) => void;
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
        resolve: (value) =>
          resolve({
            jsonrpc: '2.0',
            id: request.id,
            result: accountResponse(request.params[0], value),
          } as TResponse),
        reject,
      });
    });
  };
  return { rpc: createSolanaRpcFromTransport(transport), requests };
}

type ConsumerProps = {
  positionAddress?: Address;
  poolAddress?: Address;
  options: UseFeesOptions;
  onResult: (result: UseFeesResult) => void;
};

function FeesConsumer({
  positionAddress,
  poolAddress,
  options,
  onResult,
}: ConsumerProps) {
  const result = useFees(positionAddress, poolAddress, options);
  onResult(result);
  return createElement(
    'output',
    {
      'data-loading': result.loading,
      'data-refetching': result.refetching,
      'data-error': result.error?.message ?? null,
      'data-has-fees': result.fees?.hasFees ?? false,
    },
    result.fees?.pending0.toString() ?? 'empty',
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

describe.each(['fetched pair', 'supplied pool', 'supplied position'] as const)(
  'useFees with %s request lifecycle',
  (variant) => {
    const requestsPerFetch = variant === 'fetched pair' ? 2 : 1;
    const expectedFees = (value: bigint) =>
      (variant === 'fetched pair' ? value * 2n : value).toString();

    async function mount(options: UseFeesOptions = {}) {
      const { rpc, requests } = deferredTransport();
      let latest!: UseFeesResult;
      let renders = 0;
      let query: {
        positionAddress?: Address;
        poolAddress?: Address;
        pool?: Pool | null;
        position?: Position | null;
        commitment: 'confirmed' | 'finalized';
      } = {
        positionAddress: positionA,
        poolAddress: poolA,
        pool: variant === 'supplied pool' ? suppliedPool : undefined,
        position:
          variant === 'supplied position' ? suppliedPosition : undefined,
        commitment: 'confirmed',
      };
      const tree = () =>
        createElement(
          AmmProvider,
          {
            rpc,
            refreshInterval: 0,
            commitment: query.commitment,
            children: null,
          },
          createElement(FeesConsumer, {
            positionAddress: query.positionAddress,
            poolAddress: query.poolAddress,
            options: { ...options, pool: query.pool, position: query.position },
            onResult: (result: UseFeesResult) => {
              latest = result;
              renders += 1;
            },
          }),
        );
      let renderer!: ReactTestRenderer;
      await act(async () => {
        renderer = create(tree());
      });
      renderers.push(renderer);
      return {
        requests,
        result: () => latest,
        renders: () => renders,
        output: () => {
          const node = renderer.root.findByType('output');
          return {
            fees: node.children.join(''),
            loading: node.props['data-loading'],
            refetching: node.props['data-refetching'],
            error: node.props['data-error'],
            hasFees: node.props['data-has-fees'],
          };
        },
        update: async (changes: Partial<typeof query>) => {
          query = { ...query, ...changes };
          await act(async () => renderer.update(tree()));
        },
        resolve: async (
          start: number,
          value: bigint,
          count = requestsPerFetch,
        ) => {
          await act(async () => {
            for (let index = start; index < start + count; index += 1)
              requests[index].resolve(value);
          });
        },
        unmount: async () => {
          await act(async () => renderer.unmount());
        },
      };
    }

    it('keeps decoded B fees when A completes last', async () => {
      const view = await mount();
      expect(view.requests).toHaveLength(requestsPerFetch);
      await view.update({ positionAddress: positionB, poolAddress: poolB });
      expect(view.requests).toHaveLength(requestsPerFetch * 2);
      await view.resolve(requestsPerFetch, 22n);
      await view.resolve(0, 11n);
      expect(view.output()).toEqual({
        fees: expectedFees(22n),
        loading: false,
        refetching: false,
        error: null,
        hasFees: true,
      });
    });

    it('ignores stale errors and finally while B is loading', async () => {
      const view = await mount();
      await view.update({ positionAddress: positionB, poolAddress: poolB });
      await act(async () =>
        view.requests[0].reject(new Error('old query failed')),
      );
      expect(view.output()).toMatchObject({ loading: true, error: null });
      await view.resolve(requestsPerFetch, 22n);
      expect(view.output()).toMatchObject({
        fees: expectedFees(22n),
        loading: false,
        error: null,
      });
    });

    it('does not replace B with a late A error', async () => {
      const view = await mount();
      await view.update({ positionAddress: positionB, poolAddress: poolB });
      await view.resolve(requestsPerFetch, 22n);
      await act(async () =>
        view.requests[0].reject(new Error('old query failed')),
      );
      expect(view.output()).toMatchObject({
        fees: expectedFees(22n),
        loading: false,
        error: null,
      });
    });

    it('invalidates pending work when provider commitment changes', async () => {
      const view = await mount();
      await view.update({ commitment: 'finalized' });
      await view.resolve(requestsPerFetch, 22n);
      await view.resolve(0, 11n);
      expect(view.output()).toMatchObject({
        fees: expectedFees(22n),
        loading: false,
        error: null,
      });
    });

    it('settles loading and refetching on a missing query without reviving canceled data', async () => {
      const view = await mount();
      let pending!: Promise<void>;
      await act(async () => {
        pending = view.result().refetch();
      });
      expect(view.output().refetching).toBe(true);
      await view.update({
        positionAddress: undefined,
        poolAddress: undefined,
        position: undefined,
      });
      const empty = view.output();
      expect(empty).toMatchObject({
        fees: 'empty',
        loading: false,
        refetching: false,
        error: null,
      });
      await view.resolve(0, 11n);
      await view.resolve(requestsPerFetch, 22n);
      await act(async () => {
        await pending;
      });
      expect(view.output()).toEqual(empty);
    });

    it('clears a current error on a missing query', async () => {
      const view = await mount();
      await act(async () =>
        view.requests[0].reject(new Error('current query failed')),
      );
      expect(view.output().error).toContain('current query failed');
      await view.update({
        positionAddress: undefined,
        poolAddress: undefined,
        position: undefined,
      });
      expect(view.output()).toMatchObject({
        loading: false,
        refetching: false,
        error: null,
      });
    });

    it('keeps supplied data when it replaces pending fetches and refetches', async () => {
      const view = await mount();
      let pending!: Promise<void>;
      await act(async () => {
        pending = view.result().refetch();
      });
      await view.update({ pool: suppliedPool, position: position(33n) });
      expect(view.output()).toEqual({
        fees: '33',
        loading: false,
        refetching: false,
        error: null,
        hasFees: true,
      });
      expect(view.requests).toHaveLength(requestsPerFetch * 2);
      await view.resolve(0, 11n);
      await act(async () =>
        view.requests[requestsPerFetch].reject(new Error('old refetch failed')),
      );
      await act(async () => {
        await pending;
      });
      expect(view.output()).toEqual({
        fees: '33',
        loading: false,
        refetching: false,
        error: null,
        hasFees: true,
      });
      await act(async () => {
        await view.result().refetch();
      });
      expect(view.requests).toHaveLength(requestsPerFetch * 2);
    });

    it('invalidates an old fetched half when supplied data changes', async () => {
      const view = await mount();
      if (variant === 'supplied position') {
        await view.update({ position: position(9n) });
      } else {
        await view.update({ pool: pool(7n) });
      }
      expect(view.requests).toHaveLength(requestsPerFetch + 1);
      await view.resolve(requestsPerFetch, 22n, 1);
      const expected = variant === 'supplied position' ? '31' : '29';
      expect(view.output()).toMatchObject({ fees: expected, loading: false });
      await view.resolve(0, 11n);
      expect(view.output()).toMatchObject({
        fees: expected,
        loading: false,
        error: null,
      });
    });

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
      expect(view.output().refetching).toBe(true);
      await act(async () => {
        second = view.result().refetch();
      });
      await view.resolve(requestsPerFetch, 22n);
      await act(async () => {
        await second;
      });
      await view.resolve(0, 11n);
      await act(async () => {
        await first;
      });
      expect(view.output()).toMatchObject({
        fees: expectedFees(11n),
        loading: false,
        refetching: false,
      });
    });

    it('polls using refetch state and stops the interval on unmount', async () => {
      vi.useFakeTimers();
      const view = await mount({ refreshInterval: 100 });
      await view.resolve(0, 11n);
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(view.requests).toHaveLength(requestsPerFetch * 2);
      expect(view.output()).toMatchObject({ loading: false, refetching: true });
      await view.resolve(requestsPerFetch, 22n);
      expect(view.output()).toMatchObject({
        fees: expectedFees(22n),
        refetching: false,
      });
      await view.unmount();
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(view.requests).toHaveLength(requestsPerFetch * 2);
    });
  },
);
