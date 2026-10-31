import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { z } from 'zod'
import { Category, CATEGORY_LABEL, EthAmount, Network, NETWORK_LABEL, Sort, SORT_LABEL, Tab, type NftList } from '@/api/contracts'
import { highlightsQuery, nftListQuery } from '@/api/queries'
import { NftImage } from '@/components/common/NftImage'
import { EmptyState, ErrorState } from '@/components/common/States'
import { NftCard, NftCardSkeleton } from '@/components/nft/NftCard'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { toWei } from '@/lib/eth'
import { useMedia } from '@/lib/use-media'
import { cn } from '@/lib/utils'

/* ---------- URL state: search, filters, sort and pagination survive refresh/history ---------- */
export const HomeSearch = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  category: Category.optional().catch(undefined),
  network: Network.optional().catch(undefined),
  minPrice: z.coerce.string().pipe(EthAmount).optional().catch(undefined),
  maxPrice: z.coerce.string().pipe(EthAmount).optional().catch(undefined),
  tab: Tab.optional().catch(undefined),
  sort: Sort.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
})
export type HomeSearch = z.infer<typeof HomeSearch>
export const PAGE_SIZE = 9
export const toListParams = (s: HomeSearch) => ({ ...s, tab: s.tab ?? 'all', sort: s.sort ?? 'recent', page: s.page ?? 1, pageSize: PAGE_SIZE })

const TABS: [Tab, string][] = [['all', 'Todos os NFTs'], ['new', 'Novos lançamentos'], ['trending', 'Em alta']]
type Set = (patch: Partial<HomeSearch>) => void

/** Any filter change resets pagination; each change is a history entry. */
function useSetSearch(): Set {
  const navigate = useNavigate()
  return (patch) => navigate({ to: '/', search: (prev: HomeSearch) => ({ ...prev, ...patch, page: undefined }), resetScroll: false })
}

/* ---------- price range (integer cents → no float drift) ---------- */
const toCents = (v: string, up = false) => {
  const w = toWei(v)
  const c = w / 10n ** 16n
  return Number(up && w % 10n ** 16n ? c + 1n : c)
}
const fromCents = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`

function PriceRange({ search, bounds, set }: { search: HomeSearch; bounds?: [string, string]; set: Set }) {
  const [min, max] = bounds ? [toCents(bounds[0]), toCents(bounds[1], true)] : [0, 0]
  const current: [number, number] = [search.minPrice ? toCents(search.minPrice) : min, search.maxPrice ? toCents(search.maxPrice, true) : max]
  const [v, setV] = useState(current) // remounted (key) when the URL range changes
  if (!bounds) return <Skeleton className="h-24 w-full" />
  return (
    <div className="space-y-3">
      <Slider
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={1}
        value={v}
        onValueChange={(x) => setV([x[0], x[1]])}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        valueText={(c) => `${fromCents(c)} ETH`}
      />
      <p className="text-xs" aria-live="polite">
        Preço: {fromCents(v[0]).replace('.', ',')} - {fromCents(v[1]).replace('.', ',')} ETH
      </p>
      <Button size="sm" className="h-7 px-3" onClick={() => set({ minPrice: v[0] > min ? fromCents(v[0]) : undefined, maxPrice: v[1] < max ? fromCents(v[1]) : undefined })}>
        Aplicar
      </Button>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="text-base font-bold">{title}</legend>
      <div className="mt-3 space-y-0.5">{children}</div>
    </fieldset>
  )
}

function Item({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex w-full items-center justify-between rounded-xs px-3 py-2 text-left text-sm transition hover:bg-accent/60', active ? 'text-primary' : 'text-sand')}
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums">({count ?? '–'})</span>
    </button>
  )
}

export function Filters({ search, facets, set }: { search: HomeSearch; facets?: NftList['facets']; set: Set }) {
  return (
    <>
      <Group title="Coleções">
        {Category.options.map((c) => (
          <Item key={c} label={CATEGORY_LABEL[c]} count={facets?.categories[c]} active={search.category === c} onClick={() => set({ category: search.category === c ? undefined : c })} />
        ))}
      </Group>
      <Group title="Faixa de preço">
        <div className="px-1 pt-1">
          <PriceRange key={`${search.minPrice}-${search.maxPrice}-${facets?.priceRange}`} search={search} bounds={facets?.priceRange} set={set} />
        </div>
      </Group>
      <Group title="Rede">
        {Network.options.map((n) => (
          <Item key={n} label={NETWORK_LABEL[n]} count={facets?.networks[n]} active={search.network === n} onClick={() => set({ network: search.network === n ? undefined : n })} />
        ))}
      </Group>
    </>
  )
}

function SortSelect({ value, set, className }: { value: Sort; set: Set; className?: string }) {
  return (
    <Select value={value} onValueChange={(s) => set({ sort: s === 'recent' ? undefined : (s as Sort) })}>
      <SelectTrigger aria-label="Ordenar por" className={cn('h-8 gap-1 border-0 bg-transparent px-0 text-sm shadow-none', className)}>
        <span className="text-muted-foreground">Ordenar por:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="bg-card">
        {Sort.options.map((s) => (
          <SelectItem key={s} value={s}>{SORT_LABEL[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Featured() {
  const { data, isPending } = useQuery(highlightsQuery())
  const f = data?.featured
  return (
    <section aria-labelledby="featured" className="mt-8 overflow-hidden rounded-sm bg-card">
      <h2 id="featured" className="px-5 pt-5 text-2xl font-bold text-primary">NFT EM DESTAQUE</h2>
      <p className="mt-1 text-center text-xl font-bold">OFERTA LIMITADA</p>
      {isPending ? (
        <Skeleton className="mt-3 aspect-square w-full rounded-xl" />
      ) : (
        f && (
          <Link to="/nft/$id" params={{ id: f.id }} className="mt-3 block overflow-hidden rounded-xl">
            <NftImage image={f.image} alt={`${f.name} — oferta limitada`} sizes="310px" />
          </Link>
        )
      )}
    </section>
  )
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const start = Math.max(1, Math.min(page - 1, totalPages - 3))
  const pages = Array.from({ length: Math.min(4, totalPages) }, (_, i) => start + i)
  const cls = (on?: boolean) => cn('grid size-8 place-items-center rounded-xs border text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary')
  const to = (n: number) => ({ to: '/' as const, search: (s: HomeSearch) => ({ ...s, page: n === 1 ? undefined : n }), hash: 'catalogo' })
  return (
    <nav aria-label="Paginação" className="mt-8 flex justify-end gap-2">
      {page > 1 && (
        <Link {...to(page - 1)} aria-label="Página anterior" className={cls()}>
          <ChevronLeft className="size-4" />
        </Link>
      )}
      {pages.map((n) => (
        <Link key={n} {...to(n)} aria-label={`Página ${n}`} aria-current={n === page ? 'page' : undefined} className={cls(n === page)}>
          {n}
        </Link>
      ))}
      {page < totalPages && (
        <Link {...to(page + 1)} aria-label="Próxima página" className={cls()}>
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  )
}

/** Mobile: search field + filter drawer (Figma: Mobile / Início). */
export function MobileSearchBar({ search }: { search: HomeSearch }) {
  const set = useSetSearch()
  const [q, setQ] = useState(search.q ?? '')
  const [open, setOpen] = useState(false)
  const facets = useQuery(nftListQuery(toListParams(search))).data?.facets
  // Follow URL changes (history navigation) without an effect.
  const [urlQ, setUrlQ] = useState(search.q)
  if (urlQ !== search.q) {
    setUrlQ(search.q)
    setQ(search.q ?? '')
  }
  useEffect(() => {
    if (q === (search.q ?? '')) return
    const t = setTimeout(() => set({ q: q.trim() || undefined }), 400) // debounced URL update
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="container-k flex gap-3 pt-4 md:hidden">
      <div role="search" className="relative flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sand" />
        <label htmlFor="mobile-search" className="sr-only">Explorar coleções</label>
        <input
          id="mobile-search"
          type="search"
          value={q}
          maxLength={60}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-xl bg-card pr-3 pl-9 text-sm placeholder:text-sand/80"
        />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button type="button" aria-label="Filtros e ordenação" className="grid size-11 place-items-center rounded-xl bg-linear-to-b from-[#d9935a] to-[#b8743f] text-primary-foreground">
            <SlidersHorizontal className="size-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-card px-4 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Combine coleção, faixa de preço e rede.</SheetDescription>
          </SheetHeader>
          <SortSelect value={search.sort ?? 'recent'} set={set} className="mb-2" />
          <Filters search={search} facets={facets} set={set} />
          <Button className="mt-6 w-full" onClick={() => setOpen(false)}>
            Ver resultados
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function Catalog({ search }: { search: HomeSearch }) {
  const set = useSetSearch()
  const navigate = useNavigate()
  const desktop = useMedia('(min-width: 768px)')
  const params = toListParams(search)
  const list = useQuery(nftListQuery(params))
  const data = list.data
  const tab = params.tab
  // A page beyond the end (e.g. typed by hand) falls back to the last existing page.
  useEffect(() => {
    if (data && data.total > 0 && data.page > data.totalPages)
      navigate({ to: '/', search: (s: HomeSearch) => ({ ...s, page: data.totalPages > 1 ? data.totalPages : undefined }), replace: true })
  }, [data, navigate])
  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="container-k mt-8 scroll-mt-4 md:mt-16 md:grid md:grid-cols-[260px_1fr] md:gap-8 lg:grid-cols-[310px_1fr] lg:gap-12">
      <h2 id="catalog-title" className="sr-only">Catálogo de NFTs</h2>
      {desktop && (
        <aside aria-label="Filtros">
          <div className="rounded-sm bg-card p-5">
            <Filters search={search} facets={data?.facets} set={set} />
          </div>
          <Featured />
        </aside>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Listas" className="scrollbar-none flex gap-4 overflow-x-auto text-sm whitespace-nowrap">
            {TABS.map(([t, label]) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => set({ tab: t === 'all' ? undefined : t })}
                className={cn('border-b-2 pb-1 transition-[color,border-color] duration-200', tab === t ? 'border-primary font-semibold text-primary' : 'border-transparent hover:text-primary')}
              >
                {label}
              </button>
            ))}
          </div>
          <SortSelect value={params.sort} set={set} className="hidden md:flex" />
        </div>
        <p className="sr-only" aria-live="polite">
          {data && !list.isFetching ? `${data.total} NFTs encontrados. Página ${data.page} de ${data.totalPages}.` : ''}
        </p>
        <div aria-busy={list.isFetching} className={cn('mt-6 transition-opacity duration-300 ease-spring', list.isPlaceholderData && 'opacity-60')}>
          {list.isPending ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:gap-x-5 lg:grid-cols-3 lg:gap-x-[34px] lg:gap-y-8">
              {Array.from({ length: PAGE_SIZE }, (_, i) => (
                <NftCardSkeleton key={i} className="max-md:even:mt-6" />
              ))}
            </div>
          ) : list.isError && (!data || list.isPlaceholderData) ? (
            <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
          ) : !data?.items.length ? (
            <EmptyState
              title="Nenhum NFT encontrado"
              message="Ajuste a busca ou remova alguns filtros para ver mais resultados."
              action={
                <Button variant="outline" onClick={() => set({ q: undefined, category: undefined, network: undefined, minPrice: undefined, maxPrice: undefined, tab: undefined })}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <>
              {list.isError && <ErrorState className="mb-6 p-4" title="Falha ao atualizar" message={list.error.message} onRetry={() => list.refetch()} />}
              <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:gap-x-5 lg:grid-cols-3 lg:gap-x-[34px] lg:gap-y-8">
                {data.items.map((n, i) => (
                  <li key={n.id} className="max-md:even:mt-6">
                    <NftCard nft={n} priority={i < 3} index={i} />
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
