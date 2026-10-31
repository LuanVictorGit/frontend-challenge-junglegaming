import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import type { Cart, CartItem } from '@/api/contracts'
import { highlightsQuery, useCart, useRemoveCartItem, useUpdateCartItem } from '@/api/queries'
import { CouponForm, SummarySkeleton, Totals } from '@/components/cart/Summary'
import { NftImage } from '@/components/common/NftImage'
import { Breadcrumb, MobileTopBar, useTitle } from '@/components/common/PageBits'
import { QuantityStepper } from '@/components/common/QuantityStepper'
import { EmptyState, ErrorState } from '@/components/common/States'
import { NftRail } from '@/components/nft/NftRail'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { useSession } from '@/lib/session'

export const Route = createFileRoute('/cart')({ component: CartPage })

function CartPage() {
  useTitle('Carrinho')
  const cart = useCart()
  const trending = useQuery(highlightsQuery())
  return (
    <>
      <MobileTopBar title="Carrinho de NFTs" />
      <div className="container-k md:pt-5">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Carrinho' }]} />
        <h1 className="hidden md:block md:sr-only">Carrinho de NFTs</h1>
        {cart.isPending ? (
          <CartSkeleton />
        ) : cart.isError ? (
          <ErrorState className="mt-6" message={cart.error.message} onRetry={() => cart.refetch()} />
        ) : !cart.data.items.length ? (
          <EmptyState
            className="mt-6"
            title="Seu carrinho está vazio"
            message="Explore o catálogo e adicione NFTs para continuar."
            action={
              <Button asChild>
                <Link to="/">Explorar NFTs</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-2 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-14">
            <Items cart={cart.data} />
            <CartSummary cart={cart.data} />
          </div>
        )}
      </div>
      <NftRail title="Colecionadores também viram" items={trending.data?.trending} loading={trending.isPending} />
    </>
  )
}

function Items({ cart }: { cart: Cart }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const busy = (i: CartItem) => (update.isPending && update.variables?.id === i.id) || (remove.isPending && remove.variables === i.id)
  const stepper = (i: CartItem) => (
    <QuantityStepper value={i.qty} max={Math.max(i.qty, i.maxQty)} onChange={(qty) => update.mutate({ id: i.id, qty })} label={i.name} disabled={busy(i)} />
  )
  const trash = (i: CartItem) => (
    <button type="button" onClick={() => remove.mutate(i.id)} disabled={busy(i)} aria-label={`Remover ${i.name} do carrinho`} className="grid size-8 place-items-center text-primary hover:text-destructive">
      <Trash2 className="size-4" />
    </button>
  )
  const warn = (i: CartItem) =>
    !i.available && <p className="text-[11px] text-destructive">{i.maxQty === 0 ? 'Edição esgotada' : `Disponível: ${i.maxQty} unidade(s)`}</p>
  return (
    <section aria-label="Itens do carrinho">
      {/* Desktop table (Figma: Desktop / Carrinho de NFTs) */}
      <table className="hidden w-full border-separate border-spacing-y-2 md:table">
        <thead>
          <tr className="text-left text-xs font-semibold">
            <th className="border-b border-border pb-2 font-semibold">NFTs</th>
            <th className="border-b border-border pb-2 font-semibold">Preço</th>
            <th className="border-b border-border pb-2 font-semibold">Edições</th>
            <th className="border-b border-border pb-2 font-semibold">Total</th>
            <th className="border-b border-border pb-2"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {cart.items.map((i) => (
            <tr key={i.id} className="bg-card text-sm" data-testid="cart-row">
              <td className="rounded-l-sm p-2">
                <div className="flex items-center gap-3">
                  <NftImage image={i.image} alt="" sizes="48px" className="size-12 rounded-xs" />
                  <div>
                    <Link to="/nft/$id" params={{ id: i.nftId }} className="font-bold hover:text-primary">{i.name}</Link>
                    <p className="text-xs text-muted-foreground">ID do token: {i.tokenId} · {i.editionLabel}</p>
                    {warn(i)}
                  </div>
                </div>
              </td>
              <td className="text-primary/90 tabular-nums">{formatEth(i.unitPrice)} ETH</td>
              <td>{stepper(i)}</td>
              <td className="font-bold text-primary tabular-nums">{formatEth(i.lineTotal)} ETH</td>
              <td className="rounded-r-sm pr-2 text-right">{trash(i)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Mobile cards (Figma: Mobile / Carrinho de NFTs) */}
      <ul className="space-y-4 md:hidden">
        {cart.items.map((i) => (
          <li key={i.id} className="flex overflow-hidden rounded-2xl bg-card" data-testid="cart-row">
            <NftImage image={i.image} alt="" sizes="96px" className="w-24 shrink-0" />
            <div className="flex flex-1 items-center gap-2 p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <Link to="/nft/$id" params={{ id: i.nftId }} className="block truncate text-sm font-bold">{i.name}</Link>
                <p className="text-xs text-muted-foreground">Edição: {i.editionLabel}</p>
                <p className="font-bold text-primary tabular-nums">{formatEth(i.lineTotal)} ETH</p>
                {warn(i)}
              </div>
              <div className="flex flex-col items-end gap-2">
                {trash(i)}
                {stepper(i)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CartSummary({ cart }: { cart: Cart }) {
  const s = useSession()
  const navigate = useNavigate()
  const blocked = cart.items.some((i) => !i.available)
  return (
    <section aria-labelledby="summary-title" className="h-fit space-y-5 rounded-t-3xl bg-card p-5 md:rounded-sm lg:bg-transparent lg:p-0">
      <h2 id="summary-title" className="hidden border-b border-border pb-3 text-base font-bold md:block">Resumo da carteira</h2>
      <CouponForm cart={cart} />
      <Totals s={cart.summary} estimated />
      {blocked && <p role="alert" className="text-xs text-destructive">Ajuste os itens indisponíveis para continuar.</p>}
      <Button
        size="lg"
        variant="default"
        className="w-full max-md:rounded-full max-md:bg-linear-to-r max-md:from-[#c9864f] max-md:to-[#a96f43]"
        disabled={blocked}
        onClick={() => navigate(s ? { to: '/checkout' } : { to: '/login', search: { redirect: '/checkout' } })}
      >
        Conectar e finalizar
      </Button>
      <Link to="/" className="hidden text-center text-sm text-primary hover:underline md:block">Continuar explorando</Link>
    </section>
  )
}

function CartSkeleton() {
  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-14" aria-busy="true" aria-label="Carregando carrinho">
      <div className="space-y-2">
        <Skeleton className="h-6 w-full" />
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full md:h-16" />)}
      </div>
      <SummarySkeleton />
    </div>
  )
}
