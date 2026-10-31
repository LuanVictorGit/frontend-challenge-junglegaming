import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { sessionEvents } from '@/api/http'
import { clearPrivate, useSessionCheck } from '@/api/queries'

/** Session expiry anywhere: drop private caches and send private routes back to login, keeping the return path. */
export function SessionWatcher() {
  const qc = useQueryClient()
  const router = useRouter()
  useSessionCheck()
  useEffect(() => {
    const onExpired = (ev: Event) => {
      clearPrivate(qc)
      const expired = (ev as CustomEvent).detail === 'SESSION_EXPIRED'
      toast.error(expired ? 'Sua sessão expirou. Entre novamente para continuar.' : 'Sessão inválida. Entre novamente.', { id: 'session' })
      const { location, matches } = router.state
      if (matches.some((m) => m.routeId.startsWith('/_auth'))) router.navigate({ to: '/login', search: { redirect: location.href }, replace: true })
    }
    sessionEvents.addEventListener('expired', onExpired)
    return () => sessionEvents.removeEventListener('expired', onExpired)
  }, [qc, router])
  return null
}
