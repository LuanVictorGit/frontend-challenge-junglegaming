import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthView } from '@/components/auth/AuthView'
import { safeRedirect, session } from '@/lib/session'

export const Route = createFileRoute('/register')({
  validateSearch: z.object({ redirect: z.string().max(300).optional().catch(undefined) }),
  beforeLoad: ({ search }) => {
    if (session.get()) throw redirect({ to: safeRedirect(search.redirect) })
  },
  component: RegisterPage,
})

function RegisterPage() {
  return <AuthView mode="register" redirect={Route.useSearch().redirect} />
}
