import { isAuth, isReady, login, logout } from '~/stores/user'
import styles from './styles.module.css'
import { privy } from '~/stores/privy'

export default function () {
  return (
    <>
      {isReady() && !isAuth() && (
        <button
          type="button"
          onClick={() => privy()?.login()}
          class={styles.button}
        >
          Connect
        </button>
      )}
      {isReady() && isAuth() && (
        <button
          type="button"
          onClick={() => logout()}
          class={styles.button}
        >
          Disconnect
        </button>
      )}
    </>
  )
}
