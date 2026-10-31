import type { ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingCart, Tag, User } from 'lucide-react'
import { useLogout } from '@/api/queries'
import { MobileTopBar } from '@/components/common/PageBits'
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
  const item = (active: boolean) =>
    cn('flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left text-xs text-primary transition hover:bg-accent/60', active ? 'border-primary bg-accent/40' : 'border-transparent')
  return (
    <>
      <MobileTopBar title={title} />
      <div className="container-k grid gap-8 pt-2 md:grid-cols-[230px_1fr] md:pt-6 lg:grid-cols-[260px_1fr] lg:gap-12">
        <nav aria-label="Meu perfil" className="h-fit rounded-sm bg-card py-3">
          <p className="px-3 pb-2 text-sm font-bold">Meu perfil</p>
          <ul>
            <li><Link to="/profile" className={item(pathname === '/profile')} aria-current={pathname === '/profile' ? 'page' : undefined}><User className="size-4" /> Dados do perfil</Link></li>
            <li><Link to="/wallets" className={item(pathname === '/wallets')} aria-current={pathname === '/wallets' ? 'page' : undefined}><MapPin className="size-4" /> Carteiras</Link></li>
            {SOON.map(([label, Icon]) => (
              <li key={label}>
                <button type="button" className={item(false)} onClick={() => soon(`A seção “${label}”`)}><Icon className="size-4" /> {label}</button>
              </li>
            ))}
            <li className="mt-1 border-t border-border">
              <button type="button" className={cn(item(false), 'font-bold')} onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut className="size-4" /> Sair</button>
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
