import type { KeyboardEvent } from 'react'

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
