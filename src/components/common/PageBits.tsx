import { Fragment, useEffect, type ReactNode } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Kurio` : 'Kurio — Marketplace de NFTs'
  }, [title])
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="hidden text-xs font-semibold md:block">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <Fragment key={it.label}>
            {i > 0 && <li aria-hidden="true">/</li>}
            <li>
              {it.to ? (
                <Link to={it.to} className="hover:text-primary">
                  {it.label}
                </Link>
              ) : (
                <span aria-current="page">{it.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

/** Mobile-only top bar (back + title + optional action), as in the mobile frames. */
export function MobileTopBar({ title, action, fallback = '/' }: { title?: string; action?: ReactNode; fallback?: string }) {
  const router = useRouter()
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-background/95 px-4 backdrop-blur md:hidden">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (history.length > 1 ? router.history.back() : router.navigate({ to: fallback }))}
        className="grid size-9 place-items-center rounded-full bg-card text-primary"
      >
        <ChevronLeft className="size-5" />
      </button>
      {title && <h1 className="flex-1 truncate text-center text-base font-bold">{title}</h1>}
      <div className="ml-auto min-w-9">{action}</div>
    </div>
  )
}
