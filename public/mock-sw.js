/* global importScripts, activeClientIds */
// Mock backend worker wrapping MSW's. Only API calls reach MSW (same-origin static assets skip the round trip
// through the page). Chrome stops idle workers (e.g. while the tab is in the background) and MSW keeps its active
// pages in memory only, so a restarted worker re-admits the page calling the API instead of leaking it to the network.
addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return
  if (!url.pathname.startsWith('/api/')) event.stopImmediatePropagation()
  else if (event.clientId) activeClientIds.add(event.clientId)
})
importScripts('./mockServiceWorker.js')
