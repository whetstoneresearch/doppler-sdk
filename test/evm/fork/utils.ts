import { CommandBuilder, V4ActionBuilder, V4ActionType } from 'doppler-router';
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbi,
  parseAbiParameters,
  toHex,
  zeroAddress,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import type { ChainAddresses } from '@/addresses';
import type { DopplerSDK, MulticurvePoolState } from '@/index';

const universalRouterAbi = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

const swapWithPriceLimitAbi = parseAbiParameters(
  '((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, uint256 minHopPriceX36, bytes hookData)',
);

const ADDRESS_THIS = '0x0000000000000000000000000000000000000002';

export async function executeV4Swap({
  addresses,
  publicClient,
  sdk,
  walletClient,
  poolKey,
  account,
  tokenIn,
  amountIn,
  minHopPriceX36,
}: {
  readonly addresses: ChainAddresses;
  readonly publicClient: PublicClient;
  readonly sdk: DopplerSDK;
  readonly walletClient: WalletClient;
  readonly poolKey: MulticurvePoolState['poolKey'];
  readonly account: Account;
  readonly tokenIn: Address;
  readonly amountIn: bigint;
  readonly minHopPriceX36?: bigint;
}) {
  const zeroForOne = getAddress(poolKey.currency0) === getAddress(tokenIn);
  if (!zeroForOne && getAddress(poolKey.currency1) !== getAddress(tokenIn)) {
    throw new Error('Swap input must be a pool currency');
  }
  const nativeFunded =
    tokenIn === zeroAddress ||
    getAddress(tokenIn) === getAddress(addresses.weth);
  let gasCost = 0n;
  async function transact(to: Address, data: Hex, value = 0n) {
    const hash = await walletClient.sendTransaction({
      chain: walletClient.chain,
      account,
      to,
      data,
      value,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`Swap transaction failed: ${hash}`);
    }
    gasCost += receipt.gasUsed * receipt.effectiveGasPrice;
    return receipt;
  }

  if (!nativeFunded) {
    const allowance = await publicClient.readContract({
      address: tokenIn,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, addresses.permit2],
    });
    if (allowance < amountIn) {
      await transact(
        tokenIn,
        encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [addresses.permit2, amountIn],
        }),
      );
    }
    await transact(
      addresses.permit2,
      encodeFunctionData({
        abi: parseAbi([
          'function approve(address token, address spender, uint160 amount, uint48 expiration)',
        ]),
        functionName: 'approve',
        args: [
          tokenIn,
          addresses.universalRouter,
          amountIn,
          Number((await publicClient.getBlock()).timestamp) + 3600,
        ],
      }),
    );
  }

  const quote = await sdk.quoter.quoteExactInputV4({
    poolKey,
    zeroForOne,
    exactAmount: amountIn,
    hookData: '0x',
  });
  const minAmountOut = (quote.amountOut * 95n) / 100n;
  if (minAmountOut <= 0n) {
    throw new Error('Swap must have a positive minimum output');
  }
  const actionBuilder = new V4ActionBuilder();
  if (minHopPriceX36 === undefined) {
    actionBuilder.addSwapExactInSingle(
      poolKey,
      zeroForOne,
      amountIn,
      minAmountOut,
      '0x',
    );
  }
  actionBuilder.addAction(V4ActionType.SETTLE, [
    tokenIn,
    amountIn,
    !nativeFunded,
  ]);
  actionBuilder.addAction(V4ActionType.TAKE_ALL, [
    zeroForOne ? poolKey.currency1 : poolKey.currency0,
    minAmountOut,
  ]);

  const commandBuilder = new CommandBuilder();
  if (nativeFunded && tokenIn !== zeroAddress) {
    commandBuilder.addWrapEth(ADDRESS_THIS, amountIn);
  }
  let [actions, actionParams] = actionBuilder.build();
  if (minHopPriceX36 !== undefined) {
    // Newer routers add a price-limit field not supported by doppler-router.
    actions = concatHex([
      toHex(V4ActionType.SWAP_EXACT_IN_SINGLE, { size: 1 }),
      actions,
    ]);
    actionParams.unshift(
      encodeAbiParameters(swapWithPriceLimitAbi, [
        {
          poolKey,
          zeroForOne,
          amountIn,
          amountOutMinimum: minAmountOut,
          minHopPriceX36,
          hookData: '0x',
        },
      ]),
    );
  }
  commandBuilder.addV4Swap(actions, actionParams);
  const receipt = await transact(
    addresses.universalRouter,
    encodeFunctionData({
      abi: universalRouterAbi,
      functionName: 'execute',
      args: commandBuilder.build(),
    }),
    nativeFunded ? amountIn : 0n,
  );
  return { receipt, gasCost };
}

export async function readPoolTokenBalances({
  publicClient,
  token0,
  token1,
  beneficiary,
}: {
  readonly publicClient: PublicClient;
  readonly token0: Address;
  readonly token1: Address;
  readonly beneficiary: Address;
}): Promise<{
  readonly token0: bigint;
  readonly token1: bigint;
}> {
  const [balance0, balance1] = await Promise.all([
    token0 === zeroAddress
      ? publicClient.getBalance({ address: beneficiary })
      : publicClient.readContract({
          address: token0,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [beneficiary],
        }),
    token1 === zeroAddress
      ? publicClient.getBalance({ address: beneficiary })
      : publicClient.readContract({
          address: token1,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [beneficiary],
        }),
  ]);

  return {
    token0: balance0,
    token1: balance1,
  };
}
