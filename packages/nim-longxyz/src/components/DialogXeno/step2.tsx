import { createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { addXenoSteps, setXenoPrompt, xeno } from '~/stores/xeno'
import styles from './styles.module.css'

type Props = JSX.HTMLAttributes<HTMLFieldSetElement>

export default function (props: Props) {
  const [ref, setRef] = createSignal<HTMLInputElement>()

  function focus() {
    requestAnimationFrame(() => ref()?.focus())
  }

  onMount(() => {
    focus()
    document.addEventListener('click', focus)
    document.addEventListener('keyup', focus)
  })

  onCleanup(() => {
    document.removeEventListener('click', focus)
    document.removeEventListener('keyup', focus)
  })

  function inlineSize() {
    return `${(xeno.prompt.length || 1) + 3}ch`
  }

  return (
    <fieldset {...props}>
      <legend>
        {`>`} Write your prompt then press <kbd>Enter</kbd>
      </legend>

      <p class={styles.option}>
        <input
          ref={setRef}
          type="text"
          name="gen_meme_prompt"
          id="gen_meme_prompt"
          style={{ 'inline-size': inlineSize() }}
          onInput={e => {
            if (e.currentTarget.value.length >= 100) {
              ref()!.value = xeno.prompt
              return
            }

            setXenoPrompt(e.currentTarget.value)
          }}
          value={xeno.prompt}
          onKeyUp={e => {
            if (e.key === 'Enter') {
              addXenoSteps('step3')
            }
          }}
        />
        <small>{100 - xeno.prompt.length} characters left</small>
      </p>
    </fieldset>
  )
}
