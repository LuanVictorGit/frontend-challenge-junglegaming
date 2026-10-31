// Accessible announcements for async updates (mutations, realtime changes) via a polite live region.
import { useEffect, useState } from 'react'

const listeners = new Set<(msg: string) => void>()
export const announce = (msg: string) => listeners.forEach((f) => f(msg))

export function LiveRegion() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const f = (m: string) => {
      setMsg('')
      requestAnimationFrame(() => setMsg(m)) // re-set so repeated messages are read again
    }
    listeners.add(f)
    return () => void listeners.delete(f)
  }, [])
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
      {msg}
    </div>
  )
}
