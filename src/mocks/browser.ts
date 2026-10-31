// Boots the mock backend in the browser and exposes a control API (used by Playwright and the README recipes).
import { setupWorker } from 'msw/browser'
import { addFault, setConfig, type Fault, type Scenario } from './config'
import { db, resetDb, save } from './db'
import { handlers } from './handlers'
import { findNft, settleDue, updateNft } from './logic'
import { broadcast, dropSockets, replayLast, socketHandler } from './socket'

const controls = {
  setScenario: (scenario: Scenario) => setConfig({ scenario }),
  setLatency: (min: number, max = min) => setConfig({ latency: [min, max] }),
  /** Restore the seed and clear client state of this origin. */
  reset() {
    resetDb()
    for (const k of Object.keys(localStorage)) if (k.startsWith('kurio:') && k !== 'kurio:mock') localStorage.removeItem(k)
    sessionStorage.clear()
  },
  failNext: (f: Fault) => addFault(f),
  updateNft,
  /** Re-emit the last event (duplicate delivery). */
  replayLastEvent: replayLast,
  /** Emit an outdated `nft.updated` (version - 1) with a bogus price. */
  emitStaleNft(id: string) {
    const n = findNft(id)
    if (!n) return
    broadcast({
      id: `evt_stale_${Date.now()}`, type: 'nft.updated', resource: { type: 'nft', id }, version: n.version - 1, occurredAt: new Date(0).toISOString(),
      data: { name: n.name, price: '999', compareAtPrice: null, available: false, editions: n.editions.map((e) => ({ id: e.id, price: '999', stock: 0 })) },
    })
  },
  /** Close every socket; optionally refuse reconnections for `blockMs`. */
  dropSockets,
  expireSessions() {
    for (const s of Object.values(db.sessions)) s.expiresAt = Date.now() - 1
    save()
  },
}

declare global {
  interface Window {
    __mock?: typeof controls
  }
}

export async function startMocks() {
  // `?reset` restores the known seed (README: scenario selection and reset).
  const url = new URL(location.href)
  if (url.searchParams.has('reset')) {
    controls.reset()
    url.searchParams.delete('reset')
    history.replaceState(history.state, '', url)
  }
  const worker = setupWorker(...handlers, socketHandler)
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: `${import.meta.env.BASE_URL}mock-sw.js` } })
  window.__mock = controls
  setInterval(settleDue, 500) // settles pending orders and publishes order.updated
}
