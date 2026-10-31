import { useState } from 'react'
import { X } from 'lucide-react'
import type { Cart, Summary } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { useApplyCoupon, useRemoveCoupon } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** Totals exactly as computed by the API (never recomputed on the client). */
export function Totals({ s, estimated, className }: { s: Summary; estimated?: boolean; className?: string }) {
  const row = 'flex items-start justify-between gap-4'
  return (
    <dl aria-live="polite" className={cn('space-y-3 text-sm', className)} data-testid="totals">
      <div className={row}><dt>Subtotal</dt><dd className="tabular-nums">{formatEth(s.subtotal)} ETH</dd></div>
      <div className={row}><dt>Desconto do lançamento</dt><dd className="tabular-nums">(-) {formatEth(s.discount)}</dd></div>
      <div className={row}>
        <dt>Taxa de rede</dt>
        <dd className="text-right tabular-nums">
          {formatEth(s.networkFee, 3)} ETH
          {estimated && <span className="block text-[10px] text-primary">Taxa estimada</span>}
        </dd>
      </div>
      <div className={cn(row, 'border-t border-border pt-4 text-base font-bold')}>
        <dt>Total</dt>
        <dd className="text-primary tabular-nums" data-testid="total">{formatEth(s.total, 3)} ETH</dd>
      </div>
    </dl>
  )
}

export function CouponForm({ cart, pill }: { cart: Cart; pill?: boolean }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const error = apply.error instanceof ApiError ? (apply.error.fields?.code ?? apply.error.message) : undefined
  if (cart.coupon)
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-primary/50 bg-primary/10 px-3 py-2 text-xs">
        <span>
          Cupom <strong>{cart.coupon.code}</strong> — {cart.coupon.label}
        </span>
        <button type="button" aria-label={`Remover cupom ${cart.coupon.code}`} onClick={() => remove.mutate(undefined)} disabled={remove.isPending} className="text-primary">
          <X className="size-4" />
        </button>
      </div>
    )
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        apply.mutate(code.trim(), { onSuccess: () => setCode('') })
      }}
    >
      <label htmlFor="coupon" className={cn('text-xs font-semibold', pill && 'sr-only')}>Código promocional</label>
      <div className={cn('mt-2 flex', pill && 'mt-0 rounded-full bg-tile p-1')}>
        <Input
          id="coupon"
          value={code}
          onChange={(e) => (setCode(e.target.value), apply.reset())}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'coupon-err' : undefined}
          className={cn('rounded-r-none border-primary/50 text-xs', pill && 'border-0 bg-transparent')}
          maxLength={20}
        />
        <Button type="submit" variant={pill ? 'pill' : 'default'} className={cn('rounded-l-none', pill && 'rounded-l-full')} disabled={!code.trim() || apply.isPending}>
          Aplicar
        </Button>
      </div>
      {error && <p id="coupon-err" role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  )
}

export const SummarySkeleton = () => (
  <div className="space-y-4" aria-hidden="true" data-testid="summary-skeleton">
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
    <Skeleton className="h-10 w-full" />
  </div>
)
