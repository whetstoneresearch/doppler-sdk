import { CommandBuilder, V4ActionBuilder, V4ActionType } from 'doppler-router'
import {
  erc20Abi,
  parseEther,
  type Account,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem'
import type { ChainAddresses } from '@/addresses'
import type { DopplerSDK, MulticurvePoolState } from '@/index'

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
] as const

const ADDRESS_THIS = '0x0000000000000000000000000000000000000002'

export async function executeBuySwap({
  addresses,
  publicClient,
  sdk,
  walletClient,
  poolKey,
  account,
}: {
  readonly addresses: ChainAddresses
  readonly publicClient: PublicClient
  readonly sdk: DopplerSDK
  readonly walletClient: WalletClient
  readonly poolKey: MulticurvePoolState['poolKey']
  readonly account: Account
}): Promise<void> {
  const buyAmount = parseEther('0.01')
  const zeroForOne =
    poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()
  const quote = await sdk.quoter.quoteExactInputV4({
    poolKey,
    zeroForOne,
    exactAmount: buyAmount,
    hookData: '0x',
  })
  const actionBuilder = new V4ActionBuilder()
  actionBuilder.addSwapExactInSingle(
    poolKey,
    zeroForOne,
    buyAmount,
    (quote.amountOut * 95n) / 100n,
    '0x',
  )
  actionBuilder.addAction(V4ActionType.SETTLE, [
    zeroForOne ? poolKey.currency0 : poolKey.currency1,
    buyAmount,
    false,
  ])
  actionBuilder.addAction(V4ActionType.TAKE_ALL, [
    zeroForOne ? poolKey.currency1 : poolKey.currency0,
    0n,
  ])

  const [actions, actionParams] = actionBuilder.build()
  const commandBuilder = new CommandBuilder()
  commandBuilder.addWrapEth(ADDRESS_THIS, buyAmount)
  commandBuilder.addV4Swap(actions, actionParams)
  const [commands, inputs] = commandBuilder.build()

  const hash = await walletClient.writeContract({
    chain: walletClient.chain,
    address: addresses.universalRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs],
    account,
    value: buyAmount,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error('Multicurve buy swap failed')
  }
}

export async function readPoolTokenBalances({
  publicClient,
  token0,
  token1,
  beneficiary,
}: {
  readonly publicClient: PublicClient
  readonly token0: Address
  readonly token1: Address
  readonly beneficiary: Address
}): Promise<{
  readonly token0: bigint
  readonly token1: bigint
}> {
  const [balance0, balance1] = await Promise.all([
    publicClient.readContract({
      address: token0,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [beneficiary],
    }),
    publicClient.readContract({
      address: token1,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [beneficiary],
    }),
  ])

  return {
    token0: balance0,
    token1: balance1,
  }
}
