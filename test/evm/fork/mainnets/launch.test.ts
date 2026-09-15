import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseEther,
  zeroAddress,
  type Address,
} from 'viem';
import {
  CHAIN_IDS,
  DAY_SECONDS,
  DopplerSDK,
  WAD,
  airlockAbi,
  dopplerHookAbi,
  getAddresses,
  normalizePoolKey,
  rehypeDopplerHookInitializerAbi,
  verifyPreparedCreateExecution,
  type BeneficiaryData,
  type V4PoolKey,
} from '../../../../src/evm';
import {
  getAnvilManager,
  getForkClients,
  getMainnetForkChains,
  isAnvilForkEnabled,
  mineToTimestamp,
  type ForkClients,
} from '../../utils';
import { executeV4Swap, readPoolTokenBalances } from '../utils';

for (const [chainName, chainId] of getMainnetForkChains()) {
  describe(`${chainName} deployed launch workflows`, () => {
    if (!isAnvilForkEnabled()) {
      it.skip(
        'requires ANVIL_FORK_ENABLED=true (transactions run only on local Anvil)',
      );
      return;
    }

    const addresses = getAddresses(chainId);
    // Arc's native USDC is an 18-decimal V4 currency, not its ERC20 interface.
    const numeraire = chainId === CHAIN_IDS.ARC ? zeroAddress : addresses.weth;
    const numerairePrice = chainId === CHAIN_IDS.ARC ? 1 : 3500;
    const anvilManager = getAnvilManager();
    let clients: ForkClients;
    let trader: ForkClients;
    let sdk: DopplerSDK;

    beforeAll(async () => {
      // Missing RPCs and unwhitelisted deployments must fail, never silently skip.
      await anvilManager.start(chainId);
      clients = getForkClients(chainId, 0, { timeout: 90_000 });
      trader = getForkClients(chainId, 1, { timeout: 90_000 });
      sdk = new DopplerSDK({
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        chainId,
      });
    }, 90_000);

    afterAll(async () => {
      await anvilManager.stop(chainId);
    });

    async function buyAndSell(tokenAddress: Address, poolKey: V4PoolKey) {
      // A separate trader must receive tokens without creator exclusions or fee payouts.
      const swap = {
        addresses,
        publicClient: trader.publicClient,
        walletClient: trader.walletClient,
        account: trader.account,
        sdk,
        poolKey,
        // Robinhood's deployed router requires the newer price-limit tuple.
        minHopPriceX36: chainId === CHAIN_IDS.ROBINHOOD ? 0n : undefined,
      };
      const balances = () =>
        readPoolTokenBalances({
          publicClient: trader.publicClient,
          token0: poolKey.currency0,
          token1: poolKey.currency1,
          beneficiary: trader.account.address,
        });
      const assetIndex =
        getAddress(poolKey.currency0) === getAddress(tokenAddress)
          ? 'token0'
          : 'token1';
      const numeraireIndex = assetIndex === 'token0' ? 'token1' : 'token0';
      const amountIn = parseEther('0.01');
      const beforeBuy = await balances();
      const buy = await executeV4Swap({
        ...swap,
        tokenIn: numeraire,
        amountIn,
      });
      expect(buy.receipt.status).toBe('success');
      const afterBuy = await balances();
      const bought = afterBuy[assetIndex] - beforeBuy[assetIndex];
      expect(bought).toBeGreaterThan(1n);
      if (numeraire === zeroAddress) {
        expect(beforeBuy[numeraireIndex] - afterBuy[numeraireIndex]).toBe(
          amountIn + buy.gasCost,
        );
      }

      const sold = bought / 2n;
      const sell = await executeV4Swap({
        ...swap,
        tokenIn: tokenAddress,
        amountIn: sold,
      });
      expect(sell.receipt.status).toBe('success');
      const afterSell = await balances();
      expect(afterBuy[assetIndex] - afterSell[assetIndex]).toBe(sold);
      expect(afterSell[assetIndex]).toBeGreaterThan(beforeBuy[assetIndex]);
      // Native proceeds must exclude the trader's approval and swap gas costs.
      const proceeds =
        afterSell[numeraireIndex] -
        afterBuy[numeraireIndex] +
        (numeraire === zeroAddress ? sell.gasCost : 0n);
      expect(proceeds).toBeGreaterThan(0n);
      expect(proceeds).toBeLessThan(amountIn);
    }

    async function launchMulticurve(
      params: Parameters<typeof sdk.factory.prepareCreateMulticurve>[0],
    ) {
      const prepared = await sdk.factory.prepareCreateMulticurve(params, {
        account: clients.account.address,
      });
      const hash = await clients.walletClient.sendTransaction({
        account: clients.account,
        chain: clients.chain,
        ...prepared.transaction,
        ...(prepared.gasEstimate.status === 'estimated'
          ? { gas: prepared.gasEstimate.gas }
          : {}),
      });
      const receipt = await clients.publicClient.waitForTransactionReceipt({
        hash,
      });
      expect(receipt.status).toBe('success');
      const verified = await verifyPreparedCreateExecution({
        prepared,
        receipt,
        publicClient: clients.publicClient,
      });
      expect(verified.receiptIdentity.tokenAddress).toBe(
        prepared.prediction.tokenAddress,
      );
      expect(verified.receiptIdentity.poolOrHookAddress).toBe(
        prepared.prediction.poolOrHookAddress,
      );
      const tokenAddress = verified.receiptIdentity.tokenAddress;
      const pool = await sdk.getMulticurvePool(tokenAddress);
      const state = await pool.getState();
      expect(getAddress(state.numeraire)).toBe(getAddress(numeraire));
      expect(state.poolKey.fee).toBe(verified.preparedIdentity.poolKey.fee);
      expect(state.poolKey.tickSpacing).toBe(
        verified.preparedIdentity.poolKey.tickSpacing,
      );
      for (const field of ['currency0', 'currency1', 'hooks'] as const) {
        expect(getAddress(state.poolKey[field])).toBe(
          getAddress(verified.preparedIdentity.poolKey[field]),
        );
      }
      expect(
        await clients.publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'totalSupply',
        }),
      ).toBe(params.sale.initialSupply);
      return verified;
    }

    it('creates a dynamic auction, verifies its state, then buys and sells', async () => {
      const blockTimestamp = Number(
        (await clients.publicClient.getBlock()).timestamp,
      );
      const params = sdk
        .buildDynamicAuction()
        .tokenConfig({
          type: 'dopplerERC20V1',
          name: 'Shared Dynamic Fork',
          symbol: 'SDF',
          tokenURI: 'ipfs://shared-dynamic-fork',
        })
        .saleConfig({
          initialSupply: 1_000_000n * WAD,
          numTokensToSell: 900_000n * WAD,
          numeraire,
        })
        .withMarketCapRange({
          marketCap:
            chainId === CHAIN_IDS.ARC
              ? { start: 8_000_000, min: 2_000_000 }
              : { start: 500_000, min: 50_000 },
          numerairePrice,
          numeraireDecimals: 18,
          minProceeds: parseEther('0.01'),
          maxProceeds: parseEther('1000'),
          duration: 3600,
          epochLength: 60,
          fee: 3000,
          tickSpacing: 10,
        })
        .withGovernance({ type: 'default' })
        .withMigration(
          chainId === CHAIN_IDS.ARC
            ? {
                type: 'dopplerHookMigrator',
                fee: 3000,
                tickSpacing: 10,
                lockDuration: 0,
                beneficiaries: [await sdk.getAirlockBeneficiary(WAD)],
              }
            : {
                type: 'uniswapV2Split',
                proceedsSplit: {
                  recipient: clients.account.address,
                  share: WAD / 10n,
                },
              },
        )
        .withUserAddress(clients.account.address)
        .withTime({ blockTimestamp, startTimeOffset: 300 })
        .build();
      const simulation = await sdk.factory.simulateCreateDynamicAuction(params);
      const hash = await clients.walletClient.sendTransaction({
        to: addresses.airlock,
        data: encodeFunctionData({
          abi: airlockAbi,
          functionName: 'create',
          args: [{ ...simulation.createParams }],
        }),
        account: clients.account,
        chain: clients.chain,
      });
      const receipt = await clients.publicClient.waitForTransactionReceipt({
        hash,
      });
      expect(receipt.status).toBe('success');
      const assetData = await sdk.getAirlockAssetData(simulation.tokenAddress);
      expect(getAddress(assetData.poolOrHook)).toBe(
        getAddress(simulation.hookAddress),
      );
      const auction = await sdk.getDynamicAuction(assetData.poolOrHook);
      const info = await auction.getHookInfo();
      expect(getAddress(info.tokenAddress)).toBe(
        getAddress(simulation.tokenAddress),
      );
      expect(getAddress(info.numeraireAddress)).toBe(getAddress(numeraire));
      expect(info.poolId).toBe(simulation.poolId);
      expect(info.startingTime).toBe(BigInt(blockTimestamp + 300));
      expect(info.endingTime - info.startingTime).toBe(3600n);
      expect(info.minimumProceeds).toBe(parseEther('0.01'));
      expect(info.totalProceeds).toBe(0n);
      expect(info.totalTokensSold).toBe(0n);
      expect(
        await clients.publicClient.readContract({
          address: simulation.tokenAddress,
          abi: erc20Abi,
          functionName: 'totalSupply',
        }),
      ).toBe(1_000_000n * WAD);
      const poolKey = normalizePoolKey(
        await clients.publicClient.readContract({
          address: simulation.hookAddress,
          abi: dopplerHookAbi,
          functionName: 'poolKey',
        }),
      );
      await mineToTimestamp(clients.testClient, info.startingTime + 1n);
      await buyAndSell(simulation.tokenAddress, poolKey);
    }, 180_000);

    it('launches Rehype with vesting and integrator routing, then buys and sells', async () => {
      const rehypeHook = addresses.rehypeDopplerHookInitializer;
      if (!rehypeHook || rehypeHook === zeroAddress) {
        throw new Error(`${chainName} Rehype initializer is required`);
      }
      const poolFeeBeneficiaries = [await sdk.getAirlockBeneficiary(WAD)];
      const rehypeFeeBeneficiaries: [BeneficiaryData, ...BeneficiaryData[]] = [
        { beneficiary: clients.account.address, shares: WAD / 5n },
        {
          beneficiary: getAddress('0x0000000000000000000000000000000000000001'),
          shares: (WAD * 3n) / 10n,
        },
        {
          beneficiary: getAddress('0x0000000000000000000000000000000000000002'),
          shares: WAD / 2n,
        },
      ];
      const allocations = [
        { amount: parseEther('40000'), duration: 180, cliff: 30 },
        { amount: parseEther('20000'), duration: 365, cliff: 90 },
        { amount: parseEther('15000'), duration: 730, cliff: 180 },
      ];
      const params = sdk
        .buildMulticurveAuction()
        .tokenConfig({
          type: 'dopplerERC20V1',
          name: 'Shared Rehype Fork',
          symbol: 'SRF',
          tokenURI: 'ipfs://shared-rehype-fork',
          maxBalanceLimit: parseEther('25000'),
          balanceLimitEnd:
            Number((await clients.publicClient.getBlock()).timestamp) +
            DAY_SECONDS,
          controller: clients.account.address,
          excludedFromBalanceLimit: [clients.account.address],
        })
        .saleConfig({
          initialSupply: 1_000_000n * WAD,
          numTokensToSell: 900_000n * WAD,
          numeraire,
        })
        .withCurves({
          numerairePrice,
          numeraireDecimals: 18,
          fee: 0,
          tickSpacing: 8,
          beneficiaries: poolFeeBeneficiaries,
          curves: [
            {
              marketCap: { start: 500_000, end: 2_000_000 },
              numPositions: 8,
              shares: parseEther('0.4'),
            },
            {
              marketCap: { start: 2_000_000, end: 8_000_000 },
              numPositions: 12,
              shares: parseEther('0.35'),
            },
            {
              marketCap: { start: 8_000_000, end: 'max' },
              numPositions: 16,
              shares: parseEther('0.25'),
            },
          ],
        })
        .withVesting({
          allocations: allocations.map(({ amount, duration, cliff }) => ({
            recipient: clients.account.address,
            amount,
            schedule: {
              duration: BigInt(duration * DAY_SECONDS),
              cliffDuration: cliff * DAY_SECONDS,
            },
          })),
        })
        .withRehypeDopplerHookInitializer({
          hookAddress: rehypeHook,
          feeBeneficiaries: rehypeFeeBeneficiaries,
          startFee: 12_000,
          endFee: 12_000,
          durationSeconds: 0,
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: 0n,
            assetFeesToNumeraireBuybackWad: WAD,
            assetFeesToBeneficiaryWad: 0n,
            assetFeesToLpWad: 0n,
            numeraireFeesToAssetBuybackWad: 0n,
            numeraireFeesToNumeraireBuybackWad: 0n,
            numeraireFeesToBeneficiaryWad: WAD,
            numeraireFeesToLpWad: 0n,
          },
          integratorFeeConfig: {
            integrator: clients.account.address,
            feeShare: 200_000,
            assetFeesToNumeraireRatio: 500_000_000,
            numeraireFeesToAssetRatio: 250_000_000,
            automaticPayout: false,
          },
        })
        .withFeeDistributionController(clients.account.address)
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'noOp' })
        .withUserAddress(clients.account.address)
        .withSalt(`0x${'42'.repeat(32)}`)
        .build();
      const verified = await launchMulticurve(params);
      const token = sdk.getDopplerERC20V1(
        verified.receiptIdentity.tokenAddress,
      );
      expect(await token.getMaxBalanceLimit()).toBe(parseEther('25000'));
      expect(await token.getVestingScheduleCount()).toBe(3n);
      expect(await token.getTotalAllocatedOf(clients.account.address)).toBe(
        parseEther('75000'),
      );
      for (const [index, allocation] of allocations.entries()) {
        expect(await token.getVestingSchedule(BigInt(index))).toEqual({
          duration: BigInt(allocation.duration * DAY_SECONDS),
          cliffDuration: BigInt(allocation.cliff * DAY_SECONDS),
        });
        expect(
          await token.getVestingDataForSchedule(
            clients.account.address,
            BigInt(index),
          ),
        ).toEqual({
          totalAmount: allocation.amount,
          releasedAmount: 0n,
        });
      }
      const [routing, feeShare] = await Promise.all([
        clients.publicClient.readContract({
          address: rehypeHook,
          abi: rehypeDopplerHookInitializerAbi,
          functionName: 'getIntegratorRoutingConfig',
          args: [verified.preparedIdentity.poolId],
        }),
        clients.publicClient.readContract({
          address: rehypeHook,
          abi: rehypeDopplerHookInitializerAbi,
          functionName: 'getIntegratorFeeShare',
          args: [verified.preparedIdentity.poolId],
        }),
      ]);
      expect(getAddress(routing[0])).toBe(getAddress(clients.account.address));
      expect(routing.slice(1)).toEqual([500_000_000, 250_000_000, false]);
      expect(feeShare).toBe(200_000);
      if (chainId === CHAIN_IDS.ARC) {
        const rehype = await sdk.getRehypeDopplerHookInitializer(rehypeHook);
        expect(
          await rehype.getPendingFees(
            verified.preparedIdentity.poolId,
            clients.account.address,
          ),
        ).toEqual({ fees0: 0n, fees1: 0n });
      }
      await buyAndSell(
        verified.receiptIdentity.tokenAddress,
        verified.preparedIdentity.poolKey,
      );
    }, 180_000);

    describe('NoOp multicurve launch ranges', () => {
      it.each(['positive', 'negative', 'presets'] as const)(
        'creates a %s range pool, then buys and sells',
        async (range) => {
          const beneficiaries = [await sdk.getAirlockBeneficiary(WAD)];
          const builder = sdk
            .buildMulticurveAuction()
            .tokenConfig({
              type: 'dopplerERC20V1',
              name: `Shared ${range} Fork`,
              symbol: 'SMF',
              tokenURI: 'ipfs://shared-multicurve-fork',
            })
            .saleConfig({
              initialSupply: 1_000_000_000n * WAD,
              numTokensToSell: 900_000_000n * WAD,
              numeraire,
            });
          if (range === 'presets') {
            builder.withMarketCapPresets({
              fee: 0,
              tickSpacing: 100,
              beneficiaries,
            });
          } else {
            builder.poolConfig({
              fee: 0,
              tickSpacing: 100,
              curves: [
                {
                  tickLower: range === 'positive' ? 188000 : -202000,
                  tickUpper: range === 'positive' ? 202000 : -188000,
                  numPositions: 11,
                  shares: WAD,
                },
              ],
              beneficiaries,
            });
          }
          const saltByte =
            range === 'positive' ? '44' : range === 'negative' ? '45' : '46';
          const verified = await launchMulticurve(
            builder
              .withGovernance({ type: 'noOp' })
              .withMigration({ type: 'noOp' })
              .withUserAddress(clients.account.address)
              .withSalt(`0x${saltByte.repeat(32)}`)
              .build(),
          );
          await buyAndSell(
            verified.receiptIdentity.tokenAddress,
            verified.preparedIdentity.poolKey,
          );
        },
        180_000,
      );
    });

    it.skipIf(
      !addresses.v4ScheduledMulticurveInitializer ||
        addresses.v4ScheduledMulticurveInitializer === zeroAddress,
    )(
      'creates a scheduled multicurve pool, then buys and sells after opening (where deployed)',
      async () => {
        const startTime =
          Number((await clients.publicClient.getBlock()).timestamp) + 3600;
        const params = sdk
          .buildMulticurveAuction()
          .tokenConfig({
            type: 'dopplerERC20V1',
            name: 'Shared Scheduled Fork',
            symbol: 'SSF',
            tokenURI: 'ipfs://shared-scheduled-fork',
          })
          .saleConfig({
            initialSupply: 1_000_000n * WAD,
            numTokensToSell: 1_000_000n * WAD,
            numeraire,
          })
          .poolConfig({
            fee: 0,
            tickSpacing: 8,
            curves: Array.from({ length: 10 }, (_, i) => ({
              tickLower: i * 16_000,
              tickUpper: 240_000,
              numPositions: 10,
              shares: WAD / 10n,
            })),
          })
          .withSchedule({ startTime })
          .withGovernance({ type: 'default' })
          .withMigration({ type: 'uniswapV2' })
          .withUserAddress(clients.account.address)
          .withSalt(`0x${'43'.repeat(32)}`)
          .build();
        const verified = await launchMulticurve(params);
        const assetData = await sdk.getAirlockAssetData(
          verified.receiptIdentity.tokenAddress,
        );
        expect(getAddress(assetData.poolInitializer)).toBe(
          getAddress(addresses.v4ScheduledMulticurveInitializer!),
        );
        await mineToTimestamp(clients.testClient, BigInt(startTime) + 1n);
        await buyAndSell(
          verified.receiptIdentity.tokenAddress,
          verified.preparedIdentity.poolKey,
        );
      },
      180_000,
    );

    if (chainId === CHAIN_IDS.BASE) {
      // Keep the historical decoding regression: these predate the shared launch fixtures.
      it.each([
        '0x87b2050fae7306d4144031c417e11e937bbaf48e',
        '0x5cdeb399d27a2bfa31df1348fb2c11d4b54eda3d',
      ] as const)(
        'decodes historical Base hook state for %s',
        async (tokenAddress) => {
          const { poolOrHook } = await sdk.getAirlockAssetData(tokenAddress);
          const auction = await sdk.getDynamicAuction(poolOrHook);
          const info = await auction.getHookInfo();
          expect(info.totalProceeds).toBeTypeOf('bigint');
          expect(info.totalTokensSold).toBeTypeOf('bigint');
          expect(getAddress(info.tokenAddress)).toBe(getAddress(tokenAddress));
        },
        90_000,
      );
    }
  });
}
