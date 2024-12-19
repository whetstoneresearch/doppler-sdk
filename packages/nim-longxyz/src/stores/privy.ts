import { createSignal } from 'solid-js'
import type { PrivyInterface } from '@privy-io/react-auth'

const privySignal = createSignal<PrivyInterface>()

export const [privy, setPrivy] = privySignal
