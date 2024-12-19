/** @jsxImportSource solid-js */
import { createSignal, For, onCleanup, onMount, type JSX } from 'solid-js'
import ImageXeno from '~/media/xeno.png'
import styles from './styles.module.css'
import Step1 from './step1'
import Step2 from './step2'
import Step3 from './step3'

import { xeno } from '~/stores/xeno'

type Props = JSX.HTMLAttributes<HTMLDialogElement>

export default function (props: Props) {
  const [terminal, setTerminal] = xeno.dialog
  const [observer, setObserver] = createSignal<MutationObserver>()

  onMount(() => {
    if (!terminal()) {
      return
    }

    setObserver(
      new MutationObserver(() => {
        terminal()?.scrollTo(0, terminal()!.scrollHeight)
      })
    )

    observer()!.observe(terminal()!, {
      attributes: true,
      childList: true,
      subtree: true,
    })
  })

  onCleanup(() => observer()?.disconnect())

  return (
    <dialog
      {...props}
      class={`${styles.dialog} ${styles.nodelay}`}
      ref={setTerminal}
    >
      <h1 class={styles.title}>Generate with Xeno</h1>
      <button
        class={styles.close}
        onClick={() => terminal()?.close()}
      >
        x
      </button>
      <fieldset class={styles.fieldset}>
        <legend class="sr-only">Generate with Xeno</legend>
        <img
          src={ImageXeno.src}
          width="300"
          height="300"
          alt=""
        />
        <p class="mbs-2">Xeno version 1.0.3</p>
        <p>ASCI generative AI, by nim</p>
        <p>Xeno will create your meme based on your inputs.</p>
      </fieldset>

      <For each={xeno.steps}>
        {(step, i) => {
          switch (step) {
            case 'step1':
              return (
                <Step1
                  class={styles.fieldset}
                  inert={i() + 1 !== xeno.steps.length}
                />
              )
            case 'step2':
              return (
                <Step2
                  class={styles.fieldset}
                  inert={i() + 1 !== xeno.steps.length}
                />
              )
            case 'step3':
              return (
                <Step3
                  class={styles.fieldset}
                  inert={i() + 1 !== xeno.steps.length}
                />
              )
          }
        }}
      </For>
    </dialog>
  )
}
