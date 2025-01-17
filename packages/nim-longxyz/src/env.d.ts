/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_PRIVY_APP_ID: string
  readonly PUBLIC_ALCHEMY_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
