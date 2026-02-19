/**
 * Example: Create a Scheduled Multicurve Auction on Ethereum Sepolia
 *
 * Uses the scheduled multicurve initializer.
 * Default delay is 0 seconds (start now), so launches are effectively immediate.
 * Set ETH_SEPOLIA_START_DELAY_SECONDS>0 to enforce delayed start mode.
 *
 * This script simulates first, then broadcasts by default.
 * Set EXECUTE_ETH_SEPOLIA=false to run simulation-only.
 */
import './env'

import { CHAIN_IDS, DopplerSDK, WAD, getAddresses } from '../src'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const alchemyApiKey = process.env.ALCHEMY_API_KEY?.trim()
const alchemySepoliaRpc = alchemyApiKey
  ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`
  : undefined
const rpcUrl =
  process.env.ETH_SEPOLIA_RPC_URL ??
  process.env.RPC_URL ??
  alchemySepoliaRpc ??
  sepolia.rpcUrls.default.http[0]
const shouldExecute = process.env.EXECUTE_ETH_SEPOLIA !== 'false'
const startDelaySecondsRaw = process.env.ETH_SEPOLIA_START_DELAY_SECONDS ?? '0'

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

async function main() {
  const startDelaySeconds = Number(startDelaySecondsRaw)
  if (!Number.isFinite(startDelaySeconds) || startDelaySeconds < 0) {
    throw new Error('ETH_SEPOLIA_START_DELAY_SECONDS must be a non-negative number')
  }

  const account = privateKeyToAccount(privateKey)
  const chainId = CHAIN_IDS.ETH_SEPOLIA
  const addresses = getAddresses(chainId)

  if (!addresses.v4ScheduledMulticurveInitializer) {
    throw new Error(
      'Scheduled multicurve initializer not configured on ETH Sepolia',
    )
  }

  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: sepolia, transport: http(rpcUrl), account })

  const connectedChainId = await publicClient.getChainId()
  if (connectedChainId !== sepolia.id) {
    throw new Error(
      `Connected to chain ${connectedChainId}, expected Ethereum Sepolia (${sepolia.id})`,
    )
  }

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId })

  const startTime = Math.floor(Date.now() / 1000) + startDelaySeconds
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Scheduled ETH Sepolia Token',
      symbol: 'SETS',
      tokenURI: 'ipfs://scheduled-eth-sepolia.json',
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth,
    })
    .poolConfig({
      fee: 0,
      tickSpacing: 8,
      curves: [
        { tickLower: 0, tickUpper: 240000, numPositions: 12, shares: parseEther('0.5') },
        { tickLower: 16000, tickUpper: 240000, numPositions: 12, shares: parseEther('0.5') },
      ],
    })
    .withSchedule({ startTime })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build()

  console.log('Ethereum Sepolia scheduled multicurve example')
  console.log('RPC:', rpcUrl)
  console.log('Account:', account.address)
  console.log('Start delay (seconds):', startDelaySeconds)
  console.log('Start time:', startTime)
  if (startDelaySeconds === 0) {
    console.log('Start mode:', 'immediate (scheduled at current time)')
  }
  console.log('Execute:', shouldExecute)

  const simulation = await sdk.factory.simulateCreateMulticurve(params)
  console.log('Simulation OK')
  console.log('Predicted token:', simulation.tokenAddress)
  console.log('Predicted pool id:', simulation.poolId)
  console.log('Estimated gas:', simulation.gasEstimate?.toString() ?? 'n/a')

  if (!shouldExecute) {
    console.log('Skipping broadcast (simulation-only mode via EXECUTE_ETH_SEPOLIA=false).')
    return
  }

  const result = await simulation.execute()
  console.log('✅ Scheduled multicurve created on ETH Sepolia')
  console.log('Token address:', result.tokenAddress)
  console.log('Pool ID:', result.poolId)
  console.log('Transaction:', result.transactionHash)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
