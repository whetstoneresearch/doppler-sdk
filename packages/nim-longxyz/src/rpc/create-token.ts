import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  http,
  parseEther,
} from 'viem'
import type { Hex } from 'viem'
import { AirlockABI } from './abis/AirlockABI'
import { MigratorABI } from './abis/MigratorABI'
import { addresses } from './utils/addresses'
import { unichainSepolia } from 'wagmi/chains'
import { readContract } from 'viem/actions'
import { wallet } from '~/stores/wallet'

const DEFAULT_START_TICK = 167520
const DEFAULT_END_TICK = 200040
const DEFAULT_INITIAL_SUPPLY = 1000000000
const DEFAULT_TOKENS_TO_SELL = 1000000000

type Props = {
  tokenName: string
  tokenSymbol: string
  startTick?: number
  endTick?: number
  initialSupply?: number
  tokensToSell?: number
}

export async function createToken({ tokenName, tokenSymbol, ...props }: Props) {
  const startTick = props.startTick || DEFAULT_START_TICK
  const endTick = props.startTick || DEFAULT_END_TICK
  const initialSupply = props.initialSupply || DEFAULT_INITIAL_SUPPLY
  const tokensToSell = props.tokensToSell || DEFAULT_TOKENS_TO_SELL

  throwWrongChain()

  const publicClient = getPublicClient()
  const weth = await getWethAddress()
  const { request } = await publicClient.simulateContract({
    address: addresses.airlock,
    abi: AirlockABI,
    functionName: 'create',
    args: [
      parseEther(String(initialSupply)),
      parseEther(String(tokensToSell)),
      weth,
      addresses.tokenFactory,
      getTokenFactoryData(tokenName, tokenSymbol),
      addresses.governanceFactory,
      getGovernanceFactoryData(tokenSymbol),
      addresses.uniswapV3Initializer,
      getPoolInitializerData(startTick, endTick),
      addresses.migrator,
      '0x',
      generateSalt(),
    ],
  })

  const walletClient = await getWalletClient()
  const token = await walletClient.writeContract(request)

  return token
}

/**
 *
 */
function generateSalt(): Hex {
  const array = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return `0x${Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}`
}

/**
 *
 */
function getTokenFactoryData(name: string, symbol: string) {
  return encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'string' },
      { type: 'address[]' },
      { type: 'uint256[]' },
    ],
    [name, symbol, [], []]
  )
}

/**
 *
 */
function getGovernanceFactoryData(symbol: string) {
  return encodeAbiParameters([{ type: 'string' }], [symbol])
}

/**
 *
 */
function getPoolInitializerData(startTick: number, endTick: number) {
  return encodeAbiParameters(
    [{ type: 'uint24' }, { type: 'int24' }, { type: 'int24' }],
    [3000, startTick, endTick]
  )
}

/**
 *
 */
async function getWethAddress() {
  const address = await readContract(getPublicClient(), {
    abi: MigratorABI,
    address: addresses.migrator,
    functionName: 'weth',
  })

  if (!address) throw new Error('WETH address not loaded')

  return address
}

/**
 *
 */
function getPublicClient() {
  const alchemyKey = import.meta.env.PUBLIC_ALCHEMY_API_KEY

  const client = createPublicClient({
    chain: unichainSepolia,
    transport: http(`https://unichain-sepolia.g.alchemy.com/v2/${alchemyKey}`),
  })

  if (!client) {
    throw new Error(`Public client must be defined`)
  }

  return client
}

/**
 *
 */
async function getWalletClient() {
  const ethereumProvider = await wallet()?.getEthereumProvider()

  if (!ethereumProvider) {
    throw new Error(`No wallet proivder`)
  }

  const address = wallet()?.address as Hex | undefined

  if (!address) {
    throw new Error(`No address found`)
  }

  return createWalletClient({
    chain: unichainSepolia,
    transport: custom(ethereumProvider),
    account: address,
  })
}

/**
 *
 */
function throwWrongChain() {
  const chainId = Number(wallet()?.chainId.split(':')[1])

  if (chainId !== unichainSepolia.id) {
    throw new Error(`Switch network to ${unichainSepolia.name}`)
  }
}
