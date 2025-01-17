import { Token } from '@uniswap/sdk-core'
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
import { ethers } from 'ethers'
import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk'
import { getProvider } from './provider'
import { createStore } from 'solid-js/store'

type ConfigStore = {
  RPC: string
  USDC_TOKEN: {
    chainId: number
    address: string
  }
  WETH_TOKEN: {
    chainId: number
    address: string
  }
  POOL_FACTORY_CONTRACT_ADDRESS: string
  QUOTER_CONTRACT_ADDRESS: string
}

export const configMainnet = {
  RPC: `https://mainnet.infura.io/v3/7f136f530ed34dd5afc04a0a5c016f0d`,
  USDC_TOKEN: {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    chainId: 1,
  },
  WETH_TOKEN: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    chainId: 1,
  },
  POOL_FACTORY_CONTRACT_ADDRESS: `0x1F98431c8aD98523631AE4a59f267346ea31F984`,
  QUOTER_CONTRACT_ADDRESS: `0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6`,
}

export const configBaseSepolia = {
  RPC: `https://base-sepolia.infura.io/v3/7f136f530ed34dd5afc04a0a5c016f0d`,
  USDC_TOKEN: {
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532,
  },
  WETH_TOKEN: {
    address: '0x4200000000000000000000000000000000000006',
    chainId: 84532,
  },
  POOL_FACTORY_CONTRACT_ADDRESS: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`,
  QUOTER_CONTRACT_ADDRESS: `0xC5290058841028F1614F3A6F0F5816cAd0df5E27`,
}

const configStore = createStore<ConfigStore>(configMainnet)

export const [config, setConfig] = configStore

export const WETH_TOKEN = new Token(
  config.WETH_TOKEN.chainId,
  config.WETH_TOKEN.address,
  // ChainId.MAINNET,
  // '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  18,
  'WETH',
  'Wrapped Ether'
)

export const USDC_TOKEN = new Token(
  config.USDC_TOKEN.chainId,
  config.USDC_TOKEN.address,
  // ChainId.MAINNET,
  // '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'USDC',
  'USD//C'
)

interface Config {
  rpc: {
    local: string
    mainnet: string
  }
  tokens: {
    in: Token
    amountIn: number
    out: Token
    poolFee: number
  }
}

const RPC = `https://mainnet.infura.io/v3/7f136f530ed34dd5afc04a0a5c016f0d`

export const CurrentConfig: Config = {
  rpc: {
    local: config.RPC,
    mainnet: config.RPC,
  },
  tokens: {
    amountIn: 1000,
    in: USDC_TOKEN,
    out: WETH_TOKEN,
    poolFee: FeeAmount.MEDIUM,
  },
}

const currentPoolAddress = computePoolAddress({
  factoryAddress: config.POOL_FACTORY_CONTRACT_ADDRESS,
  tokenA: CurrentConfig.tokens.in,
  tokenB: CurrentConfig.tokens.out,
  fee: CurrentConfig.tokens.poolFee,
})

/**
 *
 * the pool contract
 *
 */
export const poolContract = new ethers.Contract(
  currentPoolAddress,
  IUniswapV3PoolABI.abi,
  getProvider()
)

/**
 *
 * get inputs to fetch quotes
 *
 */
export async function getPoolConstants(): Promise<{
  token0: string
  token1: string
  fee: number
}> {
  const currentPoolAddress = computePoolAddress({
    factoryAddress: config.POOL_FACTORY_CONTRACT_ADDRESS,
    tokenA: CurrentConfig.tokens.in,
    tokenB: CurrentConfig.tokens.out,
    fee: CurrentConfig.tokens.poolFee,
  })

  const poolContract = new ethers.Contract(
    currentPoolAddress,
    IUniswapV3PoolABI.abi,
    getProvider()
  )
  const [token0, token1, fee] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
  ])

  return {
    token0,
    token1,
    fee,
  }
}
