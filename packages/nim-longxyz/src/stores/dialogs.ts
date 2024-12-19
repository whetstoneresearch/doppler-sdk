import { createSignal } from 'solid-js'

const dialogErrorStore = createSignal<HTMLDialogElement>()

export const [dialogError, setDialogError] = dialogErrorStore
