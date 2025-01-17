import { createSignal } from 'solid-js'
import {
  config,
  configBaseSepolia,
  configMainnet,
  setConfig,
} from './service/config'

type Network = 'BASE_SEPOLIA' | 'MAINNET'

export default function DetailsConfig() {
  const [network, setNetwork] = createSignal<Network>('MAINNET')

  return (
    <details>
      <summary>Configuration</summary>
      <div>
        <label>Network</label>
        <ul
          role="list"
          aria-orientation="horizontal"
        >
          <li>
            <button
              type="button"
              aria-current={network() === 'MAINNET'}
              onClick={() => {
                setNetwork('MAINNET')
                setConfig({
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
                })
              }}
            >
              mainnet
            </button>
          </li>
          <li>
            <button
              type="button"
              aria-current={network() === 'BASE_SEPOLIA'}
              onClick={() => {
                setNetwork('BASE_SEPOLIA')
                setConfig({
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
                })
              }}
            >
              base sepolia
            </button>
          </li>
        </ul>
      </div>
      <hr />
      <div>
        <label for="RPC">RPC</label>
        <input
          type="text"
          id="RPC"
          name="RPC"
          value={config.RPC}
          onInput={({ currentTarget }) => setConfig('RPC', currentTarget.value)}
        />
      </div>
      <hr />
      <div>
        <label for="POOL_FACTORY_CONTRACT_ADDRESS">POOL_FACTORY</label>
        <input
          type="text"
          id="POOL_FACTORY_CONTRACT_ADDRESS"
          name="POOL_FACTORY_CONTRACT_ADDRESS"
          value={config.POOL_FACTORY_CONTRACT_ADDRESS}
          onInput={({ currentTarget }) =>
            setConfig('POOL_FACTORY_CONTRACT_ADDRESS', currentTarget.value)
          }
        />
      </div>
      <hr />

      <div>
        <label for="QUOTER_CONTRACT_ADDRESS">QUOTER</label>
        <input
          type="text"
          id="QUOTER_CONTRACT_ADDRESS"
          name="QUOTER_CONTRACT_ADDRESS"
          value={config.QUOTER_CONTRACT_ADDRESS}
          onInput={({ currentTarget }) =>
            setConfig('QUOTER_CONTRACT_ADDRESS', currentTarget.value)
          }
        />
      </div>
      <hr />

      <fieldset>
        <legend>WETH_TOKEN</legend>
        <div>
          <label for="WETH_TOKEN_CHAIN">chain id</label>
          <input
            type="number"
            name="WETH_TOKEN_CHAIN"
            id="WETH_TOKEN_CHAIN"
            value={config.WETH_TOKEN.chainId}
            onInput={({ currentTarget }) => {
              const token = config.WETH_TOKEN
              setConfig('WETH_TOKEN', {
                ...token,
                chainId: Number(currentTarget.value),
              })
            }}
          />
        </div>
        <hr />
        <div>
          <label for="WETH_TOKEN_ADDR">address</label>
          <input
            type="text"
            name="WETH_TOKEN_ADDR"
            id="WETH_TOKEN_ADDR"
            value={config.WETH_TOKEN.address}
            onInput={({ currentTarget }) => {
              const token = config.WETH_TOKEN
              setConfig('WETH_TOKEN', {
                ...token,
                address: currentTarget.value,
              })
            }}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>USDC_TOKEN</legend>
        <div>
          <label for="USDC_TOKEN_CHAIN">chain id</label>
          <input
            type="number"
            name="USDC_TOKEN_CHAIN"
            id="USDC_TOKEN_CHAIN"
            value={config.USDC_TOKEN.chainId}
            onInput={({ currentTarget }) => {
              const token = config.USDC_TOKEN
              setConfig('USDC_TOKEN', {
                ...token,
                chainId: Number(currentTarget.value),
              })
            }}
          />
        </div>
        <hr />
        <div>
          <label for="USDC_TOKEN_ADDR">address</label>
          <input
            type="text"
            name="USDC_TOKEN_ADDR"
            id="USDC_TOKEN_ADDR"
            value={config.USDC_TOKEN.address}
            onInput={({ currentTarget }) => {
              const token = config.USDC_TOKEN
              setConfig('USDC_TOKEN', {
                ...token,
                address: currentTarget.value,
              })
            }}
          />
        </div>
      </fieldset>
    </details>
  )
}
