import styles from './styles.module.css'
import { type JSX } from 'solid-js'
import { dialogError, setDialogError } from '~/stores/dialogs'

type Props = JSX.HTMLAttributes<HTMLDialogElement> & {
  error: any
  title?: string
}

export default function ({ error, title }: Props) {
  function heading() {
    return title || error.shortMessage?.toString() || `An error occured`
  }

  function body() {
    return error?.toString() || error
  }

  return (
    <dialog
      ref={setDialogError}
      class={styles.dialog}
    >
      <header>{heading()}</header>
      <pre>{body()}</pre>
      <footer>
        <button onClick={() => dialogError()?.close()}>close</button>
      </footer>
    </dialog>
  )
}
