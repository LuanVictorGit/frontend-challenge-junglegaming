import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const src = (p = '') => fileURLToPath(new URL(`./src${p}`, import.meta.url))

// Inline the (single) stylesheet into index.html: no render-blocking CSS request on first paint.
const inlineCss = (): Plugin => ({
  name: 'kurio:inline-css',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html']
    if (html?.type !== 'asset') return
    let source = String(html.source)
    for (const [file, asset] of Object.entries(bundle)) {
      if (asset.type !== 'asset' || !file.endsWith('.css')) continue
      const link = new RegExp(`<link rel="stylesheet"[^>]*href="/${file}"[^>]*>`)
      if (!link.test(source)) continue
      source = source.replace(link, () => `<style>${asset.source}</style>`)
      delete bundle[file]
    }
    html.source = source
  },
})

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    inlineCss(),
  ],
  resolve: {
    alias: [
      { find: /^tough-cookie$/, replacement: src('/mocks/tough-cookie-shim.ts') },
      { find: '@', replacement: src() },
    ],
  },
  build: { sourcemap: true },
})
