import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader2, X } from 'lucide-react'
import { NETWORK_LABEL, PROVIDER_LABEL, type Order } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { orderQuery, useUid } from '@/api/queries'
import { NftImage } from '@/components/common/NftImage'
import { useTitle } from '@/components/common/PageBits'
import { EmptyState, ErrorState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { formatDate, shortAddress } from '@/lib/utils'

export const Route = createFileRoute('/_auth/orders/$id')({ component: OrderPage })

function OrderPage() {
  const { id } = Route.useParams()
  const uid = useUid()!
  const q = useQuery(orderQuery(uid, id))
  const o = q.data
  useTitle(o?.status === 'confirmed' ? 'Pedido confirmado' : o?.status === 'declined' ? 'Pagamento recusado' : 'Pedido')
  return (
    <div className="container-k py-8 md:py-16">
      {q.isPending ? (
        <Skeleton className="mx-auto h-[560px] max-w-[520px] rounded-sm" />
      ) : q.isError ? (
        q.error instanceof ApiError && [403, 404].includes(q.error.status) ? (
          <EmptyState title={q.error.status === 403 ? 'Acesso negado' : 'Pedido não encontrado'} message={q.error.message} action={<Button asChild><Link to="/">Voltar ao início</Link></Button>} />
        ) : (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        )
      ) : o!.status === 'confirmed' ? (
        <Receipt o={o!} />
      ) : (
        <Status o={o!} />
      )}
    </div>
  )
}

/** Pending/declined: state recovered from the API after refresh or reconnection. */
function Status({ o }: { o: Order }) {
  const pending = o.status === 'pending'
  return (
    <section role="status" aria-live="polite" className="mx-auto max-w-[520px] space-y-4 rounded-sm bg-card p-8 text-center" data-testid={`order-${o.status}`}>
      {pending ? <Loader2 aria-hidden="true" className="mx-auto size-10 animate-spin text-primary" /> : <X aria-hidden="true" className="mx-auto size-10 text-destructive" />}
      <h1 className="text-lg font-bold">{pending ? 'Aguardando confirmação na rede' : 'Pagamento recusado'}</h1>
      <p className="text-sm text-sand">
        {pending
          ? `Pedido ${o.id} enviado na rede ${NETWORK_LABEL[o.network]}. Você pode recarregar esta página: o status será recuperado sem criar outra compra.`
          : `${o.declineReason ?? 'A transação foi recusada.'} Seus itens continuam no carrinho.`}
      </p>
      <p className="text-sm font-bold">Total: <span className="text-primary">{formatEth(o.summary.total, 3)} ETH</span></p>
      {!pending && (
        <Button asChild>
          <Link to="/cart">Voltar ao carrinho</Link>
        </Button>
      )}
    </section>
  )
}

const ThankYou = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className="mx-auto size-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M8 26 32 8l24 18v30H8z" />
    <path d="M8 26l24 18 24-18" />
    <rect x="16" y="14" width="32" height="18" rx="1" fill="var(--card)" />
    <text x="32" y="22" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none" fontWeight="700">THANK</text>
    <text x="32" y="29" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none" fontWeight="700">YOU</text>
  </svg>
)

/** Receipt rendered only from the order snapshot (later catalog changes never alter it). */
function Receipt({ o }: { o: Order }) {
  return (
    <section aria-labelledby="receipt-title" className="relative mx-auto max-w-[520px] overflow-hidden rounded-sm bg-card" data-testid="order-confirmed">
      <Link to="/" aria-label="Fechar e voltar ao início" className="absolute top-3 right-3 text-primary hover:text-foreground">
        <X className="size-4" />
      </Link>
      <div className="px-6 pt-8 pb-4 text-center">
        <ThankYou />
        <h1 id="receipt-title" className="mt-3 text-sm font-bold">Seus NFTs agora estão na sua carteira</h1>
      </div>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-primary/50 px-6 py-3 text-[11px] sm:grid-cols-4 sm:divide-x sm:divide-border">
        <div className="sm:pr-3"><dt className="font-bold">ID da transação</dt><dd className="text-sand" title={o.txHash ?? ''}>{shortAddress(o.txHash ?? '')}</dd></div>
        <div className="sm:px-3"><dt className="font-bold">Data</dt><dd className="text-sand">{formatDate(o.updatedAt)}</dd></div>
        <div className="sm:px-3"><dt className="font-bold">Total</dt><dd className="text-sand">{formatEth(o.summary.total, 3)} ETH</dd></div>
        <div className="sm:pl-3"><dt className="font-bold">Carteira</dt><dd className="text-sand">{PROVIDER_LABEL[o.wallet.provider]}</dd></div>
      </dl>
      <div className="px-6 py-5">
        <h2 className="text-xs font-bold">Detalhes da transação</h2>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 font-bold">NFTs</th>
              <th className="pb-2 text-center font-bold">Edições</th>
              <th className="pb-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={l.itemId}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <NftImage image={l.image} alt="" sizes="40px" className="size-10 rounded-xs" />
                    <div>
                      <p className="text-sm font-bold">{l.name}</p>
                      <p className="text-[11px] text-muted-foreground">ID do token: {l.tokenId} · {l.editionLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-muted-foreground">(x {l.qty})</td>
                <td className="text-right text-sm font-bold text-primary tabular-nums">{formatEth(l.lineTotal)} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 ml-auto w-full max-w-[260px] space-y-1 text-sm">
          {o.coupon && <div className="flex justify-between"><dt>Desconto ({o.coupon.code})</dt><dd className="tabular-nums">(-) {formatEth(o.summary.discount)} ETH</dd></div>}
          <div className="flex justify-between"><dt>Taxa de rede</dt><dd className="tabular-nums">{formatEth(o.summary.networkFee, 3)} ETH</dd></div>
          <div className="flex justify-between font-bold"><dt>Total</dt><dd className="text-primary tabular-nums">{formatEth(o.summary.total, 3)} ETH</dd></div>
        </dl>
        <p className="mt-5 text-center text-[11px] text-sand">
          Transação confirmada na {NETWORK_LABEL[o.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        <div className="mt-4 text-center">
          {/* Simulated explorer link (fake transaction hash from the mock backend). */}
          <Button asChild size="sm">
            <a href={`https://etherscan.io/tx/${o.txHash}`} target="_blank" rel="noopener noreferrer">Ver no Etherscan<span className="sr-only"> (simulado, nova aba)</span></a>
          </Button>
        </div>
      </div>
      <div aria-hidden="true" className="h-2 bg-primary" />
    </section>
  )
}
