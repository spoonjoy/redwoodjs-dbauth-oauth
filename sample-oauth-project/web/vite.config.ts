import dns from 'dns'

import { defineConfig, UserConfig } from 'vite'

// See: https://vitejs.dev/config/server-options.html#server-host
// So that Vite will load on local instead of 127.0.0.1
dns.setDefaultResultOrder('verbatim')

import redwood from '@redwoodjs/vite'

const isProd = process.env.NODE_ENV === 'production'

/**
 * https://vitejs.dev/config/
 * @type {import('vite').UserConfig}
 */
const viteConfig: UserConfig = {
  optimizeDeps: {
    force: true,
  },
  plugins: [redwood()],
  server: {
    https: isProd
      ? undefined
      : {
          key: '../certs/local.spoonjoy.app-key.pem',
          cert: '../certs/local.spoonjoy.app.pem',
        },
  },
}

export default defineConfig(viteConfig)
