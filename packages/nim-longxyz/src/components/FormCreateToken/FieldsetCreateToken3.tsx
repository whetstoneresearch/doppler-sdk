/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js'

type Props = JSX.HTMLAttributes<HTMLFieldSetElement>

export default function (props: Props) {
  return (
    <fieldset {...props} id="form-create-fieldset-3">
      <legend>part 3 // social links</legend>

      <label for={`social_x`}>X link</label>
      <input
        type="text"
        id={`social_x`}
        name={`social_x`}
      />

      <label for={`social_telegram`}>Telegram link</label>
      <input
        type="text"
        id={`social_telegram`}
        name={`social_telegram`}
      />

      <label for={`social_website`}>Website link</label>
      <input
        type="text"
        id={`social_website`}
        name={`social_website`}
      />

      <label for={`social_other`}>Other</label>
      <input
        id={`social_other`}
        name={`social_other`}
        type="text"
      />
    </fieldset>
  )
}
