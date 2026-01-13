/**
 * Create Test Multicurve Token
 *
 * Creates a V4 multicurve token for testing market cap calculations.
 * Uses symbol "TEST" so UI filters it out.
 *
 * Usage:
 *   pnpx tsx examples/create-test-multicurve.ts --eth     # ETH numeraire
 *   pnpx tsx examples/create-test-multicurve.ts --usdc    # USDC numeraire
 *
 * Environment variables (from .env.local or .env):
 *   PRIVATE_KEY - Wallet private key for signing transactions
 *   RPC_URL - Base mainnet RPC URL (optional, defaults to public RPC)
 */
import './env'

import { parseEther, createWalletClient, createPublicClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { MulticurveBuilder, CHAIN_IDS, DopplerSDK } from '../src'

// Base mainnet addresses
const WETH_BASE = '0x4200000000000000000000000000000000000006' as Address
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address

// Default configuration
const DEFAULT_TOTAL_SUPPLY = parseEther('1000000000') // 1 billion tokens
const DEFAULT_NUM_TOKENS_TO_SELL = parseEther('800000000') // 800 million (80%)
const DEFAULT_START_MARKET_CAP = 500_000 // $500k
const DEFAULT_END_MARKET_CAP = 5_000_000 // $5M graduation

interface CreateTestTokenParams {
  numeraire: 'eth' | 'usdc'
  privateKey: string
  rpcUrl?: string
  startMarketCap?: number
  endMarketCap?: number
}

async function createTestMulticurve(params: CreateTestTokenParams) {
  const {
    numeraire,
    privateKey,
    rpcUrl = 'https://mainnet.base.org',
    startMarketCap = DEFAULT_START_MARKET_CAP,
    endMarketCap = DEFAULT_END_MARKET_CAP,
  } = params

  // Setup wallet
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  })
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  })

  // Determine numeraire config
  const isUSDC = numeraire === 'usdc'
  const numeraireAddress = isUSDC ? USDC_BASE : WETH_BASE
  const numerairePrice = isUSDC ? 1 : 3000 // $1 for USDC, ~$3000 for ETH
  const numeraireDecimals = isUSDC ? 6 : 18
  const numPositions = isUSDC ? 120 : 10 // More positions for USDC to prevent overflow

  console.log('='.repeat(60))
  console.log('Creating Test Multicurve Token')
  console.log('='.repeat(60))
  console.log(`Numeraire: ${numeraire.toUpperCase()} (${numeraireAddress})`)
  console.log(`Numeraire Price: $${numerairePrice}`)
  console.log(`Numeraire Decimals: ${numeraireDecimals}`)
  console.log(`Start Market Cap: $${startMarketCap.toLocaleString()}`)
  console.log(`End Market Cap: $${endMarketCap.toLocaleString()}`)
  console.log(`Num Positions: ${numPositions}`)
  console.log(`User Address: ${account.address}`)
  console.log('')

  // Generate unique token name with timestamp
  const timestamp = Date.now()
  const tokenName = `TEST ${numeraire.toUpperCase()} Multicurve ${timestamp}`
  const tokenSymbol = 'TEST' // Always TEST so UI filters it out
  const tokenURI = `ipfs://test-multicurve-${numeraire}-${timestamp}`

  console.log(`Token Name: ${tokenName}`)
  console.log(`Token Symbol: ${tokenSymbol}`)
  console.log('')

  // Build the multicurve config
  const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
    .tokenConfig({
      name: tokenName,
      symbol: tokenSymbol,
      tokenURI,
    })
    .saleConfig({
      initialSupply: DEFAULT_TOTAL_SUPPLY,
      numTokensToSell: DEFAULT_NUM_TOKENS_TO_SELL,
      numeraire: numeraireAddress,
    })
    .withCurves({
      fee: 10000, // 1%
      numerairePrice,
      numeraireDecimals,
      curves: [
        {
          marketCap: { start: startMarketCap, end: endMarketCap },
          numPositions,
          shares: parseEther('1.0'), // 100% for single curve
        },
      ],
      beneficiaries: [
        { beneficiary: account.address, shares: parseEther('0.95') },
        { beneficiary: '0xeb2af50362eD00dB3F72aC4a9C0093fddd2CAd31' as Address, shares: parseEther('0.05') },
      ],
    })
    .withUserAddress(account.address)
    .withMigration({ type: 'noOp' })
    .withGovernance({ type: 'noOp' })

  const multicurveParams = builder.build()

  console.log('--- Multicurve Parameters ---')
  console.log(`Curves: ${multicurveParams.pool.curves.length}`)
  multicurveParams.pool.curves.forEach((curve, i) => {
    console.log(`  Curve ${i}: tickLower=${curve.tickLower}, tickUpper=${curve.tickUpper}, positions=${curve.numPositions}`)
  })
  console.log('')

  // Create SDK instance
  const sdk = new DopplerSDK({
    chainId: CHAIN_IDS.BASE,
    publicClient,
    walletClient,
  })

  console.log('Simulating transaction...')
  const simulation = await sdk.factory.simulateCreateMulticurve(multicurveParams)

  console.log('')
  console.log('--- Simulation Result ---')
  console.log(`Token Address: ${simulation.tokenAddress}`)
  console.log(`Pool ID: ${simulation.poolId}`)
  console.log('')

  // Prompt for confirmation
  console.log('Ready to deploy. Set DRY_RUN=false to execute.')

  if (process.env.DRY_RUN === 'false') {
    console.log('Executing transaction...')
    const result = await sdk.factory.createMulticurve(multicurveParams)
    console.log('')
    console.log('--- Deployment Result ---')
    console.log(`Transaction Hash: ${result.transactionHash}`)
    console.log(`Token Address: ${simulation.tokenAddress}`)
    console.log('')
    console.log('View on BaseScan:')
    console.log(`https://basescan.org/tx/${result.transactionHash}`)
  } else {
    console.log('')
    console.log('DRY RUN - No transaction executed')
    console.log('To execute: DRY_RUN=false pnpx tsx examples/create-test-multicurve.ts --' + numeraire)
  }

  return {
    tokenAddress: simulation.tokenAddress,
    poolId: simulation.poolId,
    params: multicurveParams,
  }
}

// Parse CLI args
const args = process.argv.slice(2)
const numeraire = args.includes('--usdc') ? 'usdc' : 'eth'

// Check for required env vars
const privateKey = process.env.PRIVATE_KEY
if (!privateKey) {
  console.error('Error: PRIVATE_KEY environment variable required')
  console.error('')
  console.error('Usage:')
  console.error('  PRIVATE_KEY=0x... pnpx tsx examples/create-test-multicurve.ts --eth')
  console.error('  PRIVATE_KEY=0x... pnpx tsx examples/create-test-multicurve.ts --usdc')
  process.exit(1)
}

createTestMulticurve({
  numeraire,
  privateKey,
  rpcUrl: process.env.RPC_URL,
}).catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
