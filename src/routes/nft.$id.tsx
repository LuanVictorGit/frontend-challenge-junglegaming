import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Heart, Mail, ShoppingCart, Star, ZoomIn } from 'lucide-react'
import { NETWORK_LABEL, type Edition, type NftDetail } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { nftQuery, relatedQuery, useAddToCart, useCart } from '@/api/queries'
import { LinkedinIcon, TwitterIcon } from '@/components/common/Brand'
import { NftImage } from '@/components/common/NftImage'
import { Breadcrumb, MobileTopBar, useTitle } from '@/components/common/PageBits'
import { QuantityStepper } from '@/components/common/QuantityStepper'
import { EmptyState, ErrorState } from '@/components/common/States'
import { Price, useFavoriteToggle } from '@/components/nft/NftCard'
import { NftRail } from '@/components/nft/NftRail'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatEth } from '@/lib/eth'
import { cn, formatDate, shortAddress } from '@/lib/utils'

export const Route = createFileRoute('/nft/$id')({
  loader: ({ context: { queryClient }, params }) => {
    queryClient.prefetchQuery(nftQuery(params.id))
    queryClient.prefetchQuery(relatedQuery(params.id))
  },
  component: NftPage,
})

// Gallery "views": framed crops of the single artwork the Figma provides per NFT.
const VIEWS = [
  { label: 'Obra completa', style: {} },
  { label: 'Detalhe do rosto', style: { transform: 'scale(1.7)', transformOrigin: '50% 30%' } },
  { label: 'Detalhe do figurino', style: { transform: 'scale(1.8)', transformOrigin: '50% 95%' } },
  { label: 'Detalhe lateral', style: { transform: 'scale(1.5)', transformOrigin: '15% 50%' } },
]

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex', className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3.5', i < Math.round(rating) ? 'fill-primary text-primary' : 'text-muted-foreground')} />
      ))}
    </span>
  )
}

function NftPage() {
  const { id } = Route.useParams()
  const q = useQuery(nftQuery(id))
  const related = useQuery(relatedQuery(id))
  useTitle(q.data?.name ?? (q.isError ? 'NFT não encontrado' : 'Carregando NFT'))
  if (q.isPending) return <DetailSkeleton />
  if (q.isError)
    return (
      <div className="container-k py-16">
        {q.error instanceof ApiError && q.error.status === 404 ? (
          <EmptyState
            title="NFT não encontrado"
            message="Este NFT não existe ou foi removido do mercado."
            action={
              <Button asChild>
                <Link to="/">Voltar ao catálogo</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        )}
      </div>
    )
  return (
    <>
      <Detail key={q.data.id} nft={q.data} />
      <NftRail title="Mais desta coleção" items={related.data} loading={related.isPending} />
    </>
  )
}

function Detail({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const fav = useFavoriteToggle(nft)
  const add = useAddToCart()
  const cart = useCart()
  const firstAvailable = nft.editions.find((e) => e.id === nft.defaultEditionId && e.stock > 0) ?? nft.editions.find((e) => e.stock > 0)
  const [editionId, setEditionId] = useState(firstAvailable?.id ?? nft.defaultEditionId)
  const [qty, setQty] = useState(1)
  const [view, setView] = useState(0)
  const [zoom, setZoom] = useState(false)
  const zoomBtn = useRef<HTMLButtonElement>(null)

  const edition = nft.editions.find((e) => e.id === editionId)!
  const inCart = cart.data?.items.find((i) => i.nftId === nft.id && i.editionId === editionId)?.qty ?? 0
  const max = Math.max(0, Math.min(edition.stock, edition.maxPerOrder) - inCart)
  const soldOut = edition.stock === 0
  const blocked = soldOut || max === 0
  const amount = Math.min(qty, Math.max(1, max))
  const buy = (go: boolean) =>
    add.mutate({ nftId: nft.id, editionId, qty: amount }, { onSuccess: () => (go ? navigate({ to: '/cart' }) : setQty(1)) })

  const share = encodeURIComponent(typeof location === 'undefined' ? '' : location.href)
  const info = (
    <dl className="space-y-2.5 text-sm text-sand">
      <div><dt className="inline">ID do token: </dt><dd className="inline">{nft.tokenId}</dd></div>
      <div><dt className="inline">Coleção: </dt><dd className="inline">{nft.collection}</dd></div>
      <div><dt className="inline">Atributos: </dt><dd className="inline">{nft.attributes.join(', ')}</dd></div>
    </dl>
  )
  const editions = (
    <fieldset>
      <legend className="text-sm font-bold">Edição:</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {nft.editions.map((e: Edition) => (
          <label
            key={e.id}
            className={cn(
              'cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              e.id === editionId ? 'border-primary text-primary' : 'text-sand hover:border-primary/60',
              e.stock === 0 && 'cursor-not-allowed line-through opacity-45',
            )}
          >
            <input type="radio" name="edition" value={e.id} className="sr-only" checked={e.id === editionId} disabled={e.stock === 0} onChange={() => (setEditionId(e.id), setQty(1))} />
            {e.label}
            {e.stock === 0 && <span className="sr-only"> (esgotada)</span>}
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground" aria-live="polite">
        {soldOut
          ? 'Edição indisponível: esgotada.'
          : `${edition.supply ? `${edition.stock} de ${edition.supply} disponíveis` : 'Edição aberta'} · até ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}`}
      </p>
    </fieldset>
  )

  return (
    <article>
      <MobileTopBar
        action={
          <button type="button" data-testid="favorite" onClick={fav.toggle} aria-pressed={fav.on} aria-label={`Favoritar ${nft.name}`} className="grid size-9 place-items-center rounded-full bg-card text-primary">
            <Heart className={cn('size-4', fav.on && 'fill-primary', fav.pop && 'animate-pop')} />
          </button>
        }
      />
      <div className="container-k md:pt-5">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: nft.name }]} />
        <div className="md:mt-3 lg:grid lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-10">
          {/* Gallery */}
          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start">
            <ul aria-label="Galeria" className="hidden gap-4 md:flex md:flex-col">
              {VIEWS.map((v, i) => (
                <li key={v.label}>
                  <button type="button" onClick={() => setView(i)} aria-label={v.label} aria-pressed={view === i} className={cn('block w-[100px] overflow-hidden rounded-xs border-2 transition', view === i ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100')}>
                    <span className="block overflow-hidden">
                      <NftImage image={nft.image} alt="" sizes="100px" style={v.style} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative flex-1 overflow-hidden rounded-2xl md:rounded-sm md:bg-tile md:p-3">
              <div className="overflow-hidden rounded-2xl md:rounded-xl">
                <NftImage image={nft.image} alt={`${nft.name} — ${VIEWS[view].label.toLowerCase()}`} sizes="(min-width: 768px) 480px, calc(100vw - 48px)" priority style={VIEWS[view].style} className="transition-transform duration-300" />
              </div>
              <button ref={zoomBtn} type="button" onClick={() => setZoom(true)} aria-label="Ampliar imagem" className="absolute top-5 right-5 hidden size-8 place-items-center rounded-full bg-background/80 md:grid">
                <ZoomIn className="size-4" />
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="relative z-10 -mt-8 rounded-t-3xl bg-card p-5 md:mt-8 md:rounded-none md:bg-transparent md:p-0 lg:mt-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold md:text-[28px]">{nft.name}</h1>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/60 px-2 py-0.5 text-xs md:hidden">
                <Star aria-hidden="true" className="size-3 fill-primary text-primary" /> {nft.rating.toFixed(1)}
                <span className="text-muted-foreground">({nft.reviewCount})</span>
              </span>
            </div>
            <div className="mt-2 hidden flex-wrap items-center justify-between gap-2 md:flex">
              <Price value={edition.price} compareAt={edition.id === nft.defaultEditionId ? nft.compareAtPrice : null} className="text-[22px]" />
              <a href="#avaliacoes" className="inline-flex items-center gap-2 text-xs text-sand hover:text-primary">
                <Stars rating={nft.rating} /> {nft.reviewCount} avaliações de colecionadores
              </a>
            </div>
            <h2 className="mt-5 hidden text-sm font-bold md:block">Sobre este NFT:</h2>
            <p className="mt-3 text-sm leading-relaxed text-sand md:mt-2 md:text-xs">{nft.description}</p>
            <div className="mt-4">{editions}</div>

            {/* Desktop actions */}
            <div className="mt-4 hidden flex-wrap items-center gap-4 md:flex">
              <QuantityStepper value={amount} max={Math.max(1, max)} onChange={setQty} label={nft.name} disabled={blocked} className="[&_button]:size-8" />
              <Button className="ml-auto h-9 w-36" onClick={() => buy(true)} disabled={blocked || add.isPending}>
                {soldOut ? 'ESGOTADA' : max === 0 ? 'LIMITE ATINGIDO' : 'COMPRAR'}
              </Button>
              <Button variant="outline" className="h-9" data-testid="favorite" onClick={fav.toggle} aria-pressed={fav.on}>
                <Heart className={cn(fav.on && 'fill-primary', fav.pop && 'animate-pop')} /> {fav.on ? 'Favoritado' : 'Favoritar'}
              </Button>
            </div>
            <div className="mt-5">{info}</div>
            <div className="mt-4 hidden items-center gap-3 text-sm font-bold md:flex">
              Compartilhar este NFT:
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${share}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (nova aba)" className="hover:text-primary"><LinkedinIcon className="size-4" /></a>
              <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${share}`} aria-label="Compartilhar por e-mail" className="hover:text-primary"><Mail className="size-4" /></a>
              <a href={`https://twitter.com/intent/tweet?url=${share}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Twitter (nova aba)" className="hover:text-primary"><TwitterIcon className="size-4" /></a>
            </div>

            {/* Mobile purchase bar (Figma: Mobile / Detalhes do NFT) */}
            <div className="mt-6 space-y-4 rounded-2xl bg-tile p-4 md:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  Qtd.
                  <QuantityStepper value={amount} max={Math.max(1, max)} onChange={setQty} label={nft.name} disabled={blocked} />
                </div>
                <p className="text-lg font-bold text-primary">{formatEth(edition.price)} ETH</p>
              </div>
              <div className="flex gap-3">
                <Button variant="pill" size="lg" className="flex-1" onClick={() => buy(true)} disabled={blocked || add.isPending}>
                  {soldOut ? 'Esgotada' : max === 0 ? 'Limite atingido' : 'Comprar NFT'}
                </Button>
                <Button variant="secondary" size="icon-lg" className="rounded-full" aria-label="Adicionar ao carrinho" onClick={() => buy(false)} disabled={blocked || add.isPending}>
                  <ShoppingCart className="text-primary" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="details" className="mt-12" id="avaliacoes">
          <TabsList className="scrollbar-none h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
            {[['details', 'Detalhes do NFT', 'Detalhes'], ['reviews', `Avaliações de colecionadores (${nft.reviewCount})`, `Avaliações (${nft.reviewCount})`]].map(([v, l, short]) => (
              <TabsTrigger key={v} value={v} className="flex-none rounded-none border-0 border-b-2 border-transparent px-0 pb-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
                <span className="hidden md:inline">{l}</span>
                <span className="md:hidden">{short}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="details" className="mt-4 space-y-4 text-xs leading-relaxed text-sand motion-safe:animate-in motion-safe:fade-in-0 duration-200">
            {nft.details.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
            <div><h2 className="font-bold text-foreground">Rede:</h2><p>Cunhado na {NETWORK_LABEL[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p></div>
            <div><h2 className="font-bold text-foreground">Contrato:</h2><p>{shortAddress(nft.contract)} • Contrato inteligente ERC-721 verificado.</p></div>
            <div><h2 className="font-bold text-foreground">Direitos autorais:</h2><p>Direitos autorais do criador: {nft.royaltyBps / 100}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p></div>
          </TabsContent>
          <TabsContent value="reviews" className="mt-4 motion-safe:animate-in motion-safe:fade-in-0 duration-200">
            <ul className="space-y-4">
              {nft.reviews.map((r) => (
                <li key={r.id} className="rounded-sm bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">{r.author}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-xs"><Stars rating={r.rating} /><span className="sr-only">{r.rating} de 5 estrelas</span></p>
                  <p className="mt-2 text-xs text-sand">{r.comment}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Exibindo {nft.reviews.length} de {nft.reviewCount} avaliações.</p>
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,720px)] bg-card p-3 sm:max-w-[720px]" onCloseAutoFocus={(e) => (e.preventDefault(), zoomBtn.current?.focus())}>
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada do NFT</DialogDescription>
          <NftImage image={nft.image} alt={nft.name} sizes="720px" className="rounded-md" />
        </DialogContent>
      </Dialog>
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-k pt-5" aria-busy="true" aria-label="Carregando NFT">
      <Skeleton className="hidden h-4 w-48 md:block" />
      <div className="mt-3 md:grid md:grid-cols-[minmax(0,560px)_1fr] md:gap-10">
        <div className="flex gap-3">
          <div className="hidden flex-col gap-3 md:flex">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="size-14" />)}
          </div>
          <Skeleton className="aspect-square flex-1 rounded-2xl" />
        </div>
        <div className="mt-6 space-y-4 md:mt-0">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <Skeleton className="mt-12 h-8 w-full" />
      <div className="mt-4 space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
    </div>
  )
}
