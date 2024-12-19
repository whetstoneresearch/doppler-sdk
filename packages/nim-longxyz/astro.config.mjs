import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import solid from '@astrojs/solid-js'
import basicSsl from '@vitejs/plugin-basic-ssl'
import vercel from '@astrojs/vercel/serverless'

// https://astro.build/config
export default defineConfig({
  prefetch: true,
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    react({ include: ['**/AuthContext.tsx'] }),
    solid({ exclude: ['**/AuthContext.tsx'] }),
  ],
  output: 'server',
  server: {
    port: 443,
    host: true,
  },
  vite: {
    plugins: [basicSsl()],
    server: {
      port: 443,
      host: true
    },
  },
})
