import type { KeyboardEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Integer stepper bounded by [min, max]; announces the value through aria-live. ↑/→ and ↓/← change it too.
 * Bounds use aria-disabled (not disabled) so a focused button keeps focus when it reaches the limit.
 */
export function QuantityStepper({
  value, min = 1, max, onChange, label, disabled, className,
}: { value: number; min?: number; max: number; onChange: (v: number) => void; label: string; disabled?: boolean; className?: string }) {
  const btn = 'grid size-6 place-items-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:text-muted-foreground aria-disabled:hover:brightness-100'
  const step = (d: number) => {
    const v = Math.min(max, Math.max(min, value + d))
    if (!disabled && v !== value) onChange(v)
  }
  const onKey = (e: KeyboardEvent) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]
    if (!d) return
    e.preventDefault()
    step(d)
  }
  return (
    <div role="group" aria-label={label} onKeyDown={onKey} className={cn('inline-flex items-center gap-3', className)}>
      <button type="button" className={btn} onClick={() => step(-1)} aria-disabled={disabled || value <= min} aria-label={`Diminuir quantidade de ${label}`}>
        <Minus className="size-3.5" strokeWidth={3} />
      </button>
      <output aria-live="polite" className="min-w-4 text-center text-sm tabular-nums">
        <span key={value} className="inline-block animate-in fade-in-0 zoom-in-75 duration-200 ease-spring">{value}</span>
      </output>
      <button type="button" className={btn} onClick={() => step(1)} aria-disabled={disabled || value >= max} aria-label={`Aumentar quantidade de ${label}`}>
        <Plus className="size-3.5" strokeWidth={3} />
      </button>
    </div>
  )
}
