/**
 * Example: Opening Auction Lifecycle
 *
 * This example demonstrates:
 * - Building opening-auction params with `OpeningAuctionBuilder`
 * - Simulating create, then creating the auction
 * - Reading lifecycle state from `OpeningAuctionInitializer`
 * - Settling the opening auction hook
 * - Completing into Doppler
 * - Using incentive recovery/sweep wrappers
 *
 * Safety:
 * - By default this script only simulates create.
 * - Set `EXECUTE=1` to broadcast create/settle/complete transactions.
 * - Set `EXECUTE_INCENTIVE_WRAPPERS=1` to also broadcast recover/sweep wrappers.
 *
 * Requirements:
 * - `PRIVATE_KEY`
 * - `RPC_URL` (optional; defaults to Base Sepolia public RPC)
 * - `OPENING_AUCTION_INITIALIZER` when not configured in chain addresses
 */
import './env'

import {
  DEFAULT_OPENING_AUCTION_DURATION,
  DEFAULT_OPENING_AUCTION_FEE,
  DEFAULT_OPENING_AUCTION_INCENTIVE_SHARE_BPS,
  DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN0,
  DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN1,
  DEFAULT_OPENING_AUCTION_MIN_LIQUIDITY,
  DEFAULT_OPENING_AUCTION_SHARE_TO_AUCTION_BPS,
  DEFAULT_OPENING_DOPPLER_DURATION,
  DEFAULT_OPENING_DOPPLER_EPOCH_LENGTH,
  DEFAULT_OPENING_DOPPLER_FEE,
  DEFAULT_OPENING_DOPPLER_NUM_PD_SLUGS,
  DEFAULT_OPENING_DOPPLER_TICK_SPACING,
  DopplerSDK,
  OpeningAuctionPhase,
  OpeningAuctionStatus,
  ZERO_ADDRESS,
  getAddresses,
} from '../src'
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Address,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]
const shouldExecute = isEnabled(process.env.EXECUTE)
const shouldExecuteIncentiveWrappers = isEnabled(
  process.env.EXECUTE_INCENTIVE_WRAPPERS,
)
const openingAuctionInitializerOverride = process.env
  .OPENING_AUCTION_INITIALIZER as Address | undefined

function isEnabled(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function phaseLabel(phase: number): string {
  switch (phase) {
    case OpeningAuctionPhase.NotStarted:
      return 'NotStarted'
    case OpeningAuctionPhase.Active:
      return 'Active'
    case OpeningAuctionPhase.Closed:
      return 'Closed'
    case OpeningAuctionPhase.Settled:
      return 'Settled'
    default:
      return `Unknown(${phase})`
  }
}

function statusLabel(status: number): string {
  switch (status) {
    case OpeningAuctionStatus.Uninitialized:
      return 'Uninitialized'
    case OpeningAuctionStatus.AuctionActive:
      return 'AuctionActive'
    case OpeningAuctionStatus.DopplerActive:
      return 'DopplerActive'
    case OpeningAuctionStatus.Exited:
      return 'Exited'
    default:
      return `Unknown(${status})`
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

async function main() {
  if (!privateKey) throw new Error('PRIVATE_KEY is not set')

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
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: baseSepolia.id,
  })

  const addresses = getAddresses(baseSepolia.id)
  const openingAuctionInitializer =
    openingAuctionInitializerOverride ??
    addresses.openingAuctionInitializer ??
    ZERO_ADDRESS

  if (openingAuctionInitializer === ZERO_ADDRESS) {
    throw new Error(
      'OpeningAuctionInitializer is not configured for this chain. Set OPENING_AUCTION_INITIALIZER.',
    )
  }

  const params = sdk
    .buildOpeningAuction()
    .tokenConfig({
      name: 'TEST OPENING AUCTION',
      symbol: 'TOA',
      tokenURI: 'ipfs://replace-with-your-token-uri.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('850000'),
      numeraire: addresses.weth,
    })
    .openingAuctionConfig({
      auctionDuration: DEFAULT_OPENING_AUCTION_DURATION,
      minAcceptableTickToken0: DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN0,
      minAcceptableTickToken1: DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN1,
      incentiveShareBps: DEFAULT_OPENING_AUCTION_INCENTIVE_SHARE_BPS,
      tickSpacing: 60,
      fee: DEFAULT_OPENING_AUCTION_FEE,
      minLiquidity: DEFAULT_OPENING_AUCTION_MIN_LIQUIDITY,
      shareToAuctionBps: DEFAULT_OPENING_AUCTION_SHARE_TO_AUCTION_BPS,
    })
    .dopplerConfig({
      minProceeds: parseEther('5'),
      maxProceeds: parseEther('1000'),
      startTick: -120000,
      endTick: -90000,
      duration: DEFAULT_OPENING_DOPPLER_DURATION,
      epochLength: DEFAULT_OPENING_DOPPLER_EPOCH_LENGTH,
      numPdSlugs: DEFAULT_OPENING_DOPPLER_NUM_PD_SLUGS,
      fee: DEFAULT_OPENING_DOPPLER_FEE,
      tickSpacing: DEFAULT_OPENING_DOPPLER_TICK_SPACING,
    })
    .withMigration({ type: 'uniswapV2' })
    .withGovernance({ type: 'default' })
    .withUserAddress(account.address)
    .withTime({ startTimeOffset: 120 })
    .withOpeningAuctionInitializer(openingAuctionInitializer)
    .build()

  console.log('Opening auction lifecycle config:')
  console.log('  Chain:', baseSepolia.name, `(${baseSepolia.id})`)
  console.log('  User:', account.address)
  console.log('  Initializer:', openingAuctionInitializer)
  console.log('  Numeraire:', params.sale.numeraire)
  console.log('  Min proceeds:', formatEther(params.doppler.minProceeds), 'WETH')
  console.log('  Max proceeds:', formatEther(params.doppler.maxProceeds), 'WETH')

  console.log('\nStep 1: simulate create')
  const createSimulation = await sdk.factory.simulateCreateOpeningAuction(params)
  console.log('  Predicted token:', createSimulation.tokenAddress)
  console.log('  Predicted opening hook:', createSimulation.openingAuctionHookAddress)
  console.log('  Mined opening salt:', createSimulation.minedSalt)
  if (createSimulation.gasEstimate) {
    console.log('  Gas estimate:', createSimulation.gasEstimate.toString())
  }

  if (!shouldExecute) {
    console.log('\nSkipping writes. Set EXECUTE=1 to run create -> state -> settle -> complete.')
    return
  }

  console.log('\nStep 2: create opening auction')
  const createResult = await createSimulation.execute()
  console.log('  Token:', createResult.tokenAddress)
  console.log('  Opening hook:', createResult.openingAuctionHookAddress)
  console.log('  Create tx:', createResult.transactionHash)

  const asset = createResult.tokenAddress
  const lifecycle = await sdk.getOpeningAuctionLifecycle(openingAuctionInitializer)

  console.log('\nStep 3: read lifecycle state')
  const stateBefore = await lifecycle.getState(asset)
  console.log(
    '  Status:',
    stateBefore.status,
    `(${statusLabel(Number(stateBefore.status))})`,
  )
  console.log('  Opening hook:', stateBefore.openingAuctionHook)
  console.log('  Current doppler hook:', stateBefore.dopplerHook)

  console.log('\nStep 4: settle opening auction')
  const openingAuction = await sdk.getOpeningAuction(stateBefore.openingAuctionHook)
  const phaseBefore = await openingAuction.getPhase()
  console.log('  Phase before settle:', phaseBefore, `(${phaseLabel(phaseBefore)})`)
  if (phaseBefore !== OpeningAuctionPhase.Settled) {
    const settleHash = await openingAuction.settleAuction()
    await publicClient.waitForTransactionReceipt({ hash: settleHash })
    console.log('  settleAuction tx:', settleHash)
  } else {
    console.log('  Already settled, skipping settleAuction write')
  }

  const phaseAfter = await openingAuction.getPhase()
  console.log('  Phase after settle:', phaseAfter, `(${phaseLabel(phaseAfter)})`)
  if (phaseAfter !== OpeningAuctionPhase.Settled) {
    throw new Error('Opening auction must be settled before completion')
  }

  console.log('\nStep 5: complete into doppler')
  const completionSimulation = await sdk.factory.simulateCompleteOpeningAuction({
    asset,
    initializerAddress: openingAuctionInitializer,
  })
  console.log(
    '  Predicted doppler hook (simulation):',
    completionSimulation.dopplerHookAddress,
  )
  console.log(
    '  Candidate doppler salt (simulation):',
    completionSimulation.dopplerSalt,
  )
  const completionResult = await completionSimulation.execute()
  console.log('  Completion tx:', completionResult.transactionHash)
  console.log('  Doppler hook:', completionResult.dopplerHookAddress)
  console.log('  Doppler salt:', completionResult.dopplerSalt)

  const stateAfter = await lifecycle.getState(asset)
  console.log(
    '  Final status:',
    stateAfter.status,
    `(${statusLabel(Number(stateAfter.status))})`,
  )
  console.log('  Final doppler hook:', stateAfter.dopplerHook)

  console.log('\nStep 6: incentive recovery/sweep wrappers')
  let canRecover = false
  let canSweep = false

  try {
    await sdk.factory.simulateRecoverOpeningAuctionIncentives({
      asset,
      initializerAddress: openingAuctionInitializer,
    })
    canRecover = true
    console.log('  simulateRecoverOpeningAuctionIncentives: OK')
  } catch (error) {
    console.log(
      '  simulateRecoverOpeningAuctionIncentives reverted:',
      getErrorMessage(error),
    )
  }

  try {
    await sdk.factory.simulateSweepOpeningAuctionIncentives({
      asset,
      initializerAddress: openingAuctionInitializer,
    })
    canSweep = true
    console.log('  simulateSweepOpeningAuctionIncentives: OK')
  } catch (error) {
    console.log(
      '  simulateSweepOpeningAuctionIncentives reverted:',
      getErrorMessage(error),
    )
  }

  if (!shouldExecuteIncentiveWrappers) {
    console.log(
      '  Wrapper writes skipped. Set EXECUTE_INCENTIVE_WRAPPERS=1 to broadcast recover/sweep.',
    )
    return
  }

  if (canRecover) {
    const recoverHash = await sdk.factory.recoverOpeningAuctionIncentives({
      asset,
      initializerAddress: openingAuctionInitializer,
    })
    await publicClient.waitForTransactionReceipt({ hash: recoverHash })
    console.log('  recoverOpeningAuctionIncentives tx:', recoverHash)
  } else {
    console.log('  recoverOpeningAuctionIncentives skipped (simulation failed)')
  }

  if (canSweep) {
    const sweepHash = await sdk.factory.sweepOpeningAuctionIncentives({
      asset,
      initializerAddress: openingAuctionInitializer,
    })
    await publicClient.waitForTransactionReceipt({ hash: sweepHash })
    console.log('  sweepOpeningAuctionIncentives tx:', sweepHash)
  } else {
    console.log('  sweepOpeningAuctionIncentives skipped (simulation failed)')
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
