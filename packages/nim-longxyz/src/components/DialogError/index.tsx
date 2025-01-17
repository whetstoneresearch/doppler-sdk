import styles from './styles.module.css'
import { type JSX } from 'solid-js'
import { dialogError, setDialogError } from '~/stores/dialogs'

type Props = JSX.HTMLAttributes<HTMLDialogElement> & {
  error: any
  title?: string
}

export default function ({ error, title }: Props) {
  return (
    <dialog
      ref={setDialogError}
      class={styles.dialog}
    >
      <header>{title || error.shortMessage.toString() || `An error occured`}</header>
      <pre>{error.toString() || error}</pre>
      <footer>
        <button onClick={() => dialogError()?.close()}>close</button>
      </footer>
    </dialog>
  )
}
