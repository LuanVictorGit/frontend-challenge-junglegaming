import { useState, type KeyboardEvent } from 'react'

const KEYS = {
  horizontal: { prev: ['ArrowLeft'], next: ['ArrowRight'] },
  vertical: { prev: ['ArrowUp'], next: ['ArrowDown'] },
  both: { prev: ['ArrowLeft', 'ArrowUp'], next: ['ArrowRight', 'ArrowDown'] },
}

/**
 * Arrow keys (plus Home/End) move focus between the `[data-roving]` items of a group, wrapping around (WAI-ARIA
 * tabs/toolbar). With `select`, the focused item is also activated (tabs with automatic activation).
 */
export function arrowNav(e: KeyboardEvent<HTMLElement>, { orientation = 'horizontal', select = false }: { orientation?: keyof typeof KEYS; select?: boolean } = {}) {
  const { prev, next } = KEYS[orientation]
  const step = prev.includes(e.key) ? -1 : next.includes(e.key) ? 1 : 0
  if (!step && e.key !== 'Home' && e.key !== 'End') return
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-roving]:not(:disabled)')]
  const at = items.indexOf(document.activeElement as HTMLElement)
  if (at < 0) return
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (at + step + items.length) % items.length
  e.preventDefault()
  items[to].focus()
  if (select && to !== at) items[to].click()
}

const MOVES: Record<string, (at: number, cols: number, last: number) => number> = {
  ArrowLeft: (at) => at - 1,
  ArrowRight: (at) => at + 1,
  ArrowUp: (at, cols) => at - cols,
  ArrowDown: (at, cols) => at + cols,
  Home: () => 0,
  End: (_, __, last) => last,
}

/**
 * Card collections as a WAI-ARIA layout grid: one Tab stop (the active card; Tab then reaches its own actions),
 * arrow keys move between cards following the visible columns, Home/End jump to the ends. Each card is a
 * `[data-card]` item whose main link is marked `[data-card-link]`; `data-orientation="horizontal"` makes a rail.
 */
export function useCardGrid(count: number) {
  const [active, setActive] = useState(0)
  const current = Math.min(active, Math.max(0, count - 1))
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-card]')]
    const at = items.findIndex((it) => it.contains(document.activeElement))
    if (at < 0 || !MOVES[e.key]) return
    const cols = e.currentTarget.dataset.orientation === 'horizontal' ? items.length : new Set(items.map((it) => Math.round(it.getBoundingClientRect().left))).size
    const to = MOVES[e.key](at, cols, items.length - 1)
    if (to < 0 || to >= items.length || to === at) return
    e.preventDefault()
    setActive(to)
    items[to].querySelector<HTMLElement>('[data-card-link]')?.focus()
  }
  return {
    gridProps: { onKeyDown },
    itemProps: (i: number) => ({ 'data-card': true, onFocus: () => setActive(i) }),
    isActive: (i: number) => i === current,
  }
}
