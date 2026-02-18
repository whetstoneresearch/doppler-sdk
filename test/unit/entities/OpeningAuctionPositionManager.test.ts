import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  type Address,
  type Hash,
  type Hex,
  zeroHash,
} from 'viem';
import { OpeningAuctionPositionManager } from '../../../src/entities/auction/OpeningAuctionPositionManager';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import {
  mockAddresses,
  mockHookAddress,
  mockTokenAddress,
} from '../../setup/fixtures/addresses';
import type { V4PoolKey } from '../../../src/types';

describe('OpeningAuctionPositionManager', () => {
  const mockPositionManagerAddress =
    '0x1111111111111111111111111111111111111111' as Address;
  const mockPoolManagerAddress =
    '0x2222222222222222222222222222222222222222' as Address;

  const mockKey: V4PoolKey = {
    currency0: mockTokenAddress,
    currency1: mockAddresses.weth,
    fee: 3000,
    tickSpacing: 60,
    hooks: mockHookAddress,
  };

  const mockParams = {
    tickLower: -120,
    tickUpper: 120,
    liquidityDelta: 1n,
    salt: `0x${'11'.repeat(32)}` as Hash,
  };

  const mockHookData = `0x${'aa'.repeat(32)}` as Hex;
  const mockTxHash = `0x${'bb'.repeat(32)}` as Hex;

  let manager: OpeningAuctionPositionManager;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    manager = new OpeningAuctionPositionManager(
      publicClient,
      walletClient,
      mockPositionManagerAddress,
    );
  });

  describe('getAddress', () => {
    it('returns the position manager address', () => {
      expect(manager.getAddress()).toBe(mockPositionManagerAddress);
    });
  });

  describe('getPoolManager', () => {
    it('reads the pool manager address via readContract', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(
        mockPoolManagerAddress,
      );

      const result = await manager.getPoolManager();

      expect(result).toBe(mockPoolManagerAddress);
      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'poolManager',
      });
    });
  });

  describe('call encoding', () => {
    it('encodeOwnerHookData defaults to ABI encoding', () => {
      const owner = mockTokenAddress;
      const expected = encodeAbiParameters([{ type: 'address' }], [owner]);
      expect(OpeningAuctionPositionManager.encodeOwnerHookData(owner)).toBe(
        expected,
      );
    });

    it('encodeOwnerHookData supports packed 20-byte encoding', () => {
      const owner =
        '0x3333333333333333333333333333333333333333' as Address;
      const packed = OpeningAuctionPositionManager.encodeOwnerHookData(
        owner,
        'packed',
      );
      expect(packed).toBe(owner);
      expect(packed.length).toBe(42); // 0x + 40 hex chars
    });

    it('decodeDelta splits BalanceDelta into two int128 values', () => {
      const delta = (5n << 128n) + 7n;
      expect(OpeningAuctionPositionManager.decodeDelta(delta)).toEqual({
        amount0: 5n,
        amount1: 7n,
      });
    });

    it('computePositionKey matches keccak256(abi.encodePacked(...)) shape', () => {
      const key = OpeningAuctionPositionManager.computePositionKey({
        owner: mockTokenAddress,
        tickLower: -120,
        tickUpper: -60,
        salt: `0x${'00'.repeat(32)}` as Hash,
      });
      expect(key).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });
  });

  describe('buildSingleTickParams', () => {
    it('sets tickUpper using tickSpacing and defaults salt to zero', () => {
      const tickLower = -360;
      const params = OpeningAuctionPositionManager.buildSingleTickParams({
        key: mockKey,
        tickLower,
        liquidityDelta: 42n,
      });

      expect(params).toEqual({
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: 42n,
        salt: zeroHash,
      });
    });

    it('respects the provided salt instead of the default', () => {
      const salt = `0x${'44'.repeat(32)}` as Hash;
      const params = OpeningAuctionPositionManager.buildSingleTickParams({
        key: mockKey,
        tickLower: 0,
        liquidityDelta: 1n,
        salt,
      });

      expect(params.salt).toBe(salt);
    });
  });

  describe('modifyLiquidity', () => {
    it('simulateModifyLiquidity uses wallet account by default', async () => {
      const delta = (1n << 128n) + 2n;
      const request = {
        address: mockPositionManagerAddress,
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams],
      };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
        result: delta,
      } as any);

      const simulation = await manager.simulateModifyLiquidity(
        mockKey,
        mockParams,
      );

      expect(simulation).toEqual({
        request,
        delta,
        decoded: { amount0: 1n, amount1: 2n },
      });
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams],
        account: walletClient.account,
      });
    });

    it('simulateModifyLiquidity accepts explicit account override', async () => {
      const explicitAccount =
        '0x4444444444444444444444444444444444444444' as Address;
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { functionName: 'modifyLiquidity' },
        result: 0n,
      } as any);

      await manager.simulateModifyLiquidity(mockKey, mockParams, explicitAccount);

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams],
        account: explicitAccount,
      });
    });

    it('modifyLiquidity simulates then writes transaction', async () => {
      const request = {
        address: mockPositionManagerAddress,
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams],
      };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
        result: 0n,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash);

      const txHash = await manager.modifyLiquidity(mockKey, mockParams);

      expect(txHash).toBe(mockTxHash);
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams],
        account: walletClient.account,
      });
      expect(walletClient.writeContract).toHaveBeenCalledWith(request);
    });

    it('modifyLiquidity throws when wallet client is missing', async () => {
      const readOnlyManager = new OpeningAuctionPositionManager(
        publicClient,
        undefined,
        mockPositionManagerAddress,
      );

      await expect(
        readOnlyManager.modifyLiquidity(mockKey, mockParams),
      ).rejects.toThrow('Wallet client required for write operations');
    });
  });

  describe('modifyLiquidityWithHookData', () => {
    it('simulateModifyLiquidityWithHookData uses wallet account by default', async () => {
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { functionName: 'modifyLiquidity' },
        result: 0n,
      } as any);

      await manager.simulateModifyLiquidityWithHookData(
        mockKey,
        mockParams,
        mockHookData,
      );

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams, mockHookData],
        account: walletClient.account,
      });
    });

    it('simulateModifyLiquidityWithHookData accepts explicit account override', async () => {
      const explicitAccount =
        '0x5555555555555555555555555555555555555555' as Address;
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { functionName: 'modifyLiquidity' },
        result: 0n,
      } as any);

      await manager.simulateModifyLiquidityWithHookData(
        mockKey,
        mockParams,
        mockHookData,
        explicitAccount,
      );

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams, mockHookData],
        account: explicitAccount,
      });
    });

    it('modifyLiquidityWithHookData simulates then writes transaction', async () => {
      const request = {
        address: mockPositionManagerAddress,
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams, mockHookData],
      };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
        result: 0n,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash);

      const txHash = await manager.modifyLiquidityWithHookData(
        mockKey,
        mockParams,
        mockHookData,
      );

      expect(txHash).toBe(mockTxHash);
      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [mockKey, mockParams, mockHookData],
        account: walletClient.account,
      });
      expect(walletClient.writeContract).toHaveBeenCalledWith(request);
    });

    it('modifyLiquidityWithHookData throws when wallet client is missing', async () => {
      const readOnlyManager = new OpeningAuctionPositionManager(
        publicClient,
        undefined,
        mockPositionManagerAddress,
      );

      await expect(
        readOnlyManager.modifyLiquidityWithHookData(
          mockKey,
          mockParams,
          mockHookData,
        ),
      ).rejects.toThrow('Wallet client required for write operations');
    });
  });

  describe('simulatePlaceBid', () => {
    const tickLower = 120;
    const liquidity = 123n;
    const salt = `0x${'55'.repeat(32)}` as Hash;

    it('builds single-tick params and forwards to simulateModifyLiquidity when no hookData', async () => {
      const simulation = {
        request: {},
        delta: 0n,
        decoded: { amount0: 0n, amount1: 0n },
      };
      const account = '0x6666666666666666666666666666666666666666' as Address;
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: liquidity,
        salt,
      };
      const spy = vi
        .spyOn(manager, 'simulateModifyLiquidity')
        .mockResolvedValueOnce(simulation);

      const result = await manager.simulatePlaceBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
        account,
      });

      expect(result).toBe(simulation);
      expect(spy).toHaveBeenCalledWith(mockKey, params, account);
      spy.mockRestore();
    });

    it('routes through simulateModifyLiquidityWithHookData when hookData is provided', async () => {
      const account = '0x7777777777777777777777777777777777777777' as Address;
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: liquidity,
        salt,
      };
      const spy = vi
        .spyOn(manager, 'simulateModifyLiquidityWithHookData')
        .mockResolvedValueOnce({
          request: {},
          delta: 0n,
          decoded: { amount0: 0n, amount1: 0n },
        });

      await manager.simulatePlaceBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
        account,
        hookData: mockHookData,
      });

      expect(spy).toHaveBeenCalledWith(
        mockKey,
        params,
        mockHookData,
        account,
      );
      spy.mockRestore();
    });
  });

  describe('placeBid', () => {
    const tickLower = -240;
    const liquidity = 9n;
    const salt = `0x${'88'.repeat(32)}` as Hash;

    it('uses modifyLiquidity when hookData is omitted', async () => {
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: liquidity,
        salt,
      };
      const modifySpy = vi
        .spyOn(manager, 'modifyLiquidity')
        .mockResolvedValue(mockTxHash);
      const hookSpy = vi.spyOn(manager, 'modifyLiquidityWithHookData');

      const result = await manager.placeBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
      });

      expect(result).toBe(mockTxHash);
      expect(modifySpy).toHaveBeenCalledWith(mockKey, params);
      expect(hookSpy).not.toHaveBeenCalled();
      modifySpy.mockRestore();
      hookSpy.mockRestore();
    });

    it('calls modifyLiquidityWithHookData when hookData is present', async () => {
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: liquidity,
        salt,
      };
      const modifySpy = vi.spyOn(manager, 'modifyLiquidityWithHookData');
      const fallbackSpy = vi.spyOn(manager, 'modifyLiquidity');
      modifySpy.mockResolvedValue(mockTxHash);

      const result = await manager.placeBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
        hookData: mockHookData,
      });

      expect(result).toBe(mockTxHash);
      expect(modifySpy).toHaveBeenCalledWith(mockKey, params, mockHookData);
      expect(fallbackSpy).not.toHaveBeenCalled();
      modifySpy.mockRestore();
      fallbackSpy.mockRestore();
    });
  });

  describe('simulateWithdrawBid', () => {
    const tickLower = 180;
    const liquidity = 55n;
    const salt = `0x${'99'.repeat(32)}` as Hash;

    it('negates liquidityDelta when forwarding to simulateModifyLiquidity', async () => {
      const account = '0x8888888888888888888888888888888888888888' as Address;
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: -liquidity,
        salt,
      };
      const spy = vi
        .spyOn(manager, 'simulateModifyLiquidity')
        .mockResolvedValue({ request: {}, delta: 0n, decoded: { amount0: 0n, amount1: 0n } });

      await manager.simulateWithdrawBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
        account,
      });

      expect(spy).toHaveBeenCalledWith(mockKey, params, account);
      spy.mockRestore();
    });

    it('uses simulateModifyLiquidityWithHookData when hookData is provided', async () => {
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: -liquidity,
        salt,
      };
      const spy = vi
        .spyOn(manager, 'simulateModifyLiquidityWithHookData')
        .mockResolvedValue({ request: {}, delta: 0n, decoded: { amount0: 0n, amount1: 0n } });

      await manager.simulateWithdrawBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
        hookData: mockHookData,
      });

      expect(spy).toHaveBeenCalledWith(
        mockKey,
        params,
        mockHookData,
        undefined,
      );
      spy.mockRestore();
    });
  });

  describe('withdrawBid', () => {
    const tickLower = -300;
    const liquidity = 33n;
    const salt = `0x${'aa'.repeat(32)}` as Hash;

    it('calls modifyLiquidity with negative liquidityDelta when no hookData', async () => {
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: -liquidity,
        salt,
      };
      const modifySpy = vi
        .spyOn(manager, 'modifyLiquidity')
        .mockResolvedValue(mockTxHash);
      const hookSpy = vi.spyOn(manager, 'modifyLiquidityWithHookData');

      const result = await manager.withdrawBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
      });

      expect(result).toBe(mockTxHash);
      expect(modifySpy).toHaveBeenCalledWith(mockKey, params);
      expect(hookSpy).not.toHaveBeenCalled();
      modifySpy.mockRestore();
      hookSpy.mockRestore();
    });

    it('prefers modifyLiquidityWithHookData when hookData exists', async () => {
      const params = {
        tickLower,
        tickUpper: tickLower + mockKey.tickSpacing,
        liquidityDelta: -liquidity,
        salt,
      };
      const modifySpy = vi.spyOn(manager, 'modifyLiquidityWithHookData');
      const fallbackSpy = vi.spyOn(manager, 'modifyLiquidity');
      modifySpy.mockResolvedValue(mockTxHash);

      const result = await manager.withdrawBid({
        key: mockKey,
        tickLower,
        liquidity,
        salt,
        hookData: mockHookData,
      });

      expect(result).toBe(mockTxHash);
      expect(modifySpy).toHaveBeenCalledWith(mockKey, params, mockHookData);
      expect(fallbackSpy).not.toHaveBeenCalled();
      modifySpy.mockRestore();
      fallbackSpy.mockRestore();
    });
  });

  describe('simulateWithdrawFullBid', () => {
    const openingAuctionHookAddress =
      '0x9999999999999999999999999999999999999999' as Address;

    it('resolves positionId + liquidity then simulates a full withdrawal', async () => {
      const tickLower = -120;
      const tickUpper = tickLower + mockKey.tickSpacing;
      const salt = `0x${'cc'.repeat(32)}` as Hash;
      const owner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address;

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(9n) // getPositionId
        .mockResolvedValueOnce([
          owner,
          tickLower,
          tickUpper,
          123n,
          0n,
          false,
        ] as any); // positions

      const request = {
        address: mockPositionManagerAddress,
        functionName: 'modifyLiquidity',
      };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
        result: 0n,
      } as any);

      const result = await manager.simulateWithdrawFullBid({
        openingAuctionHookAddress,
        key: mockKey,
        tickLower,
        salt,
        account: owner,
      });

      expect(result).toEqual({
        positionId: 9n,
        liquidity: 123n,
        simulation: {
          request,
          delta: 0n,
          decoded: { amount0: 0n, amount1: 0n },
        },
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: openingAuctionHookAddress,
        abi: expect.any(Array),
        functionName: 'getPositionId',
        args: [owner, tickLower, tickUpper, salt],
      });

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [
          mockKey,
          {
            tickLower,
            tickUpper,
            liquidityDelta: -123n,
            salt,
          },
        ],
        account: owner,
      });
    });

    it('throws when the position is not found', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(0n);

      await expect(
        manager.simulateWithdrawFullBid({
          openingAuctionHookAddress,
          key: mockKey,
          tickLower: -120,
          salt: `0x${'dd'.repeat(32)}` as Hash,
          account: walletClient.account,
        }),
      ).rejects.toThrow('Position not found for the given (owner,ticks,salt)');
    });
  });

  describe('withdrawFullBid', () => {
    const openingAuctionHookAddress =
      '0x9999999999999999999999999999999999999999' as Address;

    it('reads liquidity and executes a full withdrawal', async () => {
      const tickLower = 0;
      const tickUpper = tickLower + mockKey.tickSpacing;
      const salt = `0x${'ee'.repeat(32)}` as Hash;
      const owner = walletClient.account.address;

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(5n) // getPositionId
        .mockResolvedValueOnce([
          owner,
          tickLower,
          tickUpper,
          7n,
          0n,
          false,
        ] as any); // positions

      const request = {
        address: mockPositionManagerAddress,
        functionName: 'modifyLiquidity',
      };
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request,
        result: 0n,
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash);

      const result = await manager.withdrawFullBid({
        openingAuctionHookAddress,
        key: mockKey,
        tickLower,
        salt,
      });

      expect(result).toEqual({
        positionId: 5n,
        liquidity: 7n,
        transactionHash: mockTxHash,
      });

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: openingAuctionHookAddress,
        abi: expect.any(Array),
        functionName: 'getPositionId',
        args: [owner, tickLower, tickUpper, salt],
      });

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockPositionManagerAddress,
        abi: expect.any(Array),
        functionName: 'modifyLiquidity',
        args: [
          mockKey,
          {
            tickLower,
            tickUpper,
            liquidityDelta: -7n,
            salt,
          },
        ],
        account: walletClient.account,
      });
    });

    it('throws when wallet client is missing', async () => {
      const readOnlyManager = new OpeningAuctionPositionManager(
        publicClient,
        undefined,
        mockPositionManagerAddress,
      );

      await expect(
        readOnlyManager.withdrawFullBid({
          openingAuctionHookAddress,
          key: mockKey,
          tickLower: 0,
        }),
      ).rejects.toThrow('Wallet client required for write operations');
    });
  });
});
