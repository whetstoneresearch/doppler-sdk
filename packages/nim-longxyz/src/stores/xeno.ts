import { createSignal, type Signal } from 'solid-js'
import { createStore } from 'solid-js/store'

export type Step = 'step1' | 'step2' | 'step3'

type Xeno = {
  steps: Step[]
  prompt: string
  dialog: Signal<HTMLDialogElement | undefined>
  memeUrl: string | null
}

const storeCreating = createStore<Xeno>({
  steps: ['step1'],
  prompt: '',
  dialog: createSignal<HTMLDialogElement>(),
  memeUrl: null,
})

export const [xeno, setXeno] = storeCreating

export function addXenoSteps(step: Step) {
  setXeno('steps', [...xeno.steps, step])
}

export function resetXenoSteps() {
  setXeno('steps', ['step1'])
}

export function setXenoPrompt(prompt: string) {
  setXeno('prompt', prompt)
}

export function setXenoUrl(url: string) {
  setXeno('memeUrl', url)
}
