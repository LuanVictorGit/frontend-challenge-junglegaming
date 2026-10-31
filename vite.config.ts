import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const src = (p = '') => fileURLToPath(new URL(`./src${p}`, import.meta.url))

// Inline the (single) stylesheet into index.html: no render-blocking CSS request on first paint.
// The file is still emitted: Vite lists the entry CSS among the preload deps of some lazy chunks.
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
      source = source.replace(new RegExp(`<link rel="stylesheet"[^>]*href="/${file}"[^>]*>`), () => `<style>${asset.source}</style>`)
    }
    html.source = source
  },
})

// The mock backend gates every request: fetch its chunk in parallel with the entry (modulepreload).
const preloadMocks = (): Plugin => ({
  name: 'kurio:preload-mocks',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html']
    const mocks = Object.values(bundle).find((c) => c.type === 'chunk' && /[\\/]src[\\/]mocks[\\/]browser\.ts$/.test(c.facadeModuleId ?? ''))
    if (html?.type !== 'asset' || !mocks) return
    html.source = String(html.source).replace('</head>', `  <link rel="modulepreload" crossorigin href="/${mocks.fileName}">\n  </head>`)
  },
})

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    inlineCss(),
    preloadMocks(),
  ],
  resolve: {
    alias: [
      { find: /^tough-cookie$/, replacement: src('/mocks/tough-cookie-shim.ts') },
      { find: '@', replacement: src() },
    ],
  },
  build: { sourcemap: true },
  // Same strict MIME checks as production (netlify.toml), so E2E catches assets served with the wrong type.
  preview: { headers: { 'X-Content-Type-Options': 'nosniff' } },
})
