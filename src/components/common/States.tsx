import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ErrorState({ title = 'Algo deu errado', message, onRetry, className }: { title?: string; message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-md border border-destructive/40 bg-card p-8 text-center', className)}>
      <p className="font-semibold">{title}</p>
      {message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, message, action, className }: { title: string; message?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-md border border-border bg-card p-10 text-center', className)}>
      <p className="font-semibold">{title}</p>
      {message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
      {action}
    </div>
  )
}
