import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Wallet as WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import {
  CollectorInput, Network, NETWORK_LABEL, Provider, PROVIDER_LABEL, Quote,
  type Cart, type User, type Wallet, type WalletConnection, type Wallets, type WalletSlot,
} from '@/api/contracts'
import { ApiError } from '@/api/http'
import { connectionQuery, profileQuery, useCart, useConnectWallet, useCreateOrder, useDisconnectWallet, useQuote, useUid, walletsQuery } from '@/api/queries'
import { Totals } from '@/components/cart/Summary'
import { applyServerErrors, Field } from '@/components/common/Field'
import { NftImage } from '@/components/common/NftImage'
import { Breadcrumb, MobileTopBar, useTitle } from '@/components/common/PageBits'
import { EmptyState, ErrorState } from '@/components/common/States'
import { FormFields, NETWORK_OPTIONS, PROVIDER_OPTIONS, type FieldDef } from '@/components/form/FormFields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { cn, formatDate, shortAddress } from '@/lib/utils'

export const Route = createFileRoute('/_auth/checkout')({ component: CheckoutPage })

type Form = z.input<typeof CollectorInput>
const draftKey = (uid: string) => `kurio:checkout:${uid}`

const FIELDS: FieldDef<Form>[] = [
  { name: 'displayName', label: 'Nome de exibição', required: true, autoComplete: 'name' },
  { name: 'username', label: 'Nome de usuário', required: true, autoComplete: 'username' },
  { name: 'network', label: 'Rede', required: true, type: 'select', options: NETWORK_OPTIONS, placeholder: 'Selecione uma rede' },
  { name: 'profileName', label: 'Nome do perfil', required: true },
  { name: 'walletAddress', label: 'Endereço da carteira', required: true, placeholder: 'Endereço 0x da carteira' },
  { name: 'secondaryAddress', label: 'ENS ou carteira secundária (opcional)', placeholder: 'ENS ou carteira secundária (opcional)', hideLabel: true },
  { name: 'walletType', label: 'Tipo de carteira', required: true, type: 'select', options: PROVIDER_OPTIONS, placeholder: 'Selecione uma carteira' },
  { name: 'referralCode', label: 'Código de indicação', required: true },
  { name: 'email', label: 'E-mail', required: true, type: 'email', autoComplete: 'email' },
  { name: 'ensName', label: 'Nome ENS', required: true, type: 'ens' },
]

const walletFields = (w: Wallet) => ({
  network: w.network, profileName: w.profileName, walletAddress: w.address, secondaryAddress: w.secondaryAddress,
  walletType: w.walletType, referralCode: w.referralCode, ensName: w.ensName,
})

function CheckoutPage() {
  useTitle('Pagamento')
  const uid = useUid()!
  const cart = useCart()
  const profile = useQuery(profileQuery(uid))
  const wallets = useQuery(walletsQuery(uid))
  const conn = useQuery(connectionQuery(uid))
  const all = [cart, profile, wallets, conn]
  const failed = all.find((q) => q.isError)
  let body
  if (all.some((q) => q.isPending)) body = <CheckoutSkeleton />
  else if (failed) body = <ErrorState className="mt-6" message={failed.error?.message} onRetry={() => all.forEach((q) => q.refetch())} />
  else if (!cart.data!.items.length)
    body = <EmptyState className="mt-6" title="Seu carrinho está vazio" action={<Button asChild><Link to="/">Explorar NFTs</Link></Button>} />
  else if (!wallets.data!.primary && !wallets.data!.secondary)
    body = (
      <EmptyState
        className="mt-6"
        title="Cadastre uma carteira para pagar"
        message="As carteiras cadastradas ficam disponíveis no pagamento."
        action={<Button asChild><Link to="/wallets">Cadastrar carteira</Link></Button>}
      />
    )
  else body = <Checkout cart={cart.data!} user={profile.data!} wallets={wallets.data!} connection={conn.data ?? null} />
  return (
    <>
      <MobileTopBar title="Pagamento com carteira" fallback="/cart" />
      <div className="container-k md:pt-5">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Pagamento' }]} />
        <h1 className="hidden md:block md:sr-only">Pagamento</h1>
        {body}
      </div>
    </>
  )
}

function Checkout({ cart, user, wallets, connection }: { cart: Cart; user: User; wallets: Wallets; connection: WalletConnection | null }) {
  const navigate = useNavigate()
  const [slot, setSlot] = useState<WalletSlot>(connection?.slot ?? (wallets.primary ? 'primary' : 'secondary'))
  // The draft survives a session expiry and is restored after logging in again.
  const draft = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey(user.id)) ?? 'null') ?? {}
    } catch {
      return {}
    }
  }, [user.id])
  const form = useForm<Form>({
    resolver: zodResolver(CollectorInput),
    defaultValues: { displayName: user.displayName, username: user.username, email: user.email, note: '', ...walletFields(wallets[slot]!), ...draft },
  })
  const values = useWatch({ control: form.control })
  useEffect(() => sessionStorage.setItem(draftKey(user.id), JSON.stringify(values)), [values, user.id])

  const quote = useQuote()
  const order = useCreateOrder()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const [review, setReview] = useState<Quote | null>(null)
  const [changes, setChanges] = useState<string[]>([])
  const [stale, setStale] = useState(false)
  const network = values.network as Network
  const provider = values.walletType as Provider
  const connected = connection?.slot === slot && connection.network === network && connection.provider === provider ? connection : null

  // A realtime change to any quoted NFT makes the reviewed quote stale.
  useEffect(() => {
    const onNft = (e: Event) => review?.lines.some((l) => l.nftId === (e as CustomEvent).detail) && setStale(true)
    addEventListener('kurio:nft-updated', onNft)
    return () => removeEventListener('kurio:nft-updated', onNft)
  }, [review])

  const pickWallet = (s: WalletSlot) => {
    setSlot(s)
    for (const [k, v] of Object.entries(walletFields(wallets[s]!))) form.setValue(k as keyof Form, v, { shouldValidate: form.formState.isSubmitted })
    if (connection) disconnect.mutate()
  }
  const requestQuote = () =>
    quote.mutate(
      { network, walletSlot: slot },
      {
        onSuccess: (q) => (setReview(q), setStale(false), setChanges([])),
        onError: (e) => (e instanceof ApiError && e.fields ? applyServerErrors(e.fields, form.setError) : undefined, toast.error(e.message)),
      },
    )
  const onReview = form.handleSubmit(() => (connected ? requestQuote() : toast.error('Conecte a carteira selecionada antes de revisar o pedido.')))

  const confirm = () => {
    if (!review || stale || order.isPending) return
    order.mutate(
      { quoteId: review.id, fingerprint: review.fingerprint, walletSlot: slot, collector: CollectorInput.parse(form.getValues()) },
      {
        onSuccess: (o) => {
          sessionStorage.removeItem(draftKey(user.id))
          navigate({ to: '/orders/$id', params: { id: o.id } })
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'QUOTE_OUTDATED') {
            // Server revalidated and found changes: show the new quote and require a new confirmation.
            const d = e.details as { quote: unknown; changes: string[] }
            setReview(Quote.parse(d.quote))
            setChanges(d.changes)
            setStale(false)
            announce('Os valores mudaram. Revise e confirme novamente.')
          } else if (e instanceof ApiError && e.code === 'OUT_OF_STOCK') {
            toast.error(e.message)
            setReview(null)
            navigate({ to: '/cart' })
          } else {
            if (e instanceof ApiError && e.fields) applyServerErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k.replace(/^collector\./, ''), v])), form.setError)
            toast.error(e.message)
            if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setReview(null)
          }
        },
      },
    )
  }

  const option = 'flex cursor-pointer items-center gap-3 rounded-sm border border-border bg-tile p-3 transition has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring'
  return (
    <div className="mt-2 grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-14">
      <form id="checkout-form" noValidate onSubmit={onReview} className="order-2 lg:order-1">
        <h2 className="text-base font-bold">Perfil do colecionador</h2>
        <FormFields form={form} fields={FIELDS} className="mt-4" />
        <label className="mt-5 flex w-fit items-center gap-2 text-xs">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={slot === 'secondary'} disabled={!wallets.primary || !wallets.secondary} onChange={(e) => pickWallet(e.target.checked ? 'secondary' : 'primary')} />
          Usar outra carteira?
        </label>
        <Field label="Observação do colecionador (opcional)" className="mt-5 max-w-md" error={form.formState.errors.note?.message}>
          {(p) => <Textarea {...p} {...form.register('note')} rows={5} className="bg-tile" />}
        </Field>
      </form>

      <aside className="order-1 space-y-8 lg:order-2" aria-label="Resumo e carteira">
        <section aria-labelledby="my-nfts">
          <h2 id="my-nfts" className="text-base font-bold">Seus NFTs</h2>
          <p className="mt-2 flex justify-between border-b border-border pb-2 text-xs font-semibold"><span>NFTs</span><span>Subtotal</span></p>
          <ul className="mt-3 space-y-2">
            {cart.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-sm bg-card p-2">
                <NftImage image={i.image} alt="" sizes="40px" className="size-10 rounded-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{i.name}</p>
                  <p className="text-[11px] text-muted-foreground">ID do token: {i.tokenId} · {i.editionLabel}</p>
                </div>
                <span className="text-xs text-muted-foreground">(x {i.qty})</span>
                <span className="text-sm font-bold text-primary tabular-nums">{formatEth(i.lineTotal)} ETH</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-xs">
            Tem um código promocional? <Link to="/cart" className="text-primary hover:underline">Aplique aqui</Link>
          </p>
          <Totals s={cart.summary} estimated className="mt-4" />
        </section>

        <section aria-labelledby="wallet-network" className="space-y-3">
          <h2 id="wallet-network" className="text-center text-base font-bold">Carteira e rede</h2>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold">Carteira conectada</legend>
            {(['primary', 'secondary'] as const).map((s) => {
              const w = wallets[s]
              if (!w) return null
              return (
                <label key={s} className={option}>
                  <input type="radio" name="wallet" className="size-4 accent-[var(--primary)]" checked={slot === s} onChange={() => pickWallet(s)} />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block text-sm font-bold">{w.nickname}</span>
                    <span className="block truncate text-sand">{w.secondaryAddress || shortAddress(w.address)}</span>
                    <span className="block text-sand">Rede {NETWORK_LABEL[w.network]}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold">Provedor da carteira</legend>
            {Provider.options.map((p) => (
              <label key={p} className={option}>
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {p === 'coinbase' ? <WalletIcon className="size-4" /> : PROVIDER_LABEL[p][0]}
                </span>
                <span className="flex-1 text-sm">{PROVIDER_LABEL[p]}</span>
                <input type="radio" name="provider" className="size-4 accent-[var(--primary)]" checked={provider === p} onChange={() => form.setValue('walletType', p)} />
              </label>
            ))}
          </fieldset>
          {connected ? (
            <p role="status" className="flex items-center justify-between gap-2 rounded-sm border border-success/40 p-3 text-xs">
              <span>Conectada via {PROVIDER_LABEL[connected.provider]} · {shortAddress(connected.address)}</span>
              <button type="button" className="font-semibold text-primary" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>Desconectar</button>
            </p>
          ) : (
            <Button type="button" variant="outline" className="w-full" disabled={connect.isPending || !provider || !network} onClick={() => connect.mutate({ slot, provider, network })}>
              {connect.isPending ? 'Aguardando aprovação na carteira…' : `Conectar ${provider ? PROVIDER_LABEL[provider] : 'carteira'}`}
            </Button>
          )}
          {connect.isError && !connected && <p role="alert" className="text-xs text-destructive">{connect.error.message}</p>}
        </section>

        <Button form="checkout-form" type="submit" size="lg" className="w-full max-md:rounded-full max-md:bg-linear-to-r max-md:from-[#c9864f] max-md:to-[#a96f43]" disabled={quote.isPending}>
          {quote.isPending ? 'Calculando cotação…' : 'Revisar pedido'}
        </Button>
      </aside>

      <Dialog open={!!review} onOpenChange={(o) => !o && !order.isPending && setReview(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-card sm:max-w-lg">
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription>
            Valores cotados pela API{review && ` — válidos até ${formatDate(review.expiresAt, { hour: '2-digit', minute: '2-digit' })} (UTC)`}. Nada é cobrado antes da confirmação.
          </DialogDescription>
          {changes.length > 0 && (
            <div role="alert" className="rounded-sm border border-primary/60 bg-primary/10 p-3 text-xs">
              <p className="font-bold">Os valores mudaram desde a sua revisão:</p>
              <ul className="mt-1 list-disc pl-4">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
              <p className="mt-1">Confira e confirme novamente.</p>
            </div>
          )}
          {stale && (
            <p role="alert" className="rounded-sm border border-destructive/60 bg-destructive/10 p-3 text-xs">
              Preço ou disponibilidade de um item mudou agora. Atualize a cotação para continuar.
            </p>
          )}
          {review && (
            <>
              <ul className="space-y-2 text-sm">
                {review.lines.map((l) => (
                  <li key={l.itemId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{l.name} <span className="text-muted-foreground">({l.editionLabel}) × {l.qty}</span></span>
                    <span className="tabular-nums">{formatEth(l.lineTotal)} ETH</span>
                  </li>
                ))}
              </ul>
              <Totals s={review.summary} />
              <p className="text-xs text-muted-foreground">
                Carteira {wallets[slot]?.nickname} · {PROVIDER_LABEL[provider]} · Rede {NETWORK_LABEL[network]}
              </p>
            </>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setReview(null)} disabled={order.isPending}>Editar dados</Button>
            {stale ? (
              <Button onClick={requestQuote} disabled={quote.isPending}>Atualizar cotação</Button>
            ) : (
              <Button onClick={confirm} disabled={order.isPending} className={cn(changes.length > 0 && 'animate-none')}>
                {order.isPending ? 'Enviando pedido…' : changes.length ? 'Confirmar com novos valores' : 'Confirmar compra'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-14" aria-busy="true" aria-label="Carregando pagamento">
      <div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
    </div>
  )
}
