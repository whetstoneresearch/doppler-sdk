import { For, Portal } from 'solid-js/web'
import { toastrs, removeToastr } from '~/stores/toastrs'
import styles from './styles.module.css'

export default function Toastr() {
  return (
    <Portal>
      <section
        role="status"
        class={styles.toastr}
      >
        <For each={toastrs()}>
          {toastr => (
            <output
              data-status={toastr.level}
              data-icon={!!toastr.icon}
            >
              {toastr.icon && <span class={styles.icon}>{toastr.icon}</span>}
              <div>{toastr.content}</div>
              {toastr.canClose !== false && (
                <button
                  onClick={() => removeToastr(toastr.id)}
                  class={styles.close}
                >
                  <Icon />
                </button>
              )}
            </output>
          )}
        </For>
      </section>
    </Portal>
  )
}

function Icon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 12 12"
    >
      <path
        fill="currentColor"
        d="m1.897 2.054l.073-.084a.75.75 0 0 1 .976-.073l.084.073L6 4.939l2.97-2.97a.75.75 0 1 1 1.06 1.061L7.061 6l2.97 2.97a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073L6 7.061l-2.97 2.97A.75.75 0 1 1 1.97 8.97L4.939 6l-2.97-2.97a.75.75 0 0 1-.072-.976l.073-.084z"
      />
    </svg>
  )
}
