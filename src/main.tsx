import { startTransition, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { markBackendReady, mocksEnabled } from './lib/backend'
import { queryClient, router } from './router'
import './index.css'

// Mock backend boots in parallel with the first render; requests wait for it (see lib/backend.ts).
if (mocksEnabled)
  import('./mocks/browser')
    .then((m) => m.startMocks())
    .catch((e) => console.error('[mocks] failed to start', e))
    .finally(markBackendReady)
// Without mocks, drop a mock worker left by a previous build: a controlled page must always have its MSW client.
else navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()))

// A tab opened before a deploy may ask for chunks that no longer exist: reload once to pick up the new build.
addEventListener('vite:preloadError', (e) => {
  if (Date.now() - Number(sessionStorage.getItem('kurio:reloaded') ?? 0) < 10_000) return // the asset is really gone
  sessionStorage.setItem('kurio:reloaded', String(Date.now()))
  e.preventDefault()
  location.reload()
})

// Transition: the initial render is time-sliced (no single long task blocking the main thread).
const root = createRoot(document.getElementById('root')!)
startTransition(() =>
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  ),
)
