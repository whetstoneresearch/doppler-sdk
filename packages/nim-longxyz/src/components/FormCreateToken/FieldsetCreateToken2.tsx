import type { JSX } from 'solid-js'
import { xeno } from '~/stores/xeno'

type Props = JSX.HTMLAttributes<HTMLFieldSetElement>

export default function (props: Props) {
  const [terminal] = xeno.dialog

  return (
    <fieldset
      {...props}
      id="form-create-fieldset-2"
      // aria-invalid={!!errors.memeUrl}
    >
      <legend>part 2 // token info</legend>

      <label for="upload_file">
        Upload your image
        <small>JPG/PNG/WEBP/GIF</small>
        <input
          type="file"
          id="upload_file"
          class="sr-only"
        />
      </label>

      <p>or</p>

      <button
        type="button"
        onClick={() => {
          console.log('> click', terminal())
          if (!terminal()) {
            return
          }

          terminal()?.showModal()
        }}
      >
        Generate with Xeno
      </button>

      {xeno.memeUrl && (
        <img
          src={xeno.memeUrl}
          class="preview"
          height={300}
          width={300}
        />
      )}
      {/* {errors.memeUrl && <output>{errors.memeUrl}</output>} */}
    </fieldset>
  )
}
