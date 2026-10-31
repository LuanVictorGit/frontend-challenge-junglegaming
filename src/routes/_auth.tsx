import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { session } from '@/lib/session'

// Private flows (checkout, orders, profile, wallets). The server re-checks the token on every request.
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ location }) => {
    const s = session.get()
    if (s && Date.parse(s.expiresAt) > Date.now()) return
    if (s) {
      session.set(null)
      toast.error('Sua sessão expirou. Entre novamente para continuar.', { id: 'session' })
    }
    throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: Outlet,
})
