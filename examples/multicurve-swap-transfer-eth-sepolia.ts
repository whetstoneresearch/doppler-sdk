/**
 * Example: Swap + Transfer on Ethereum Sepolia
 *
 * Uses an already-launched multicurve token:
 * 1) Fetch pool key from onchain state
 * 2) Quote a WETH -> token buy via V4 Quoter
 * 3) Execute swap via Universal Router
 * 4) Optionally transfer purchased tokens
 */
import './env'

import { CHAIN_IDS, DopplerSDK, getAddresses } from '../src'
import { CommandBuilder, V4ActionBuilder, V4ActionType } from 'doppler-router'
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  parseEther,
  parseUnits,
  zeroAddress,
} from 'viem'
import type { Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const tokenAddressRaw = process.env.TOKEN_ADDRESS
const transferToRaw = process.env.TRANSFER_TO

const alchemyApiKey = process.env.ALCHEMY_API_KEY?.trim()
const alchemySepoliaRpc = alchemyApiKey
  ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`
  : undefined

const rpcUrl =
  process.env.ETH_SEPOLIA_RPC_URL ??
  process.env.RPC_URL ??
  alchemySepoliaRpc ??
  sepolia.rpcUrls.default.http[0]

const swapAmountEth = process.env.SWAP_AMOUNT_IN_ETH ?? '0.001'
const slippageBpsRaw = process.env.SWAP_SLIPPAGE_BPS ?? '500'
const transferAmountRaw = process.env.TRANSFER_AMOUNT_TOKENS ?? '1'
const shouldExecuteSwap = process.env.EXECUTE_SWAP !== 'false'
const shouldExecuteTransfer = process.env.EXECUTE_TRANSFER !== 'false'

if (!privateKey) throw new Error('PRIVATE_KEY is not set')
if (!tokenAddressRaw || !isAddress(tokenAddressRaw)) {
  throw new Error('TOKEN_ADDRESS must be set to a valid address')
}

const tokenAddress = tokenAddressRaw as Address
const transferTo = transferToRaw && isAddress(transferToRaw) ? (transferToRaw as Address) : undefined

const universalRouterAbi = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

const v4QuoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            internalType: 'struct PoolKey',
            components: [
              { name: 'currency0', type: 'address', internalType: 'address' },
              { name: 'currency1', type: 'address', internalType: 'address' },
              { name: 'fee', type: 'uint24', internalType: 'uint24' },
              { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
              { name: 'hooks', type: 'address', internalType: 'address' },
            ],
          },
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'exactAmount', type: 'uint128', internalType: 'uint128' },
          { name: 'hookData', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'gasEstimate', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

const erc20ReadWriteAbi = [
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

function errorContainsSelector(error: unknown, selector: string): boolean {
  const lowerSelector = selector.toLowerCase()
  const errorLike = error as
    | {
        shortMessage?: string
        message?: string
        raw?: string
        cause?: { raw?: string; shortMessage?: string; message?: string }
      }
    | undefined

  const haystack = [
    String(errorLike?.message ?? ''),
    String(errorLike?.shortMessage ?? ''),
    String(errorLike?.raw ?? ''),
    String(errorLike?.cause?.message ?? ''),
    String(errorLike?.cause?.shortMessage ?? ''),
    String(errorLike?.cause?.raw ?? ''),
    String(error),
  ]
    .join('\n')
    .toLowerCase()

  return haystack.includes(lowerSelector)
}

async function main() {
  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: sepolia, transport: http(rpcUrl), account })

  const connectedChainId = await publicClient.getChainId()
  if (connectedChainId !== sepolia.id) {
    throw new Error(
      `Connected to chain ${connectedChainId}, expected Ethereum Sepolia (${sepolia.id})`,
    )
  }

  const chainId = CHAIN_IDS.ETH_SEPOLIA
  const addresses = getAddresses(chainId)

  const routerOverride = process.env.ETH_SEPOLIA_UNIVERSAL_ROUTER
  if (routerOverride && !isAddress(routerOverride)) {
    throw new Error('ETH_SEPOLIA_UNIVERSAL_ROUTER must be a valid address')
  }

  const quoterOverride = process.env.ETH_SEPOLIA_V4_QUOTER
  if (quoterOverride && !isAddress(quoterOverride)) {
    throw new Error('ETH_SEPOLIA_V4_QUOTER must be a valid address')
  }

  const universalRouterAddress = (routerOverride as Address | undefined) ?? addresses.universalRouter
  const quoterAddress = (quoterOverride as Address | undefined) ?? addresses.uniswapV4Quoter

  if (universalRouterAddress === zeroAddress) {
    throw new Error(
      'Universal Router not configured for ETH Sepolia. Set ETH_SEPOLIA_UNIVERSAL_ROUTER in env.',
    )
  }

  if (quoterAddress === zeroAddress) {
    throw new Error('V4 quoter not configured for ETH Sepolia. Set ETH_SEPOLIA_V4_QUOTER in env.')
  }

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId })
  const multicurvePool = await sdk.getMulticurvePool(tokenAddress)
  const poolState = await multicurvePool.getState()

  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20ReadWriteAbi,
      functionName: 'decimals',
    }),
  ])

  const poolKey = {
    currency0: poolState.poolKey.currency0,
    currency1: poolState.poolKey.currency1,
    fee: poolState.poolKey.fee,
    tickSpacing: poolState.poolKey.tickSpacing,
    hooks: poolState.poolKey.hooks,
  }

  const amountIn = parseEther(swapAmountEth)
  const slippageBps = BigInt(slippageBpsRaw)
  if (slippageBps < 0n || slippageBps >= 10_000n) {
    throw new Error('SWAP_SLIPPAGE_BPS must be between 0 and 9999')
  }

  const currency0 = poolKey.currency0.toLowerCase()
  const currency1 = poolKey.currency1.toLowerCase()
  const weth = addresses.weth.toLowerCase()
  const token = tokenAddress.toLowerCase()

  if (currency0 !== weth && currency1 !== weth) {
    throw new Error(`Pool does not contain configured WETH (${addresses.weth})`)
  }

  if (currency0 !== token && currency1 !== token) {
    throw new Error(`Pool does not contain configured token (${tokenAddress})`)
  }

  // Quote a buy by default: WETH -> Token.
  const zeroForOne = currency0 === weth

  console.log('ETH Sepolia swap + transfer')
  console.log('RPC:', rpcUrl)
  console.log('Account:', account.address)
  console.log('Token:', tokenAddress)
  console.log('Router:', universalRouterAddress)
  console.log('Quoter:', quoterAddress)
  console.log('Swap direction:', 'WETH -> Token')
  console.log('Swap input:', swapAmountEth, 'ETH')

  let quoteResult: readonly [bigint, bigint]
  try {
    const { result } = await publicClient.simulateContract({
      address: quoterAddress,
      abi: v4QuoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          poolKey,
          zeroForOne,
          exactAmount: amountIn,
          hookData: '0x',
        },
      ],
    })
    quoteResult = result
  } catch (error) {
    // 0x6190b2b0 = UnexpectedRevertBytes(bytes)
    // 0x90bfb865 = WrappedError(address,bytes4,bytes,bytes)
    // 0x57653d29 = CannotSwapBeforeStartingTime()
    if (
      (errorContainsSelector(error, '0x6190b2b0') ||
        errorContainsSelector(error, '0x90bfb865')) &&
      (errorContainsSelector(error, '0x57653d29') ||
        errorContainsSelector(error, '57653d29') ||
        errorContainsSelector(error, 'CannotSwapBeforeStartingTime'))
    ) {
      const block = await publicClient.getBlock()
      const now = Number(block.timestamp)
      const nowIso = new Date(now * 1000).toISOString()
      throw new Error(
        `Quote blocked by hook (CannotSwapBeforeStartingTime). ` +
          `This scheduled pool is not live yet. hook=${poolKey.hooks}, chainTime=${now} (${nowIso})`,
      )
    }

    throw error
  }

  const amountOut = quoteResult[0]
  const gasEstimate = quoteResult[1]
  const minAmountOut = (amountOut * (10_000n - slippageBps)) / 10_000n

  console.log('Quote amountOut:', formatUnits(amountOut, decimals), symbol)
  console.log('Quote gas estimate:', gasEstimate.toString())

  const inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1
  const outputCurrency = zeroForOne ? poolKey.currency1 : poolKey.currency0

  const actionBuilder = new V4ActionBuilder()
  actionBuilder.addSwapExactInSingle(poolKey, zeroForOne, amountIn, minAmountOut, '0x')
  actionBuilder.addAction(V4ActionType.SETTLE, [
    inputCurrency,
    amountIn,
    false,
  ])
  actionBuilder.addAction(V4ActionType.TAKE_ALL, [outputCurrency, 0n])

  const [actions, actionParams] = actionBuilder.build()

  const commandBuilder = new CommandBuilder()
  const ADDRESS_THIS = '0x0000000000000000000000000000000000000002' as const
  commandBuilder.addWrapEth(ADDRESS_THIS, amountIn)
  commandBuilder.addV4Swap(actions, actionParams)
  const [commands, inputs] = commandBuilder.build()

  if (!shouldExecuteSwap) {
    console.log('Swap execution disabled via EXECUTE_SWAP=false (quote-only mode).')
    return
  }

  const swapHash = await walletClient.writeContract({
    address: universalRouterAddress,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs],
    value: amountIn,
  })

  console.log('Swap tx submitted:', swapHash)
  const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash })
  console.log('Swap status:', swapReceipt.status)
  console.log('Swap gas used:', swapReceipt.gasUsed.toString())

  const balanceAfterSwap = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20ReadWriteAbi,
    functionName: 'balanceOf',
    args: [account.address],
  })

  console.log('Token balance after swap:', formatUnits(balanceAfterSwap, decimals), symbol)

  if (!transferTo) {
    console.log('TRANSFER_TO not set, skipping transfer step.')
    return
  }

  if (!shouldExecuteTransfer) {
    console.log('Transfer execution disabled via EXECUTE_TRANSFER=false.')
    return
  }

  const transferAmount = parseUnits(transferAmountRaw, decimals)
  if (transferAmount <= 0n) {
    throw new Error('TRANSFER_AMOUNT_TOKENS must be greater than 0')
  }

  if (transferAmount > balanceAfterSwap) {
    throw new Error(
      `Transfer amount ${transferAmount.toString()} exceeds balance ${balanceAfterSwap.toString()}`,
    )
  }

  const { request: transferRequest } = await publicClient.simulateContract({
    address: tokenAddress,
    abi: erc20ReadWriteAbi,
    functionName: 'transfer',
    args: [transferTo, transferAmount],
    account,
  })

  const transferHash = await walletClient.writeContract(transferRequest)
  console.log('Transfer tx submitted:', transferHash)

  const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferHash })
  console.log('Transfer status:', transferReceipt.status)
  console.log('Transferred:', transferAmountRaw, symbol, 'to', transferTo)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
