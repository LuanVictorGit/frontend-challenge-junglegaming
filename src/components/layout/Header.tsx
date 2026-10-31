import { Link, useLocation } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { useCart } from '@/api/queries'
import { Logo } from '@/components/common/Brand'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session'
import { cn, soon } from '@/lib/utils'
import { SearchDialog } from './SearchDialog'

const navCls = (active: boolean) =>
  cn('relative flex h-[68px] items-center hover:text-primary', active && 'font-semibold text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary')

export function CartBadge({ count }: { count: number }) {
  return (
    <span key={count} aria-hidden="true" className="absolute -top-1.5 -right-2 grid size-4 animate-pop place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export function Avatar({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return url ? (
    <img src={url} alt="" className={cn('size-8 rounded-full object-cover', className)} />
  ) : (
    <span aria-hidden="true" className={cn('grid size-8 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary uppercase', className)}>
      {name.slice(0, 2)}
    </span>
  )
}

export function Header() {
  const s = useSession()
  const loc = useLocation()
  const count = useCart().data?.count ?? 0
  const market = /^\/(nft|cart|checkout|orders)/.test(loc.pathname)
  return (
    <header className="hidden md:block">
      <div className="container-k">
        <div className="flex h-[68px] items-center justify-between border-b border-border">
          <Link to="/" aria-label="Kurio, página inicial">
            <Logo className="text-sm" />
          </Link>
          <nav aria-label="Principal">
            <ul className="flex gap-10 text-base">
              <li>
                <Link to="/" aria-current={loc.pathname === '/' ? 'page' : undefined} className={navCls(loc.pathname === '/')}>Início</Link>
              </li>
              <li>
                <Link to="/" hash="catalogo" className={navCls(market)}>Mercado</Link>
              </li>
              <li>
                <button type="button" className={navCls(false)} onClick={() => soon('A área de criadores')}>Criadores</button>
              </li>
              <li>
                <button type="button" className={navCls(false)} onClick={() => soon('A área Aprenda')}>Aprenda</button>
              </li>
            </ul>
          </nav>
          <div className="flex items-center gap-5">
            <SearchDialog
              trigger={
                <button type="button" aria-label="Buscar NFTs" className="hover:text-primary">
                  <Search className="size-5" />
                </button>
              }
            />
            <Link to="/cart" aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`} className="relative hover:text-primary">
              <ShoppingCart className="size-5" />
              <CartBadge count={count} />
            </Link>
            {s ? (
              <Link to="/profile" className="rounded-full">
                <span className="sr-only">Meu perfil</span>
                <Avatar url={s.user.avatarUrl} name={s.user.displayName} />
              </Link>
            ) : (
              <Button asChild size="sm" className="h-8 px-2.5 text-sm">
                <Link to="/login" search={{ redirect: loc.pathname === '/login' ? undefined : loc.href }}>
                  <LogIn /> Entrar
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
