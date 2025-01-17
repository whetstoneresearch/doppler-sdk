/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js'
import { setState, state } from './FormCreateToken.service'

type Props = JSX.HTMLAttributes<HTMLFieldSetElement>

export default function (props: Props) {
  return (
    <fieldset
      {...props}
      id="form-create-fieldset-1"
      // aria-invalid={!!errors.memeUrl}
    >
      <legend>part 1 // token info</legend>

      <label for={`token_name`}>Token name</label>
      <input
        type="text"
        id={`token_name`}
        name={`token_name`}
        onInput={e => {
          const { value } = e.target as HTMLInputElement
          setState('name', { ...state.name, value })

          if (value) {
            setState('name', {
              ...state.name,
              invalid: false,
              errors: [],
            })
          }
        }}
        aria-required
        aria-invalid={!!state.name.invalid}
      />
      {state.name.invalid && (
        <output>{state.name.errors.toLocaleString()}</output>
      )}

      <label for={`token_symbol`}>Token symbol</label>
      <input
        type="text"
        id={`token_symbol`}
        name={`token_symbol`}
        onInput={e => {
          const { value } = e.target as HTMLInputElement
          setState('symbol', { ...state.symbol, value })

          if (value) {
            setState('symbol', {
              ...state.symbol,
              invalid: false,
              errors: [],
            })
          }
        }}
        aria-required
        aria-invalid={!!state.symbol.invalid}
      />
      {state.symbol.invalid && (
        <output>{state.symbol.errors.toLocaleString()}</output>
      )}

      <label for={`token_description`}>Token description</label>
      <textarea
        name={`token_description`}
        // onInput$={e => {
        //   const { value } = e.target as HTMLInputElement
        //   tokenDescription.value = value

        //   if (value) {
        //     errors.tokenDescription = ''
        //   }
        // }}
        // aria-invalid={!!errors.tokenDescription}
      />
      {/* {errors.tokenDescription && <output>{errors.tokenDescription}</output>} */}
    </fieldset>
  )
}
