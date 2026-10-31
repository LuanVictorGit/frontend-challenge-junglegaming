import { useId, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ControlProps = { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }

/** Label + control + error/hint, wired with ids for screen readers. */
export function Field({
  label, error, hint, required, className, srOnlyLabel, children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  srOnlyLabel?: boolean
  children: (p: ControlProps) => ReactNode
}) {
  const id = useId()
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-xs text-foreground', srOnlyLabel && 'sr-only')}>
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-primary">*</span>}
      </label>
      {children({ id, 'aria-invalid': !!error || undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Password input with an accessible show/hide toggle. */
export function PasswordInput(props: React.ComponentProps<'input'>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className={cn('pr-10', props.className)} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-primary/80 hover:text-primary"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

/** Maps server field errors (422/409) onto react-hook-form. */
export function applyServerErrors(fields: Record<string, string> | undefined, setError: (name: never, e: { message: string }) => void) {
  for (const [k, message] of Object.entries(fields ?? {})) setError(k as never, { message })
}
