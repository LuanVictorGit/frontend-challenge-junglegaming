import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { z } from 'zod'
import { WalletInput, type Wallet, type Wallets, type WalletSlot } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { useSaveWallet, useUid, walletsQuery } from '@/api/queries'
import { AccountShell } from '@/components/account/AccountShell'
import { applyServerErrors } from '@/components/common/Field'
import { useTitle } from '@/components/common/PageBits'
import { ErrorState } from '@/components/common/States'
import { FormFields, NETWORK_OPTIONS, PROVIDER_OPTIONS, type FieldDef } from '@/components/form/FormFields'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_auth/wallets')({ component: WalletsPage })

type W = z.input<typeof WalletInput>
const FIELDS: FieldDef<W>[] = [
  { name: 'displayName', label: 'Nome de exibição', required: true },
  { name: 'nickname', label: 'Apelido da carteira', required: true },
  { name: 'network', label: 'Rede', required: true, type: 'select', options: NETWORK_OPTIONS, placeholder: 'Selecione uma rede' },
  { name: 'profileName', label: 'Nome do perfil', required: true },
  { name: 'address', label: 'Endereço da carteira', required: true, placeholder: 'Endereço 0x da carteira' },
  { name: 'secondaryAddress', label: 'ENS ou carteira secundária (opcional)', placeholder: 'ENS ou carteira secundária (opcional)', hideLabel: true },
  { name: 'walletType', label: 'Tipo de carteira', required: true, type: 'select', options: PROVIDER_OPTIONS, placeholder: 'Selecione uma carteira' },
  { name: 'referralCode', label: 'Código de indicação', required: true },
  { name: 'email', label: 'E-mail', required: true, type: 'email' },
  { name: 'ensName', label: 'Nome ENS', required: true, type: 'ens' },
]
const toForm = (w: Wallet | null): Partial<W> =>
  w ? { displayName: w.displayName, nickname: w.nickname, network: w.network, profileName: w.profileName, address: w.address, secondaryAddress: w.secondaryAddress, walletType: w.walletType, referralCode: w.referralCode, email: w.email, ensName: w.ensName }
    : { displayName: '', nickname: '', profileName: '', address: '', secondaryAddress: '', referralCode: '', email: '', ensName: '' }

function WalletsPage() {
  useTitle('Carteiras')
  const uid = useUid()!
  const q = useQuery(walletsQuery(uid))
  return (
    <AccountShell title="Carteiras" hideTitle>
      {q.isPending ? (
        <div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <WalletsView wallets={q.data} />
      )}
    </AccountShell>
  )
}

function WalletForm({ slot, wallet }: { slot: WalletSlot; wallet: Wallet | null }) {
  const save = useSaveWallet()
  const form = useForm<W>({ resolver: zodResolver(WalletInput), defaultValues: toForm(wallet) })
  const submit = form.handleSubmit((data) =>
    save.mutate(
      { slot, data },
      {
        onSuccess: (w) => (form.reset(toForm(w[slot])), toast.success('Carteira salva.')),
        onError: (e) => (e instanceof ApiError && e.fields && applyServerErrors(e.fields, form.setError), toast.error(e.message)),
      },
    ),
  )
  return (
    <form noValidate onSubmit={submit} aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'} className="mt-5">
      <FormFields form={form} fields={FIELDS} />
      <Button type="submit" size="sm" className="mt-6" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar carteira'}</Button>
    </form>
  )
}

function WalletsView({ wallets }: { wallets: Wallets }) {
  const [addSecondary, setAddSecondary] = useState(false)
  const save = useSaveWallet()
  return (
    <div className="space-y-12">
      <section aria-labelledby="primary-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="primary-title" className="text-sm font-bold">Carteira principal</h2>
            <p className="mt-1 text-xs text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!wallets.primary && (
            <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => document.querySelector<HTMLInputElement>('form[aria-label="Carteira principal"] input')?.focus()}>
              Adicionar
            </button>
          )}
        </div>
        <WalletForm slot="primary" wallet={wallets.primary} />
      </section>
      <section aria-labelledby="secondary-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-sm font-bold">Carteira secundária</h2>
            {!wallets.secondary && <p className="mt-1 text-xs text-sand">Você ainda não adicionou uma carteira secundária.</p>}
          </div>
          {!wallets.secondary && !addSecondary && (
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  className="size-4 accent-[var(--primary)]"
                  disabled={!wallets.primary || save.isPending}
                  onChange={() => save.mutate({ slot: 'secondary', data: { sameAsPrimary: true } }, { onSuccess: () => toast.success('Carteira secundária igual à principal.'), onError: (e) => toast.error(e.message) })}
                />
                Igual à carteira principal
              </label>
              <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => setAddSecondary(true)}>Adicionar</button>
            </div>
          )}
        </div>
        {(wallets.secondary || addSecondary) && <WalletForm key={wallets.secondary?.updatedAt ?? 'new'} slot="secondary" wallet={wallets.secondary} />}
      </section>
    </div>
  )
}
