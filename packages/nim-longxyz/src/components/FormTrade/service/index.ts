import { createStore } from 'solid-js/store'

type InputField = {
  quote_value: number
}

type FormTrade = InputField & {
  busy: boolean
}

const formTradeStore = createStore<FormTrade>({
  quote_value: 1000,
  busy: false,
})

export const [formTrade, setFormTrade] = formTradeStore
