import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Integer stepper bounded by [min, max]; announces the value through aria-live. */
export function QuantityStepper({
  value, min = 1, max, onChange, label, disabled, className,
}: { value: number; min?: number; max: number; onChange: (v: number) => void; label: string; disabled?: boolean; className?: string }) {
  const btn = 'grid size-6 place-items-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center gap-3', className)}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir quantidade de ${label}`}>
        <Minus className="size-3.5" strokeWidth={3} />
      </button>
      <output aria-live="polite" className="min-w-4 text-center text-sm tabular-nums">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar quantidade de ${label}`}>
        <Plus className="size-3.5" strokeWidth={3} />
      </button>
    </div>
  )
}
