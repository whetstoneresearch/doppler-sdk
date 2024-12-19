import type { UseWalletsInterface } from '@privy-io/react-auth'
import { createSignal } from 'solid-js'

const walletSignal = createSignal<UseWalletsInterface>()

export const [, setWallet] = walletSignal

export function wallet() {
  return walletSignal[0]()?.wallets[0]
}
