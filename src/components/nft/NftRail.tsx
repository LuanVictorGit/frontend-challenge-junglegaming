import { useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './NftCard'

/** Horizontal, scroll-snapping rail with page dots ("Mais desta coleção", "Colecionadores também viram"). */
export function NftRail({ title, items, loading }: { title: string; items?: NftSummary[]; loading?: boolean }) {
  const ref = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil((items?.length ?? 0) / 2))
  const go = (i: number) => ref.current?.scrollTo({ left: (ref.current.scrollWidth / pages) * i, behavior: 'smooth' })
  const id = title.toLowerCase().replace(/\W+/g, '-')

  if (!loading && !items?.length) return null
  return (
    <section aria-labelledby={id} className="container-k mt-16">
      <h2 id={id} className="border-b border-border pb-3 text-base font-bold text-primary">{title}</h2>
      <ul
        ref={ref}
        onScroll={(e) => setPage(Math.round((e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.scrollWidth - e.currentTarget.clientWidth)) * (pages - 1)))}
        className="scrollbar-none mt-6 grid snap-x snap-mandatory auto-cols-[45%] grid-flow-col gap-4 overflow-x-auto pb-2 md:auto-cols-[calc((100%-4*1.25rem)/5)] md:gap-5"
      >
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))
          : items!.map((n) => (
              <li key={n.id} className="snap-start">
                <NftCard nft={n} sizes="(min-width: 768px) 220px, 45vw" />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2 md:hidden" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} tabIndex={-1} onClick={() => go(i)} className={cn('size-2 rounded-full border border-primary', i === page && 'bg-primary')} />
          ))}
        </div>
      )}
    </section>
  )
}
