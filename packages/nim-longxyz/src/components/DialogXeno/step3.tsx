import ImageSample from '~/media/image.png'
import styles from './styles.module.css'
import { createEffect, createSignal, onMount, type JSX } from 'solid-js'
import { addXenoSteps, resetXenoSteps, setXenoUrl, xeno } from '~/stores/xeno'

export enum Action {
  edit = 'edit',
  again = 'again',
  ok = 'ok',
}

type Props = JSX.HTMLAttributes<HTMLFieldSetElement>

type State = 'generating' | 'success' | 'error'

export default function (props: Props) {
  const [terminal] = xeno.dialog
  const [state, setState] = createSignal<State>('generating')
  const [ref, setRef] = createSignal<HTMLInputElement>()
  const [url, setUrl] = createSignal('')

  function onNext(next: Action) {
    requestAnimationFrame(() => {
      if (next === Action.again) {
        addXenoSteps(xeno.steps.at(-1)!)
        return
      }
      if (next === Action.edit) {
        addXenoSteps('step2')
        return
      }
      if (next === Action.ok) {
        setXenoUrl(url())
        resetXenoSteps()
        terminal()?.close()
        return
      }
    })
  }

  // dev purpose
  // @todo state against fetching
  // @todo set generated image URL
  onMount(() =>
    setTimeout(() => {
      setState('success')
      setUrl(ImageSample.src)
    }, 5_000)
  )

  createEffect(() => {
    if (state() === 'generating') {
      return
    }

    requestAnimationFrame(() => ref()?.focus())
  })

  return (
    <>
      <fieldset class={props.class}>
        <legend>Generating meme {state() === 'generating' && <Dots />}</legend>
        <p class={styles.nodelay}>Generation done in 3.5sec</p>
        <p class={`${styles.nodelay} ${styles.meme}`}>
          <img
            src={ImageSample.src}
            height={300}
            width={300}
            alt=""
            aria-busy={state() === 'generating'}
          />
          {state() === 'success' && (
            <button
              onClick={() => onNext(Action.ok)}
              class={styles.use}
            >
              Use as meme
            </button>
          )}
        </p>
      </fieldset>

      {state() !== 'generating' && (
        <fieldset {...props}>
          <legend>Do you want to go with this generation?</legend>

          <p class={styles.option}>
            <input
              ref={setRef}
              type="radio"
              name="end"
              id="end_yes"
              onKeyUp={e => e.key === 'Enter' && onNext(Action.ok)}
              checked
            />
            <label
              for="end_yes"
              onClick={() => onNext(Action.ok)}
            >
              Yes
            </label>
          </p>

          <p class={styles.option}>
            <input
              type="radio"
              name="end"
              id="end_no_again"
              onKeyUp={e => e.key === 'Enter' && onNext(Action.again)}
            />
            <label
              for="end_no_again"
              onClick={() => onNext(Action.again)}
            >
              No, regenerate
            </label>
          </p>

          <p class={styles.option}>
            <input
              type="radio"
              name="end"
              id="end_no_edit"
              onKeyUp={e => e.key === 'Enter' && onNext(Action.edit)}
            />
            <label
              for="end_no_edit"
              onClick={() => onNext(Action.edit)}
            >
              No, edit my prompt
            </label>
          </p>
        </fieldset>
      )}
    </>
  )
}

function Dots() {
  const [dots, setDots] = createSignal('')

  // DEV purpose
  // @todo dots against fetching
  onMount(() => {
    const int = setInterval(() => {
      if (dots().length >= 3) {
        setDots('.')
        return
      }

      setDots(`${dots()}.`)
    }, 500)

    setTimeout(() => clearInterval(int), 5_000)
  })

  return <>{dots()}</>
}
