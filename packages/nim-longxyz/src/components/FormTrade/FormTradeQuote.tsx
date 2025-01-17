import { createSignal } from 'solid-js'
import { formTrade, setFormTrade } from './service'
import { getQuote } from '~/rpc/get-quote'
import { USDC_TOKEN, WETH_TOKEN } from './service/config'

export default function FieldsetTradeQuote() {
  const [quote, setQuote] = createSignal<string>()
  const [error, setError] = createSignal<string>()

  return (
    <form
      inert={formTrade.busy}
      onSubmit={async e => {
        e.preventDefault()

        setQuote()
        setFormTrade('busy', true)

        try {
          const quote = await getQuote(formTrade.quote_value)
          setQuote(quote)
        } catch (e) {
          console.error(e)
          setError(e?.toString())
        } finally {
          setFormTrade('busy', false)
        }
      }}
    >
      <h1>Getting quote</h1>
      <div class="pi-1">
        <label for="quote_value">Quote value</label>
        <input
          type="number"
          name="quote_value"
          id="quote_value"
          value={formTrade.quote_value}
          onInput={e =>
            setFormTrade('quote_value', Number(e.currentTarget.value))
          }
        />
      </div>
      <hr />
      <div class="pi-1">
        <label>from</label>
        <select name="quote_from">
          <option
            value={USDC_TOKEN.symbol}
            selected
          >
            {USDC_TOKEN.symbol}
          </option>
        </select>
      </div>
      <hr />
      <div class="pi-1">
        <label>to</label>
        <select name="quote_to">
          <option
            value={WETH_TOKEN.symbol}
            selected
          >
            {WETH_TOKEN.symbol}
          </option>
        </select>
      </div>
      <hr />
      <footer class="pi-1">
        <button
          type="submit"
          disabled={formTrade.busy}
        >
          Request quote
        </button>
      </footer>
      {quote() && (
        <>
          <hr />
          <div>
            <pre data-status="success">quote: {quote()}</pre>
          </div>
        </>
      )}
      {error() && (
        <>
          <hr />
          <div>
            <pre data-status="error">{error()}</pre>
          </div>
        </>
      )}
    </form>
  )
}
