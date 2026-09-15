import { CHAIN_IDS } from '../../../src/evm/addresses';

export const MAINNET_FORK_CHAINS = {
  mainnet: CHAIN_IDS.MAINNET,
  bsc: CHAIN_IDS.BSC,
  'monad-mainnet': CHAIN_IDS.MONAD_MAINNET,
  robinhood: CHAIN_IDS.ROBINHOOD,
  arc: CHAIN_IDS.ARC,
  base: CHAIN_IDS.BASE,
  arbitrum: CHAIN_IDS.ARBITRUM,
} as const;

type MainnetForkChain = [
  keyof typeof MAINNET_FORK_CHAINS,
  (typeof MAINNET_FORK_CHAINS)[keyof typeof MAINNET_FORK_CHAINS],
];

export function getMainnetForkChains(): MainnetForkChain[] {
  const selected = process.env.TEST_CHAIN;
  const chains = Object.entries(MAINNET_FORK_CHAINS) as MainnetForkChain[];
  if (selected === undefined) return chains;
  if (selected === 'base-sepolia') return [];

  const chain = chains.find(([name]) => name === selected);
  if (!chain) {
    throw new Error(
      `Unknown TEST_CHAIN "${selected}". Expected ${Object.keys(MAINNET_FORK_CHAINS).join(', ')} or base-sepolia.`,
    );
  }
  return [chain];
}
