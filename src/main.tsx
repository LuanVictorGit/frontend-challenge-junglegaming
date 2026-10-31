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
