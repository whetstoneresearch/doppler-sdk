/**
 * Example: Create a Rehype Multicurve with Market Cap Ranges and Simulate Exact-Output Swaps
 *
 * This example:
 * - Builds a rehype multicurve using market cap ranges
 * - Creates two pools on chain (baseline customFee=0 and configured customFee)
 * - Uses a custom quote token as the pool numeraire
 * - Compares required numeraire input for a fixed token output to validate customFee impact
 * - Quotes directly via `dopplerSdk.quoter.quoteExactOutputV4Quoter`
 * - Asserts hook-reported customFee for both pools
 */
import './env'

import {
  DopplerSDK,
  DYNAMIC_FEE_FLAG,
  type CreateMulticurveParams,
  getAddresses,
  rehypeDopplerHookAbi,
  type V4PoolKey,
} from '../src'
import {
  createPublicClient,
  createWalletClient,
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
const NUMERAIRE_TOKEN = '0xd89fdcB6c8D107f27CEe4452Ccfb70Dc4F9768a7' as Address

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

const SAMPLE_AMOUNT_OUT = parseEther('100')
const POOL_FEE = 0 // Pool manager fee; customFee is charged by the rehype hook
const POOL_TICK_SPACING = 60
const BASELINE_CUSTOM_FEE_BPS = 0
const CUSTOM_FEE_BPS = 100_000 // 0.3%

const CURVE_RANGES = [
  {
    marketCap: { start: 500_000, end: 1_500_000 },
    numPositions: 10,
    shares: parseEther('0.3'),
  },
  {
    marketCap: { start: 1_000_000, end: 5_000_000 },
    numPositions: 15,
    shares: parseEther('0.4'),
  },
  {
    marketCap: { start: 4_000_000, end: 50_000_000 },
    numPositions: 10,
    shares: parseEther('0.3'),
  },
] as const

async function getNumerairePriceUsd(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
  )
  const data = await response.json()
  return data.ethereum.usd
}

function buildRehypeParams({
  sdk,
  userAddress,
  addresses,
  numerairePriceUsd,
  quoteToken,
  customFee,
  airlockOwner,
  hookAddress,
  buybackDestination,
}: {
  sdk: DopplerSDK
  userAddress: Address
  addresses: ReturnType<typeof getAddresses>
  numerairePriceUsd: number
  quoteToken: Address
  customFee: number
  airlockOwner: Address
  hookAddress: Address
  buybackDestination: Address
}): CreateMulticurveParams {
  const beneficiaries = [
    { beneficiary: buybackDestination, shares: 950_000_000_000_000_000n },
    { beneficiary: airlockOwner, shares: 50_000_000_000_000_000n },
  ]

  return sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Rehype Marketcap Swap EO',
      symbol: 'RMCSO',
      tokenURI: 'ipfs://rehype-marketcap-simulate-exact-out',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'),
      numTokensToSell: parseEther('900000000'),
      numeraire: quoteToken,
    })
    .withCurves({
      numerairePrice: numerairePriceUsd,
      fee: POOL_FEE,
      tickSpacing: POOL_TICK_SPACING,
      curves: CURVE_RANGES,
      beneficiaries,
    })
    .withRehypeDopplerHook({
      hookAddress,
      buybackDestination,
      customFee,
      assetBuybackPercentWad: parseEther('0.95'),
      numeraireBuybackPercentWad: parseEther('0.00'),
      beneficiaryPercentWad: parseEther('0.05'),
      lpPercentWad: parseEther('0.00'),
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(userAddress)
    .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
    .withNoOpMigrator(addresses.noOpMigrator!)
    .build()
}

function buildRehypePoolKey(
  params: CreateMulticurveParams,
  tokenAddress: Address,
  dopplerHookInitializer: Address,
): V4PoolKey {
  const token = tokenAddress.toLowerCase()
  const numeraire = params.sale.numeraire.toLowerCase()

  const currency0 = token < numeraire ? tokenAddress : params.sale.numeraire
  const currency1 = token < numeraire ? params.sale.numeraire : tokenAddress

  const hooks = params.modules?.dopplerHookInitializer ?? dopplerHookInitializer
  if (!hooks) {
    throw new Error('Missing dopplerHookInitializer address for rehype pool key')
  }

  return {
    currency0,
    currency1,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: params.pool.tickSpacing,
    hooks,
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

  const dopplerSdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  })
  const addresses = getAddresses(baseSepolia.id)
  const quoteToken = NUMERAIRE_TOKEN
  const rehypeHookAddress = addresses.rehypeDopplerHook as Address
  const buybackDestination = '0x0000000000000000000000000000000000000007' as Address

  console.log('Fetching numeraire reference price...')
  const numerairePriceUsd = 0.0009172
  console.log(`Numeraire reference price: $${numerairePriceUsd.toLocaleString()}`)
  console.log(`Quote token (numeraire): ${quoteToken}`)

  const airlockOwnerAbi = [
    {
      name: 'owner',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'address' }],
    },
  ] as const

  const airlockOwner = await publicClient.readContract({
    address: addresses.airlock,
    abi: airlockOwnerAbi,
    functionName: 'owner',
  }) as Address

  const createAndQuoteRehypeVariant = async (label: string, customFeeBps: number) => {
    const createParams = buildRehypeParams({
      sdk: dopplerSdk,
      userAddress: account.address,
      addresses,
      numerairePriceUsd,
      quoteToken,
      customFee: customFeeBps,
      airlockOwner,
      hookAddress: rehypeHookAddress,
      buybackDestination,
    })

    if (createParams.pool.fee !== POOL_FEE) {
      throw new Error(
        `[${label}] Pool fee mismatch: expected ${POOL_FEE}, got ${createParams.pool.fee}`
      )
    }
    if (createParams.sale.numeraire.toLowerCase() !== quoteToken.toLowerCase()) {
      throw new Error(
        `[${label}] Pool quote token mismatch: expected ${quoteToken}, got ${createParams.sale.numeraire}`
      )
    }

    const created = await dopplerSdk.factory.createMulticurve(createParams)
    await publicClient.waitForTransactionReceipt({
      hash: created.transactionHash as `0x${string}`,
    })

    const poolKey: V4PoolKey = buildRehypePoolKey(
      createParams,
      created.tokenAddress,
      addresses.dopplerHookInitializer!,
    )
    const zeroForOne =
      poolKey.currency0.toLowerCase() === quoteToken.toLowerCase()
    const artCoinAmount = SAMPLE_AMOUNT_OUT
    const hookData: Hex = '0x'

    const v4OutputQuote = await dopplerSdk.quoter.quoteExactOutputV4Quoter({
      poolKey,
      zeroForOne,
      exactAmount: artCoinAmount,
      hookData,
    })

    console.log(label, v4OutputQuote)
    console.log(dopplerSdk.quoter)

    const hookFees = await publicClient.readContract({
      address: addresses.rehypeDopplerHook,
      abi: rehypeDopplerHookAbi,
      functionName: 'getHookFees',
      args: [created.poolId],
    }) as [bigint, bigint, bigint, bigint, number]

    const hookCustomFee = Number(hookFees[4])
    if (hookCustomFee !== customFeeBps) {
      throw new Error(
        `[${label}] Hook customFee mismatch: expected ${customFeeBps}, got ${hookCustomFee}`
      )
    }

    console.log(`[${label}] Created Rehype multicurve`)
    console.log(`  Token: ${created.tokenAddress}`)
    console.log(`  Pool: ${created.poolId}`)
    console.log(`  Tx: ${created.transactionHash}`)
    console.log(`  Quote source: uniswapV4Quoter`)
    console.log(`  Quote amountIn: ${formatEther(v4OutputQuote.amountIn)}`)
    console.log(`  Hook-reported customFee: ${hookCustomFee} bps`)

    return {
      created,
      poolKey,
      quote: v4OutputQuote,
      hookCustomFee,
    }
  }

  const baseline = await createAndQuoteRehypeVariant(
    'baseline',
    BASELINE_CUSTOM_FEE_BPS,
  )
  const withCustomFee = await createAndQuoteRehypeVariant(
    'custom-fee',
    CUSTOM_FEE_BPS,
  )

  if (withCustomFee.quote.amountIn <= baseline.quote.amountIn) {
    throw new Error(
      `Expected custom-fee quote to require more input. baseline=${baseline.quote.amountIn}, customFee=${withCustomFee.quote.amountIn}`
    )
  }

  const inputDelta = withCustomFee.quote.amountIn - baseline.quote.amountIn
  const inputDeltaBps = Number((inputDelta * 10_000n) / baseline.quote.amountIn)

  console.log('Custom fee validation passed')
  console.log(`  Target output amount: ${formatEther(SAMPLE_AMOUNT_OUT)}`)
  console.log(
    `  Baseline input (${BASELINE_CUSTOM_FEE_BPS} bps): ${formatEther(baseline.quote.amountIn)}`
  )
  console.log(
    `  Custom-fee input (${CUSTOM_FEE_BPS} bps): ${formatEther(withCustomFee.quote.amountIn)}`
  )
  console.log(`  Input delta: ${formatEther(inputDelta)} (${inputDeltaBps} bps)`)
  console.log('Exact-output quote comparison complete')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
