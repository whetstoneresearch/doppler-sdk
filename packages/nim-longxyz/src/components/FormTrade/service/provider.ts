import { ethers, providers } from 'ethers'
import { CurrentConfig } from './config'

export function getProvider(): providers.Provider {
  return new ethers.providers.JsonRpcProvider(CurrentConfig.rpc.mainnet)
}
