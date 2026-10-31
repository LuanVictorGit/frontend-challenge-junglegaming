// Session store (useSyncExternalStore). The server stays the authority: it validates token + expiry on every call.
import { useSyncExternalStore } from 'react'
import type { Session } from '@/api/contracts'

const KEY = 'kurio:session'
const CART = 'kurio:cart-id'

const read = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

let current = read()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export const session = {
  get: () => current,
  set(s: Session | null) {
    current = s
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
    emit()
  },
  /** Keep the stored user in sync after profile updates. */
  patchUser(user: Session['user']) {
    if (current) session.set({ ...current, user })
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => void subs.delete(f)
  },
}

export const useSession = () => useSyncExternalStore(session.subscribe, session.get)

/** Server-issued guest cart id (sent as X-Cart-Id). */
export const cartId = {
  get: () => localStorage.getItem(CART),
  set: (id: string) => localStorage.setItem(CART, id),
  clear: () => localStorage.removeItem(CART),
}

/** Only same-origin relative paths are accepted as post-login redirects (prevents open redirects). */
export const safeRedirect = (to?: string | null) => (to && /^\/(?![/\\])/.test(to) ? to : '/')
