/**
 * Example: Integrator Flow Debug (V4 currency0 -> currency1)
 *
 * Implements guaranteed-output flow for currency0 -> currency1:
 * 1) Quote exact-output on V4 for currency0 -> currency1
 * 2) Add slippage buffer to currency0 input requirement
 * 3) Quote exact-output on V3 for WETH -> currency0
 * 4) Add slippage buffer to WETH input requirement
 * 5) Build Universal Router commands:
 *    - WRAP_ETH
 *    - V3 exact-out (WETH -> currency0)
 *    - V4 exact-out (currency0 -> currency1)
 *    - SWEEP leftovers to caller
 * 6) Simulate Universal Router execute() with both 2-arg and 3-arg overloads.
 *
 * Chain: Base Sepolia
 */
import './env'

import { DopplerSDK, getAddresses, type V4PoolKey } from '../src'
import { CommandBuilder, V4ActionBuilder, V4ActionType } from 'doppler-router'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]
const executeSwap = process.env.EXECUTE_SWAP === 'true'

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

const ARTCOIN_AMOUNT_OUT = parseEther(process.env.ARTCOIN_AMOUNT_OUT ?? '1')
const V3_POOL_FEE = 10_000
const SLIPPAGE_PERCENT = 4n

const ZERO_FOR_ONE = true // currency0 -> currency1
const HOOK_DATA = '0x' as const

const DEBUG_POOL_KEY: V4PoolKey = {
  currency0: '0xd89fdcB6c8D107f27CEe4452Ccfb70Dc4F9768a7',
  currency1: '0xf2CA79f61e29950b2f869466FCD27b3459D4C6a7',
  fee: 8_388_608,
  tickSpacing: 100,
  hooks: '0x98CD6478DeBe443069dB863Abb9626d94de9A544',
}

// Include both execute overloads to mirror integrator/client differences.
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
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

// Universal Router V3 exact-out path is encoded in reverse order:
// tokenOut -> fee -> tokenIn.
function encodeUniswapPathV3ExactOut(
  tokenOut: `0x${string}`,
  fee: number,
  tokenIn: `0x${string}`,
): Hex {
  return encodePacked(
    ['address', 'uint24', 'address'],
    [tokenOut, fee, tokenIn],
  )
}

function addPercentSlippage(amount: bigint, percent: bigint): bigint {
  return amount + (amount * percent) / 100n
}

function extractRevertData(error: unknown): Hex | undefined {
  const err = error as {
    data?: Hex
    cause?: { data?: Hex; cause?: { data?: Hex } }
    details?: string
    shortMessage?: string
    message?: string
  }
  return err?.cause?.data ?? err?.data ?? err?.cause?.cause?.data
}

function extractErrorMessage(error: unknown): string {
  const err = error as {
    details?: string
    shortMessage?: string
    message?: string
  }
  return err?.shortMessage ?? err?.details ?? err?.message ?? String(error)
}

function decodeKnownRevert(revertData: Hex): void {
  // Universal Router custom error:
  // V4TooLittleReceived(uint256 minAmountOutReceived, uint256 amountReceived)
  if (revertData.startsWith('0x8b063d73') && revertData.length >= 10 + 64 * 2) {
    const minOut = BigInt(`0x${revertData.slice(10, 74)}`)
    const receivedOut = BigInt(`0x${revertData.slice(74, 138)}`)
    console.log(
      '  decoded revert: V4TooLittleReceived(uint256 minOut, uint256 receivedOut)'
    )
    console.log('  decoded minOut:', minOut.toString(), `(${formatEther(minOut)})`)
    console.log(
      '  decoded receivedOut:',
      receivedOut.toString(),
      `(${formatEther(receivedOut)})`,
    )
    return
  }

  // Universal Router custom error:
  // CurrencyNotSettled()
  if (revertData === '0x5212cba1') {
    console.log('  decoded revert: CurrencyNotSettled()')
    return
  }

  // Permit2 custom error:
  // AllowanceExpired(uint256 deadline)
  if (revertData.startsWith('0xd81b2f2e') && revertData.length >= 10 + 64) {
    const deadline = BigInt(`0x${revertData.slice(10, 74)}`)
    console.log('  decoded revert: AllowanceExpired(uint256 deadline)')
    console.log('  decoded deadline:', deadline.toString())
    return
  }
}

async function main() {
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  })
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account,
  })

  const chainId = await publicClient.getChainId()
  if (chainId !== baseSepolia.id) {
    throw new Error(
      `Connected to chain ${chainId}, expected Base Sepolia (${baseSepolia.id})`
    )
  }

  const dopplerSdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  })

  const addresses = getAddresses(baseSepolia.id)

  console.log('Integrator V4 Debug (currency0 -> currency1)')
  console.log('RPC:', rpcUrl)
  console.log('Caller:', account.address)
  console.log('Universal Router:', addresses.universalRouter)
  console.log('WETH:', addresses.weth)
  console.log('Pool key:', DEBUG_POOL_KEY)
  console.log('Direction zeroForOne:', ZERO_FOR_ONE)
  console.log('Desired currency1 out:', formatEther(ARTCOIN_AMOUNT_OUT))
  console.log('Execute swap:', executeSwap)
  console.log()

  // Step 1: V4 exact-output quote for currency0 -> currency1.
  const v4OutputQuote = await dopplerSdk.quoter.quoteExactOutputV4Quoter({
    poolKey: DEBUG_POOL_KEY,
    zeroForOne: ZERO_FOR_ONE,
    exactAmount: ARTCOIN_AMOUNT_OUT,
    hookData: HOOK_DATA,
  })

  const currency0InQuoted = v4OutputQuote.amountIn
  const currency0InMaximum = addPercentSlippage(
    currency0InQuoted,
    SLIPPAGE_PERCENT,
  )

  console.log('V4 exact-output quote:')
  console.log('  currency0 in (quoted):', currency0InQuoted.toString())
  console.log(
    '  currency0 in (maximum):',
    currency0InMaximum.toString(),
    `(${SLIPPAGE_PERCENT}%)`,
  )
  console.log('  gasEstimate:', v4OutputQuote.gasEstimate.toString())
  console.log()

  // Step 2: V3 exact-output quote WETH -> currency0.
  const v3OutputQuote = await dopplerSdk.quoter.quoteExactOutputV3({
    tokenIn: addresses.weth,
    tokenOut: DEBUG_POOL_KEY.currency0,
    amountOut: currency0InMaximum,
    fee: V3_POOL_FEE,
    sqrtPriceLimitX96: 0n,
  })

  const wethAmountInQuoted = v3OutputQuote.amountIn
  const wethAmountInMaximum = addPercentSlippage(
    wethAmountInQuoted,
    SLIPPAGE_PERCENT,
  )

  console.log('V3 exact-output quote (WETH -> currency0):')
  console.log('  weth in (quoted):', wethAmountInQuoted.toString())
  console.log(
    '  weth in (maximum):',
    wethAmountInMaximum.toString(),
    `(${SLIPPAGE_PERCENT}%)`,
  )
  console.log('  gasEstimate:', v3OutputQuote.gasEstimate.toString())
  console.log()

  // Step 3: Build exact-output action payload.
  const inputCurrency = ZERO_FOR_ONE
    ? DEBUG_POOL_KEY.currency0
    : DEBUG_POOL_KEY.currency1
  const outputCurrency = ZERO_FOR_ONE
    ? DEBUG_POOL_KEY.currency1
    : DEBUG_POOL_KEY.currency0

  const v4ActionBuilder = new V4ActionBuilder()
    .addSwapExactOutSingle(
      DEBUG_POOL_KEY,
      ZERO_FOR_ONE,
      ARTCOIN_AMOUNT_OUT,
      currency0InMaximum,
      HOOK_DATA,
    )
    // Settle from Universal Router balance (not user/Permit2).
    .addAction(V4ActionType.SETTLE, [inputCurrency, currency0InMaximum, false])
    .addAction(V4ActionType.TAKE_ALL, [inputCurrency, 0n])
    .addAction(V4ActionType.TAKE_ALL, [outputCurrency, 0n])

  const [v4Actions, v4Params] = v4ActionBuilder.build()

  const commandBuilder = new CommandBuilder()
    .addWrapEth(addresses.universalRouter, wethAmountInMaximum)
    .addV3SwapExactOut(
      addresses.universalRouter,
      currency0InMaximum,
      wethAmountInMaximum,
      encodeUniswapPathV3ExactOut(
        DEBUG_POOL_KEY.currency0,
        V3_POOL_FEE,
        addresses.weth,
      ),
      false,
    )
    .addV4Swap(v4Actions, v4Params)
    .addSweep(DEBUG_POOL_KEY.currency0, account.address, 0n)
    .addSweep(DEBUG_POOL_KEY.currency1, account.address, 0n)
    .addSweep(addresses.weth, account.address, 0n)

  const [commands, inputs] = commandBuilder.build()

  console.log('Universal Router payload:')
  console.log('  commands:', commands)
  console.log('  inputs count:', inputs.length)
  console.log('  value (wei):', wethAmountInMaximum.toString())
  console.log()

  // Simulate 2-arg execute() path (same as integrator calldata shape).
  const execute2ArgData = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs],
  })

  try {
    const result2Arg = await publicClient.call({
      to: addresses.universalRouter,
      account: account.address,
      data: execute2ArgData,
      value: wethAmountInMaximum,
    })
    console.log('2-arg execute() simulation: SUCCESS')
    console.log('  return data:', result2Arg.data)
  } catch (error) {
    console.log('2-arg execute() simulation: REVERT')
    console.log('  message:', extractErrorMessage(error))
    const revertData = extractRevertData(error)
    if (revertData) {
      console.log('  revert data:', revertData)
      decodeKnownRevert(revertData)
    } else {
      console.log('  error object:', error)
    }
  }

  console.log()

  // Simulate 3-arg execute() path for comparison.
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60)
  const execute3ArgData = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs, deadline],
  })

  try {
    const result3Arg = await publicClient.call({
      to: addresses.universalRouter,
      account: account.address,
      data: execute3ArgData,
      value: wethAmountInMaximum,
    })
    console.log('3-arg execute(commands, inputs, deadline): SUCCESS')
    console.log('  return data:', result3Arg.data)
  } catch (error) {
    console.log('3-arg execute(commands, inputs, deadline): REVERT')
    console.log('  message:', extractErrorMessage(error))
    const revertData = extractRevertData(error)
    if (revertData) {
      console.log('  revert data:', revertData)
      decodeKnownRevert(revertData)
    } else {
      console.log('  error object:', error)
    }
  }

  if (!executeSwap) {
    console.log()
    console.log('Skipping broadcast. Set EXECUTE_SWAP=true to send the tx.')
    return
  }

  console.log()
  console.log('Broadcasting 2-arg execute() swap transaction...')
  const txHash = await walletClient.writeContract({
    address: addresses.universalRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs],
    value: wethAmountInMaximum,
  })
  console.log('  tx hash:', txHash)

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  console.log('Swap receipt status:', receipt.status)
  console.log('Swap gas used:', receipt.gasUsed.toString())
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
