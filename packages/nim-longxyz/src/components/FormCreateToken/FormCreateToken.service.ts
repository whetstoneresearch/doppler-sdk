import { createStore } from 'solid-js/store'

type InputField = {
  errors: string[]
  invalid?: boolean
  touched: boolean
  value: string
}

type FromCreateToken = TokenFields & {
  hasErrors: boolean
  busy: boolean
}

export type TokenFields = {
  symbol: InputField
  description: InputField
  name: InputField
}

const formCreateStore = createStore<FromCreateToken>({
  busy: false,
  description: {
    errors: [],
    touched: false,
    value: '',
  },
  name: {
    errors: [],
    touched: false,
    value: 'NAME',
  },
  symbol: {
    errors: [],
    touched: false,
    value: 'SYM',
  },
  get hasErrors() {
    return this.name.errors.length > 0 || this.symbol.errors.length > 0
  },
})

export const [state, setState] = formCreateStore

export function validate() {
  if (!state.name.value) {
    setState('name', {
      ...state.name,
      invalid: true,
      errors: ['Must provide a name'],
    })
  } else {
    setState('name', {
      ...state.name,
      invalid: false,
      errors: [],
    })
  }

  if (!state.symbol.value) {
    setState('symbol', {
      ...state.symbol,
      invalid: true,
      errors: ['Must provide a symbol'],
    })
  } else {
    setState('symbol', {
      ...state.symbol,
      invalid: false,
      errors: [],
    })
  }

  if (state.hasErrors) {
    return false
  }

  return true
}
