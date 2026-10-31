// TanStack Query layer: keys, query options and mutations (cache sync lives here, not in components).
import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { announce } from '@/lib/announce'
import { cartId, session, useSession } from '@/lib/session'
import type { Cart, CreateOrderInput, NftListParams, Session, WalletSlot } from './contracts'
import { api } from './endpoints'
import { ApiError } from './http'

/* ---------- keys: private data lives under ['me', uid] so a user switch drops it in one call ---------- */
export const qk = {
  list: (p: NftListParams) => ['nfts', 'list', p] as const,
  highlights: ['nfts', 'highlights'] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  related: (id: string) => ['nfts', 'related', id] as const,
  cart: (owner: string) => ['cart', owner] as const,
  session: (uid: string) => ['me', uid, 'session'] as const,
  favorites: (uid: string) => ['me', uid, 'favorites'] as const,
  order: (uid: string, id: string) => ['me', uid, 'order', id] as const,
  profile: (uid: string) => ['me', uid, 'profile'] as const,
  wallets: (uid: string) => ['me', uid, 'wallets'] as const,
  connection: (uid: string) => ['me', uid, 'connection'] as const,
}

const no404 = (n: number, e: Error) => !(e instanceof ApiError && [403, 404].includes(e.status)) && n < 2

export const nftListQuery = (p: NftListParams) =>
  queryOptions({ queryKey: qk.list(p), queryFn: ({ signal }) => api.nfts.list(p, signal), placeholderData: keepPreviousData })
export const highlightsQuery = () => queryOptions({ queryKey: qk.highlights, queryFn: ({ signal }) => api.nfts.highlights(signal) })
export const nftQuery = (id: string) => queryOptions({ queryKey: qk.nft(id), queryFn: ({ signal }) => api.nfts.detail(id, signal), retry: no404 })
export const relatedQuery = (id: string) => queryOptions({ queryKey: qk.related(id), queryFn: ({ signal }) => api.nfts.related(id, signal), retry: no404 })

export const useUid = () => useSession()?.user.id ?? null
export const cartOwner = (uid: string | null) => (uid ? `u:${uid}` : 'guest')

/* ---------- session ---------- */
/** Drop every private cache (and the guest cart id) — used on logout, expiry and user switch. */
export function clearPrivate(qc: QueryClient) {
  qc.removeQueries({ queryKey: ['me'] })
  qc.removeQueries({ queryKey: ['cart'] })
  cartId.clear()
}

function useAuthSuccess() {
  const qc = useQueryClient()
  return (s: Session) => {
    clearPrivate(qc)
    session.set(s)
  }
}
export const useLogin = () => useMutation({ mutationFn: api.auth.login, onSuccess: useAuthSuccess() })
export const useRegister = () => useMutation({ mutationFn: api.auth.register, onSuccess: useAuthSuccess() })
export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.auth.logout().catch(() => undefined),
    onSettled: () => {
      session.set(null)
      clearPrivate(qc)
      for (const k of Object.keys(sessionStorage)) if (k.startsWith('kurio:')) sessionStorage.removeItem(k)
      toast.success('Você saiu da sua conta.')
    },
  })
}
/** Validates the stored session with the server once per load (recovery after refresh). */
export function useSessionCheck() {
  const s = useSession()
  return useQuery({
    queryKey: qk.session(s?.user.id ?? ''),
    queryFn: ({ signal }) => api.auth.session(signal),
    enabled: !!s,
    staleTime: Infinity,
    retry: false,
  })
}

/* ---------- cart ---------- */
export function useCart() {
  const uid = useUid()
  return useQuery({
    queryKey: qk.cart(cartOwner(uid)),
    queryFn: async ({ signal }) => {
      const c = await api.cart.get(signal)
      if (!session.get()) cartId.set(c.id) // remember the server-issued guest cart
      return c
    },
  })
}

function useCartMutation<V>(fn: (v: V) => Promise<Cart>, success?: (v: V, c: Cart) => string, toastErrors = true) {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, v) => {
      if (!uid) cartId.set(cart.id)
      qc.setQueryData(qk.cart(cartOwner(uid)), cart)
      const msg = success?.(v, cart)
      if (msg) toast.success(msg)
      announce(`Carrinho atualizado. Total ${cart.summary.total} ETH.`)
    },
    onError: (e) => {
      if (toastErrors) toast.error(e.message)
      qc.invalidateQueries({ queryKey: ['cart'] }) // server state may have changed (e.g. stock)
    },
  })
}
export const useAddToCart = () => useCartMutation(api.cart.add, () => 'NFT adicionado ao carrinho.')
export const useUpdateCartItem = () => useCartMutation(({ id, qty }: { id: string; qty: number }) => api.cart.update(id, qty))
export const useRemoveCartItem = () => useCartMutation((id: string) => api.cart.remove(id), () => 'Item removido do carrinho.')
export const useApplyCoupon = () => useCartMutation((code: string) => api.cart.applyCoupon(code), (_v, c) => `Cupom ${c.coupon?.code} aplicado.`, false)
export const useRemoveCoupon = () => useCartMutation(() => api.cart.removeCoupon(), () => 'Cupom removido.')

/* ---------- favorites (optimistic with rollback) ---------- */
export function useFavorites() {
  const uid = useUid()
  return useQuery({ queryKey: qk.favorites(uid ?? ''), queryFn: ({ signal }) => api.favorites.list(signal), enabled: !!uid })
}
export function useToggleFavorite() {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean; name: string }) => (on ? api.favorites.add(id) : api.favorites.remove(id)),
    onMutate: async ({ id, on, name }) => {
      const key = qk.favorites(uid!)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<{ ids: string[] }>(key)
      const ids = prev?.ids ?? []
      qc.setQueryData(key, { ids: on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id) })
      announce(on ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`)
      return { key, prev }
    },
    onError: (_e, { name }, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev) // rollback
      toast.error(`Não foi possível atualizar os favoritos de ${name}. Tente novamente.`)
    },
    onSuccess: (data, _v, ctx) => qc.setQueryData(ctx.key, data),
    onSettled: (_d, _e, _v, ctx) => ctx && qc.invalidateQueries({ queryKey: ctx.key }),
  })
}

/* ---------- checkout & orders ---------- */
export const useQuote = () => useMutation({ mutationFn: api.quote })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** One Idempotency-Key per (user, quote): retries and refreshes reuse it, so no duplicate order is created. */
function idempotencyKey(uid: string, quoteId: string) {
  const k = `kurio:idem:${uid}:${quoteId}`
  let v = sessionStorage.getItem(k)
  if (!v) sessionStorage.setItem(k, (v = crypto.randomUUID()))
  return v
}
export function useCreateOrder() {
  const uid = useUid()
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const key = idempotencyKey(uid!, input.quoteId)
      for (let attempt = 0; ; attempt++) {
        try {
          return await api.orders.create(input, key)
        } catch (e) {
          if (!(e instanceof ApiError) || !['TIMEOUT', 'NETWORK'].includes(e.code) || attempt >= 3) throw e
          toast.info('Sem resposta do servidor. Recuperando o pedido com segurança…')
          announce('Sem resposta do servidor. Recuperando o pedido com segurança.')
          await sleep(800 * 2 ** attempt)
        }
      }
    },
  })
}
export const orderQuery = (uid: string, id: string) =>
  queryOptions({
    queryKey: qk.order(uid, id),
    queryFn: ({ signal }) => api.orders.get(id, signal),
    retry: no404,
  })

/* ---------- profile & wallets ---------- */
export const profileQuery = (uid: string) => queryOptions({ queryKey: qk.profile(uid), queryFn: ({ signal }) => api.profile.get(signal) })
export const walletsQuery = (uid: string) => queryOptions({ queryKey: qk.wallets(uid), queryFn: ({ signal }) => api.wallets.get(signal) })
export const connectionQuery = (uid: string) => queryOptions({ queryKey: qk.connection(uid), queryFn: ({ signal }) => api.wallets.connection(signal) })

export function useUpdateProfile() {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: api.profile.update,
    onSuccess: (u) => {
      qc.setQueryData(qk.profile(uid!), u)
      session.patchUser(u)
    },
  })
}
export function useAvatar() {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: (dataUrl: string | null) => (dataUrl ? api.profile.avatar(dataUrl) : api.profile.removeAvatar()),
    onSuccess: (u) => {
      qc.setQueryData(qk.profile(uid!), u)
      session.patchUser(u)
      toast.success(u.avatarUrl ? 'Avatar atualizado.' : 'Avatar removido.')
    },
    onError: (e) => toast.error(e.message),
  })
}
export const useChangePassword = () => useMutation({ mutationFn: api.profile.password })

export function useSaveWallet() {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: ({ slot, data }: { slot: WalletSlot; data: Parameters<typeof api.wallets.save>[1] }) => api.wallets.save(slot, data),
    onSuccess: (w) => {
      qc.setQueryData(qk.wallets(uid!), w)
      qc.invalidateQueries({ queryKey: qk.connection(uid!) })
    },
  })
}
export function useConnectWallet() {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({
    mutationFn: (v: { slot: WalletSlot } & Parameters<typeof api.wallets.connect>[1]) => api.wallets.connect(v.slot, v),
    onSuccess: (c) => qc.setQueryData(qk.connection(uid!), c),
  })
}
export function useDisconnectWallet() {
  const qc = useQueryClient()
  const uid = useUid()
  return useMutation({ mutationFn: api.wallets.disconnect, onSuccess: () => qc.setQueryData(qk.connection(uid!), null) })
}
