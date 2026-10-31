import { useEffect, useRef, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useLocation } from '@tanstack/react-router'
import { ErrorState } from '@/components/common/States'
import { useTitle } from '@/components/common/PageBits'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { SessionWatcher } from '@/components/layout/SessionWatcher'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { LiveRegion } from '@/lib/announce'
import { startRealtime } from '@/lib/realtime'
import { useMedia } from '@/lib/use-media'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <div className="container-k py-16">
      <ErrorState title="Não foi possível carregar esta página" message={error instanceof Error ? error.message : undefined} onRetry={reset} />
    </div>
  ),
})

function Root() {
  const qc = useQueryClient()
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const shown = useRef(pathname)
  // Animate page entries only after the first navigation (keeps the initial paint/LCP instant).
  const [prev, setPrev] = useState(pathname)
  const [animate, setAnimate] = useState(false)
  if (prev !== pathname) {
    setPrev(pathname)
    setAnimate(true)
  }
  const desktop = useMedia('(min-width: 768px)') // mount only the visible chrome
  useEffect(() => startRealtime(qc), [qc])
  // Move focus to the new page on route changes (not on search-param changes).
  useEffect(() => {
    if (shown.current === pathname) return
    shown.current = pathname
    main.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <>
      <a href="#main" className="sr-only z-50 rounded-sm bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      {desktop && <Header />}
      <main id="main" ref={main} tabIndex={-1} className="min-h-dvh outline-none">
        <div key={pathname} className={animate ? 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1.5 duration-300 ease-spring' : undefined}>
          <Outlet />
        </div>
      </main>
      <Footer />
      {!desktop && <MobileNav />}
      <Toaster position="top-center" closeButton mobileOffset={{ top: 64 }} />
      <LiveRegion />
      <SessionWatcher />
    </>
  )
}

function NotFound() {
  useTitle('Página não encontrada')
  return (
    <div className="container-k flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">O endereço acessado não existe ou foi removido.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}
