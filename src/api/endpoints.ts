// Typed REST endpoints: every response is parsed against its contract at the transport boundary.
import { z } from 'zod'
import * as C from './contracts'
import { http } from './http'

type Opts = { signal?: AbortSignal; headers?: Record<string, string>; timeout?: number; params?: object }
const enc = encodeURIComponent
const Favorites = z.object({ ids: z.array(z.string()) })

const get = async <S extends z.ZodType>(s: S, url: string, o?: Opts): Promise<z.output<S>> => s.parse((await http.get(url, o)).data)
const send = (method: 'post' | 'put' | 'patch' | 'delete') =>
  async <S extends z.ZodType>(s: S, url: string, data?: unknown, o?: Opts): Promise<z.output<S>> =>
    s.parse((await http.request({ method, url, data, ...o })).data)
const post = send('post'), put = send('put'), patch = send('patch'), del = send('delete')

// Drop empty params so URLs stay canonical.
const clean = (p: object) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ''))

export const api = {
  auth: {
    login: (d: z.input<typeof C.LoginInput>) => post(C.Session, '/auth/login', d),
    register: (d: z.input<typeof C.RegisterInput>) => post(C.Session, '/auth/register', d),
    session: (signal?: AbortSignal) => get(C.Session, '/auth/session', { signal }),
    logout: () => http.post('/auth/logout'),
  },
  nfts: {
    list: (p: C.NftListParams, signal?: AbortSignal) => get(C.NftList, '/nfts', { params: clean(p), signal }),
    highlights: (signal?: AbortSignal) => get(C.Highlights, '/nfts/highlights', { signal }),
    detail: (id: string, signal?: AbortSignal) => get(C.NftDetail, `/nfts/${enc(id)}`, { signal }),
    related: (id: string, signal?: AbortSignal) => get(z.array(C.NftSummary), `/nfts/${enc(id)}/related`, { signal }),
  },
  favorites: {
    list: (signal?: AbortSignal) => get(Favorites, '/favorites', { signal }),
    add: (id: string) => put(Favorites, `/favorites/${enc(id)}`),
    remove: (id: string) => del(Favorites, `/favorites/${enc(id)}`),
  },
  cart: {
    get: (signal?: AbortSignal) => get(C.Cart, '/cart', { signal }),
    add: (d: z.input<typeof C.AddToCartInput>) => post(C.Cart, '/cart/items', d),
    update: (id: string, qty: number) => patch(C.Cart, `/cart/items/${enc(id)}`, { qty }),
    remove: (id: string) => del(C.Cart, `/cart/items/${enc(id)}`),
    applyCoupon: (code: string) => post(C.Cart, '/cart/coupon', { code }),
    removeCoupon: () => del(C.Cart, '/cart/coupon'),
  },
  quote: (d: z.input<typeof C.QuoteInput>) => post(C.Quote, '/quote', d),
  orders: {
    // Shorter timeout: a lost response is recovered by retrying with the same Idempotency-Key.
    create: (d: C.CreateOrderInput, key: string) => post(C.Order, '/orders', d, { headers: { 'Idempotency-Key': key }, timeout: 8_000 }),
    get: (id: string, signal?: AbortSignal) => get(C.Order, `/orders/${enc(id)}`, { signal }),
  },
  profile: {
    get: (signal?: AbortSignal) => get(C.User, '/profile', { signal }),
    update: (d: z.input<typeof C.ProfileInput>) => patch(C.User, '/profile', d),
    avatar: (dataUrl: string) => put(C.User, '/profile/avatar', { dataUrl }),
    removeAvatar: () => del(C.User, '/profile/avatar'),
    password: (d: z.input<typeof C.PasswordInput>) => http.put('/profile/password', d),
  },
  wallets: {
    get: (signal?: AbortSignal) => get(C.Wallets, '/wallets', { signal }),
    save: (slot: C.WalletSlot, d: z.input<typeof C.WalletInput> | { sameAsPrimary: true }) => put(C.Wallets, `/wallets/${slot}`, d),
    connection: (signal?: AbortSignal) => get(C.WalletConnection.nullable(), '/wallets/connection', { signal }),
    connect: (slot: C.WalletSlot, d: z.input<typeof C.ConnectInput>) => post(C.WalletConnection, `/wallets/${slot}/connect`, d),
    disconnect: () => http.delete('/wallets/connection'),
  },
}
