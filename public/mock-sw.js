/* global importScripts */
// Mock backend worker: MSW only sees API calls; same-origin static assets skip the round trip through the page.
addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin === location.origin && !url.pathname.startsWith('/api/')) event.stopImmediatePropagation()
})
importScripts('./mockServiceWorker.js')
