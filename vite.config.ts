import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const src = (p = '') => fileURLToPath(new URL(`./src${p}`, import.meta.url))

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^tough-cookie$/, replacement: src('/mocks/tough-cookie-shim.ts') },
      { find: '@', replacement: src() },
    ],
  },
  build: { sourcemap: true },
})
