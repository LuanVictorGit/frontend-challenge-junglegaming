// Filter, sort and drawer controls (Radix Select/Slider/Dialog), loaded on demand: none of them is needed for the first paint.
import { useState, type RefObject } from 'react'
import { Category, CATEGORY_LABEL, Network, NETWORK_LABEL, Sort, SORT_LABEL, type NftList } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { arrowNav } from '@/lib/arrow-nav'
import { toWei } from '@/lib/eth'
import { cn } from '@/lib/utils'
import type { HomeSearch, SetSearch } from './Catalog'

/* ---------- price range (integer cents → no float drift) ---------- */
const toCents = (v: string, up = false) => {
  const w = toWei(v)
  const c = w / 10n ** 16n
  return Number(up && w % 10n ** 16n ? c + 1n : c)
}
const fromCents = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`

function PriceRange({ search, bounds, set }: { search: HomeSearch; bounds?: [string, string]; set: SetSearch }) {
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

// ↑/↓ (Home/End) move between the options of a filter group; Enter/Space toggles.
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="text-base font-bold">{title}</legend>
      <div onKeyDown={(e) => arrowNav(e, { orientation: 'vertical' })} className="mt-3 space-y-0.5">{children}</div>
    </fieldset>
  )
}

function Item({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-roving
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex w-full items-center justify-between rounded-xs px-3 py-2 text-left text-sm transition hover:bg-accent/60', active ? 'text-primary' : 'text-sand')}
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums">({count ?? '–'})</span>
    </button>
  )
}

export function Filters({ search, facets, set }: { search: HomeSearch; facets?: NftList['facets']; set: SetSearch }) {
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

export function SortSelect({ value, set, className }: { value: Sort; set: SetSearch; className?: string }) {
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

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void; trigger: RefObject<HTMLButtonElement | null>; search: HomeSearch; facets?: NftList['facets']; set: SetSearch }

/** Mobile filter drawer (Figma: Mobile / Início). Focus returns to the toolbar button on close. */
export function FiltersSheet({ open, onOpenChange, trigger, search, facets, set }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          trigger.current?.focus()
        }}
        className="max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-card px-4 pb-8"
      >
        <SheetHeader className="px-0">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Combine coleção, faixa de preço e rede.</SheetDescription>
        </SheetHeader>
        <SortSelect value={search.sort ?? 'recent'} set={set} className="mb-2" />
        <Filters search={search} facets={facets} set={set} />
        <Button className="mt-6 w-full" onClick={() => onOpenChange(false)}>
          Ver resultados
        </Button>
      </SheetContent>
    </Sheet>
  )
}
