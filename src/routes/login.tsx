import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthView } from '@/components/auth/AuthView'
import { safeRedirect, session } from '@/lib/session'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().max(300).optional().catch(undefined) }),
  beforeLoad: ({ search }) => {
    if (session.get()) throw redirect({ to: safeRedirect(search.redirect) })
  },
  component: LoginPage,
})

function LoginPage() {
  return <AuthView mode="login" redirect={Route.useSearch().redirect} />
}
