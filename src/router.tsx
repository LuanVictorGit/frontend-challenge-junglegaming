import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { ApiError } from './api/http'
import { routeTree } from './routeTree.gen'

// Cache policy (documented in ARCHITECTURE.md): 30s fresh data, 2 retries for transient failures only.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (n, e) => e instanceof ApiError && e.retryable && n < 2,
      retryDelay: (n) => Math.min(800 * 2 ** n, 4_000),
    },
    mutations: { retry: false },
  },
})

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
