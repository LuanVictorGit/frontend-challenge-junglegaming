import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { useAddToCart, useFavorites, useToggleFavorite } from '@/api/queries'
import { NftImage } from '@/components/common/NftImage'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

/** Favorite toggle shared by cards and the detail page (guests are sent to login and back). */
export function useFavoriteToggle(nft: Pick<NftSummary, 'id' | 'name'>) {
  const s = useSession()
  const router = useRouter()
  const favs = useFavorites()
  const toggle = useToggleFavorite()
  const on = !!favs.data?.ids.includes(nft.id)
  const [toggled, setToggled] = useState(false) // the pop animation runs on user toggles only
  return {
    on,
    pop: toggled && on,
    toggle: () => {
      if (!s) return router.navigate({ to: '/login', search: { redirect: router.state.location.href } })
      setToggled(true)
      toggle.mutate({ id: nft.id, on: !on, name: nft.name })
    },
  }
}

export function Price({ value, compareAt, className }: { value: string; compareAt?: string | null; className?: string }) {
  return (
    <p className={cn('font-bold text-primary', className)}>
      {formatEth(value)} ETH
      {compareAt && (
        <s className="ml-2 font-normal text-muted-foreground">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAt)} ETH
        </s>
      )}
    </p>
  )
}

const iconBtn = 'grid size-9 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur transition hover:text-primary'
// The whole card is outlined while its main link has keyboard focus.
const cardFocus = 'rounded-xl outline-offset-4 has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-solid has-[[data-card-link]:focus-visible]:outline-ring'

/**
 * NFT card. In a collection (useCardGrid) only the active card is `tabbable`; its main link comes first in the DOM
 * (CSS `order` keeps the Figma layout), so Tab goes card → its quick actions → next section.
 */
export function NftCard({ nft, priority, index = 0, sizes = '(min-width: 768px) 258px, calc(50vw - 30px)', tabbable = true, className }: { nft: NftSummary; priority?: boolean; index?: number; sizes?: string; tabbable?: boolean; className?: string }) {
  const fav = useFavoriteToggle(nft)
  const add = useAddToCart()
  const to = { to: '/nft/$id', params: { id: nft.id } } as const
  const tab = tabbable ? 0 : -1
  return (
    <article
      className={cn('group relative flex min-w-0 flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300 ease-spring fill-mode-both', cardFocus, className)}
      style={{ animationDelay: `${index < 3 ? 0 : Math.min(index, 6) * 35}ms` }}
      data-testid="nft-card"
    >
      <h3 className="order-2 mt-3 truncate px-1 text-sm md:px-0 md:text-base">
        <Link {...to} data-card-link tabIndex={tab} className="after:absolute after:inset-0 hover:text-primary focus-visible:outline-none md:after:hidden">
          {nft.name}
        </Link>
      </h3>
      <div className="relative order-1 rounded-2xl bg-tile p-1 transition-[transform,box-shadow] duration-300 ease-spring group-focus-within:-translate-y-1 group-hover:-translate-y-1 group-hover:shadow-[0_14px_30px_-14px_rgba(209,138,76,0.45)] md:rounded-sm md:px-1 md:pt-7 md:pb-5">
        {nft.badge && (
          <span className="absolute top-1 left-1 z-10 rounded-tl-xl rounded-br-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground md:rounded-xs">
            {nft.badge}
          </span>
        )}
        <Link {...to} tabIndex={-1} aria-hidden="true" className="block overflow-hidden rounded-xl">
          <NftImage image={nft.image} alt="" sizes={sizes} priority={priority} className="transition-transform duration-500 ease-spring group-hover:scale-[1.05]" />
        </Link>
        {!nft.available && (
          <span className="absolute inset-x-1 bottom-1 rounded-b-xl bg-background/80 py-1 text-center text-xs font-semibold md:bottom-5">Esgotado</span>
        )}
        {/* Mobile: heart over the image (Figma); desktop: quick actions on hover/focus */}
        <button type="button" tabIndex={tab} onClick={fav.toggle} aria-pressed={fav.on} aria-label={`Favoritar ${nft.name}`} className={cn(iconBtn, 'absolute top-2 right-2 z-10 size-8 md:hidden')}>
          <Heart className={cn('size-4', fav.on && 'fill-primary text-primary', fav.pop && 'animate-pop')} />
        </button>
        <div className="absolute inset-x-0 bottom-8 hidden translate-y-2 justify-center gap-2 opacity-0 transition duration-300 ease-spring group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 md:flex [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            tabIndex={tab}
            className={iconBtn}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            disabled={!nft.available || add.isPending}
            onClick={() => add.mutate({ nftId: nft.id, editionId: nft.defaultEditionId, qty: 1 })}
          >
            <ShoppingCart className="size-4" />
          </button>
          <button type="button" tabIndex={tab} className={iconBtn} onClick={fav.toggle} aria-pressed={fav.on} aria-label={`Favoritar ${nft.name}`}>
            <Heart className={cn('size-4', fav.on && 'fill-primary text-primary', fav.pop && 'animate-pop')} />
          </button>
          {/* Mouse shortcut only: the card's main link already opens the NFT */}
          <Link {...to} tabIndex={-1} aria-hidden="true" className={iconBtn}>
            <Search className="size-4" />
          </Link>
        </div>
      </div>
      <Price value={nft.price} compareAt={nft.compareAtPrice} className="order-3 mt-1 px-1 text-sm md:px-0 md:text-lg" />
    </article>
  )
}

export function NftCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('min-w-0', className)} data-testid="nft-card-skeleton">
      <div className="rounded-2xl bg-tile p-1 md:rounded-sm md:px-1 md:pt-7 md:pb-5">
        <Skeleton className="aspect-square w-full rounded-xl" />
      </div>
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2 h-6 w-1/3" />
    </div>
  )
}
