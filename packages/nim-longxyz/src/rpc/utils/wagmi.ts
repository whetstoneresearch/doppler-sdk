import { http, createConfig } from 'wagmi'
import { unichainSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'

const alchemyKey = import.meta.env.PUBLIC_ALCHEMY_API_KEY

export const config = createConfig({
  chains: [unichainSepolia],
  connectors: [injected(), coinbaseWallet()],
  transports: {
    [unichainSepolia.id]: http(
      `https://unichain-sepolia.g.alchemy.com/v2/${alchemyKey}`
    ),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
