/** @jsxImportSource react */
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth'
import { setPrivy } from './../stores/privy'
import { setWallet } from '~/stores/wallet'

export default function AuthContext() {
  function PrivySetter({ children }: any) {
    const privy = usePrivy()
    setPrivy(privy)

    const wallet = useWallets()
    setWallet(wallet)

    return <>{children}</>
  }

  return (
    <PrivyProvider
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: theme(),
          accentColor: accentColor(),
        },
      }}
      appId={import.meta.env.PUBLIC_PRIVY_APP_ID}
    >
      <PrivySetter />
    </PrivyProvider>
  )
}

function theme() {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  return window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function accentColor() {
  if (typeof window === 'undefined') {
    return '#00ff70'
  }

  return getComputedStyle(window.document.documentElement).getPropertyValue(
    '--color-accent'
  ) as `#${string}`
}
