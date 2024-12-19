import type { JSX } from 'solid-js'
import styles from './styles.module.css'
import { addXenoSteps } from '~/stores/xeno'

enum Action {
  custom = 'custom',
  random = 'random',
}

type Props = JSX.HTMLAttributes<HTMLFieldSetElement>

export default function (props: Props) {
  function onNext(e: Action) {
    if (e === 'custom') {
      addXenoSteps('step2')
      return
    }

    addXenoSteps('step3')
  }

  return (
    <fieldset {...props}>
      <legend>{`>`} What do you want for your generation?</legend>

      <p class={styles.option}>
        <input
          type="radio"
          name="gen_meme_type"
          id="gen_meme_type_random"
          value={Action.random}
          onKeyUp={e => e.key === 'Enter' && onNext(Action.random)}
          autofocus
        />
        <label
          for="gen_meme_type_random"
          onClick={() => onNext(Action.random)}
        >
          Random, show me what you got!
        </label>
      </p>

      <p class={styles.option}>
        <input
          type="radio"
          name="gen_meme_type"
          id="gen_meme_type_custom"
          value={Action.custom}
          onKeyUp={e => e.key === 'Enter' && onNext(Action.custom)}
        />
        <label
          for="gen_meme_type_custom"
          onClick={() => onNext(Action.custom)}
        >
          I want to type my own prompt
        </label>
      </p>
    </fieldset>
  )
}
