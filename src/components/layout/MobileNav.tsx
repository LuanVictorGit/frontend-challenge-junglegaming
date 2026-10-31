import { Link, useLocation } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useCart } from '@/api/queries'
import { useSession } from '@/lib/session'
import { cn, soon } from '@/lib/utils'
import { CartBadge } from './Header'
import { SearchDialog } from './SearchDialog'

const item = (active: boolean) => cn('relative grid size-11 place-items-center rounded-full', active ? 'text-primary' : 'text-foreground/80')

/** Bottom navigation from the mobile frames (with the floating explore button). */
export function MobileNav() {
  const { pathname } = useLocation()
  const s = useSession()
  const count = useCart().data?.count ?? 0
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-16 max-w-lg items-center justify-around rounded-t-3xl bg-card px-4 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
        <Link to="/" className={item(pathname === '/')} aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined}>
          <House className={cn('size-5', pathname === '/' && 'fill-primary')} />
        </Link>
        <button type="button" className={item(false)} aria-label="Lista de interesse" onClick={() => soon('A lista de interesse')}>
          <Heart className="size-5" />
        </button>
        <span className="w-14" aria-hidden="true" />
        <Link to="/cart" className={item(pathname === '/cart')} aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`}>
          <ShoppingCart className="size-5" />
          {count > 0 && <CartBadge count={count} />}
        </Link>
        <Link to={s ? '/profile' : '/login'} className={item(/^\/(profile|wallets|login)/.test(pathname))} aria-label={s ? 'Meu perfil' : 'Entrar'}>
          <User className="size-5" />
        </Link>
        <SearchDialog
          trigger={
            <button
              type="button"
              aria-label="Explorar coleções"
              className="absolute -top-6 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-linear-to-b from-[#d9935a] to-[#b8743f] text-primary-foreground shadow-lg ring-8 ring-background"
            >
              <ScanLine className="size-6" />
            </button>
          }
        />
      </div>
    </nav>
  )
}
