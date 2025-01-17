import {
  DOPPLER_V4_ADDRESSES,
  type DopplerPreDeploymentConfig,
} from 'doppler-v4-sdk'
import {
  createClient,
  custom,
  http,
  parseEther,
  publicActions,
  walletActions,
  type Address,
} from 'viem'
import { unichainSepolia } from 'viem/chains'

/**
 * addresses
 */
export const addresses = DOPPLER_V4_ADDRESSES[1301]

/**
 * create public client
 */
export function createPublicClient() {
  const alchemyKey = import.meta.env.PUBLIC_ALCHEMY_KEY
  return createClient({
    chain: unichainSepolia,
    transport: http(`https://unichain-sepolia.g.alchemy.com/v2/${alchemyKey}`),
  }).extend(publicActions)
}

/**
 * create wallet
 */
export function createWalletClient(account: Address) {
  return createClient({
    account,
    chain: unichainSepolia,
    transport: custom(window.ethereum),
  }).extend(walletActions)
}

/**
 * dispatch events on the ui
 */
export type Events = 'setting' | 'deploying' | 'success' | 'error'

export function useEvents(): [
  Map<Events, (props?: any) => void>,
  (event: Events, arg?: any) => void
] {
  const events = new Map<Events, (props?: any) => void>()

  const emits = (event: Events, arg?: any) => {
    events.get(event)?.(arg)
  }

  return [events, emits]
}

/**
 * build config
 */
export async function buildConfigParams(
  publicClient: ReturnType<typeof createPublicClient>
): Promise<DopplerPreDeploymentConfig> {
  // token to create
  const { timestamp } = await publicClient.getBlock()

  return {
    name: 'Gud Coin',
    symbol: 'GUD',
    totalSupply: parseEther('10000'),
    numTokensToSell: parseEther('1000'),
    blockTimestamp: Number(timestamp),
    startTimeOffset: 1,
    duration: 3,
    epochLength: 1600,
    priceRange: {
      startPrice: 0.1,
      endPrice: 0.0001,
    },
    tickSpacing: 30,
    fee: 300,
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('600'),
  }
}
