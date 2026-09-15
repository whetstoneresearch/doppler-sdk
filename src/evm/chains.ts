import { defineChain } from 'viem';
import { CHAIN_IDS } from './addresses';

/** Arc mainnet requires an explicit RPC transport; no public endpoint is configured. */
export const arc = defineChain({
  id: CHAIN_IDS.ARC,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [] } },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
});
