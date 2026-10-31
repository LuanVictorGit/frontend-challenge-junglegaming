import { cloneElement, lazy, Suspense, useRef, useState, type ComponentProps, type ReactElement } from 'react'
import { useSearch } from '@tanstack/react-router'

// The dialog (Radix Dialog) loads on first intent: it is not part of the first paint.
const loadPanel = () => import('./SearchPanel')
const SearchPanel = lazy(() => loadPanel().then((m) => ({ default: m.SearchPanel })))

/** Global search: submits into the catalog URL state (?q=), so it survives refresh/history. */
export function SearchDialog({ trigger }: { trigger: ReactElement<ComponentProps<'button'>> }) {
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(false) // mounted on first use, then kept for the close animation
  const ref = useRef<HTMLButtonElement>(null)
  const current = (useSearch({ strict: false }) as { q?: string }).q ?? ''
  return (
    <>
      {cloneElement(trigger, { ref, 'aria-haspopup': 'dialog', 'aria-expanded': open, onPointerDown: loadPanel, onFocus: loadPanel, onClick: () => (setArmed(true), setOpen(true)) })}
      {armed && (
        <Suspense fallback={null}>
          <SearchPanel open={open} onOpenChange={setOpen} initial={current} returnFocus={ref} />
        </Suspense>
      )}
    </>
  )
}
