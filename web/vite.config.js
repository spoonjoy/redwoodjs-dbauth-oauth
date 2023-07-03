import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    minify: false,
    lib: {
      entry: 'src/index.ts',
      name: '@spoonjoy/redwoodjs-dbauth-oauth-web',
      fileName: 'redwoodjs-dbauth-oauth-web',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@redwoodjs/router', '@redwoodjs/core'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },
  plugins: [dts()],
})
