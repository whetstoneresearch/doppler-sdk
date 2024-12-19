import './UlTokens.styles.css'
import { createSignal, onMount } from 'solid-js'
import { formatEther } from 'viem'
import findTokens, { type Token } from '~/rpc/find-tokens'

export default function UlTokens() {
  const [tokens, setTokens] = createSignal<Token[]>([])

  onMount(async () => {
    const foundTokens = await findTokens()
    console.log('>> tokens', { tokens })
    setTokens(foundTokens)
  })

  return (
    <ul
      role="list"
      id="ul-tokens"
    >
      {tokens().map(({ asset, ...token }) => (
        <li>
          <article>
            <header>
              Created by <a href="#">name</a>,{' '}
              <time datetime={new Date().toISOString()}>date</time>
            </header>
            <a href={`/token/${asset.address}`}>
              <img
                src={`https://placehold.co/128x128`}
                alt=""
              />
              <div>
                <hgroup>
                  <h2>${asset.symbol}</h2>
                  <p>{asset.name}</p>
                </hgroup>
                <p>
                  Lorem ipsum dol or sit amet em i um dolor sit amet m ipsum
                  dolor sit amet asdasd ...
                </p>
              </div>
            </a>
            <input
              type="range"
              value={formatEther(token.poolAssetBalance || 0n)}
              max={formatEther(asset.totalSupply ?? 0n)}
              readonly
            />
          </article>
        </li>
      ))}
    </ul>
  )
}
