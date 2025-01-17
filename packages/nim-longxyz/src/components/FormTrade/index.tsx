import type { ParentProps } from 'solid-js'
import { formTrade } from './service'

export default function FormTrade({ children, ...props }: ParentProps) {
  return (
    <form
      {...props}
      onSubmit={e => {
        e.preventDefault()

        console.log('> submitted')
      }}
      inert={formTrade.busy}
    >
      {children}
      <button
        type="submit"
        disabled={formTrade.busy}
      >
        submit
      </button>
    </form>
  )
}
