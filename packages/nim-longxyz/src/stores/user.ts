import { createEffect } from 'solid-js'
import { privy } from './privy'

export function isReady() {
  return privy()?.ready
}

export function isAuth() {
  if (!privy()?.ready || privy()?.authenticated === undefined) {
    return null
  }
  return !!privy()?.authenticated
}

export function user() {
  return privy()?.user
}

export async function login(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // trigger login
      privy()?.login()

      // track any changes
      setInterval(() => {
        if (privy()?.authenticated) {
          return resolve(void 0)
        }

        if (!privy()?.isModalOpen) {
          return reject(new Error('Login modal closed.'))
        }
      }, 1_000)

      // exist if login takes too long
      setTimeout(() => reject(new Error(`Login timeout`)), 60_000)
    } catch (e) {
      reject(e)
    }
  })
}

export function logout() {
  return privy()?.logout()
}
