/**
 * Example: Opening Auction Bidding (Phase 2)
 *
 * This example demonstrates:
 * - Reading opening-auction state from the initializer (`OpeningAuctionLifecycle.getState`)
 * - Resolving the onchain OpeningAuctionPositionManager address
 * - Simulating a bid via `simulatePlaceBid` and inspecting decoded BalanceDelta
 * - (Optional) Broadcasting a `placeBid` transaction
 * - Resolving the onchain `positionId` for later incentive claims (no log parsing)
 *
 * Safety:
 * - By default this script only simulates.
 * - Set `EXECUTE=1` to broadcast the bid transaction.
 *
 * Requirements:
 * - `PRIVATE_KEY`
 * - `ASSET` (the token address created by an opening auction)
 * - `RPC_URL` (optional; defaults to Base Sepolia public RPC)
 * - `OPENING_AUCTION_INITIALIZER` when not configured in chain addresses
 *
 * Optional:
 * - `TICK_LOWER` (must be aligned to tickSpacing; defaults to 0)
 * - `LIQUIDITY` (Uniswap V4 liquidity units; defaults to 1_000_000)
 * - `SALT` (bytes32; defaults to zeroHash)
 */
import './env'

import {
  DopplerSDK,
  OpeningAuctionPositionManager,
  ZERO_ADDRESS,
  getAddresses,
} from '../src'
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  zeroHash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]
const shouldExecute = isEnabled(process.env.EXECUTE)

const asset = process.env.ASSET as Address | undefined
const openingAuctionInitializerOverride = process.env
  .OPENING_AUCTION_INITIALIZER as Address | undefined

function isEnabled(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function getEnvBigInt(value: string | undefined, fallback: bigint): bigint {
  if (!value) return fallback
  return BigInt(value)
}

function getEnvNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error('Expected integer env var')
  }
  return n
}

async function main() {
  if (!privateKey) throw new Error('PRIVATE_KEY is not set')
  if (!asset) throw new Error('ASSET is not set')

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

  const lifecycle = await sdk.getOpeningAuctionLifecycle(openingAuctionInitializer)
  const state = await lifecycle.getState(asset)

  console.log('Opening auction bid context:')
  console.log('  Chain:', baseSepolia.name, `(${baseSepolia.id})`)
  console.log('  User:', account.address)
  console.log('  Asset:', asset)
  console.log('  Opening hook:', state.openingAuctionHook)

  const pmAddress = await lifecycle.getPositionManager()
  console.log('  PositionManager:', pmAddress)

  const pm = await sdk.getOpeningAuctionPositionManager(pmAddress)
  const opening = await sdk.getOpeningAuction(state.openingAuctionHook)

  const tickSpacing = state.openingAuctionPoolKey.tickSpacing
  const tickLower = getEnvNumber(process.env.TICK_LOWER, 0)
  if (tickLower % tickSpacing !== 0) {
    throw new Error(
      `TICK_LOWER (${tickLower}) must be aligned to tickSpacing (${tickSpacing})`,
    )
  }
  const tickUpper = tickLower + tickSpacing

  const liquidity = getEnvBigInt(process.env.LIQUIDITY, 1_000_000n)
  const salt = (process.env.SALT as Hash | undefined) ?? zeroHash

  const hookData = OpeningAuctionPositionManager.encodeOwnerHookData(
    account.address,
  )

  console.log('\nStep 1: simulate place bid')
  const sim = await pm.simulatePlaceBid({
    key: state.openingAuctionPoolKey,
    tickLower,
    liquidity,
    salt,
    hookData,
    account: account.address,
  })
  console.log('  tickLower:', tickLower)
  console.log('  tickUpper:', tickUpper)
  console.log('  liquidity:', liquidity.toString())
  console.log('  salt:', salt)
  console.log('  decoded BalanceDelta:', sim.decoded)

  if (shouldExecute) {
    console.log('\nStep 2: broadcast place bid')
    const txHash = await pm.placeBid({
      key: state.openingAuctionPoolKey,
      tickLower,
      liquidity,
      salt,
      hookData,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash })
    console.log('  placeBid tx:', txHash)
  } else {
    console.log('\nSkipping writes. Set EXECUTE=1 to broadcast placeBid.')
  }

  console.log('\nStep 3: resolve positionId (for incentives)')
  const positionId = await opening.getPositionId({
    owner: account.address,
    tickLower,
    tickUpper,
    salt,
  })
  console.log('  positionId:', positionId.toString())
  console.log(
    '  (Claim later) opening.claimIncentivesByPositionKey({ owner, tickLower, tickUpper, salt })',
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

