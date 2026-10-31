import type { ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingCart, Tag, User } from 'lucide-react'
import { useLogout } from '@/api/queries'
import { MobileTopBar } from '@/components/common/PageBits'
import { arrowNav } from '@/lib/arrow-nav'
import { cn, soon } from '@/lib/utils'

// Out-of-scope sections stay visible (Figma) but explain they are unavailable.
const SOON = [
  ['Atividade', ShoppingCart],
  ['Lista de interesse', Heart],
  ['Ofertas', Tag],
  ['Arquivos baixados', Download],
  ['Suporte', LifeBuoy],
] as const

/** "Meu perfil" sidebar + content (Figma: Perfil do Colecionador / Carteiras). */
export function AccountShell({ title, hideTitle, children }: { title: string; hideTitle?: boolean; children: ReactNode }) {
  const { pathname } = useLocation()
  const logout = useLogout()
  // Mobile: horizontal chip row (the form stays above the fold); desktop: sidebar as in the Figma.
  const item = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs whitespace-nowrap text-primary transition hover:bg-accent/60 max-md:rounded-full max-md:border md:border-l-2',
      active ? 'border-primary bg-accent/40' : 'max-md:border-border md:border-transparent',
    )
  return (
    <>
      <MobileTopBar title={title} />
      <div className="container-k grid grid-cols-[minmax(0,1fr)] gap-8 pt-2 md:grid-cols-[230px_minmax(0,1fr)] md:pt-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Meu perfil" className="h-fit min-w-0 rounded-sm md:bg-card md:py-3">
          <p className="hidden px-3 pb-2 text-sm font-bold md:block">Meu perfil</p>
          <ul onKeyDown={(e) => arrowNav(e, { orientation: 'both' })} className="scrollbar-none flex gap-2 overflow-x-auto max-md:-mx-6 max-md:px-6 md:block">
            <li><Link to="/profile" data-roving className={item(pathname === '/profile')} aria-current={pathname === '/profile' ? 'page' : undefined}><User className="size-4" /> Dados do perfil</Link></li>
            <li><Link to="/wallets" data-roving className={item(pathname === '/wallets')} aria-current={pathname === '/wallets' ? 'page' : undefined}><MapPin className="size-4" /> Carteiras</Link></li>
            {SOON.map(([label, Icon]) => (
              <li key={label}>
                <button type="button" data-roving className={item(false)} onClick={() => soon(`A seção “${label}”`)}><Icon className="size-4" /> {label}</button>
              </li>
            ))}
            <li className="md:mt-1 md:border-t md:border-border">
              <button type="button" data-roving className={cn(item(false), 'font-bold')} onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut className="size-4" /> Sair</button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <h1 className={cn('hidden text-sm font-bold md:block', hideTitle && 'md:sr-only')}>{title}</h1>
          {children}
        </div>
      </div>
    </>
  )
}
