// REST handlers (MSW). Every rule is enforced here — the "server" never trusts what the client sends.
import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  AddToCartInput, AvatarInput, ConnectInput, CouponInput, CreateOrderInput, LoginInput, NftListParams, PasswordInput,
  ProfileInput, QuoteInput, RegisterInput, UpdateCartItemInput, WalletInput, WalletSlot, type Session, type User,
} from '@/api/contracts'
import { eth } from '@/lib/eth'
import { config, latency, takeFault } from './config'
import { ApiFail, db, hashPassword, nextId, randomHex, safeEqual, save } from './db'
import type { DbUser } from './fixtures'
import {
  assertQty, buildQuote, cartView, checkCoupon, createOrder, getCart, guestCart, listNfts, mergeGuestCart, mustNft,
  orderView, quoteView, settleDue, toDetail, toSummary, updateNft,
} from './logic'

const API = import.meta.env.VITE_API_URL ?? '/api'
type Auth = 'none' | 'optional' | 'required'
type Ctx = { req: Request; url: URL; params: Record<string, string>; body: unknown; user: DbUser | null; token: string | null }
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/* ---------- helpers ---------- */
function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data)
  if (r.success) return r.data
  const fields: Record<string, string> = {}
  for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message
  throw new ApiFail(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', fields)
}

const sessionTtl = () => (config.scenario === 'session-expired' ? 45_000 : 2 * 3_600_000)
const userView = ({ salt: _s, hash: _h, ...u }: DbUser): User => u
const sessionView = (token: string, u: DbUser): Session => ({ token, expiresAt: new Date(db.sessions[token].expiresAt).toISOString(), user: userView(u) })

function resolveUser(token: string | null) {
  if (!token) return null
  const s = db.sessions[token]
  if (!s) throw new ApiFail(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  if (s.expiresAt <= Date.now()) {
    delete db.sessions[token]
    throw new ApiFail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  return db.users.find((u) => u.id === s.userId) ?? null
}

function openSession(user: DbUser, guestId: string | null) {
  const now = Date.now()
  for (const [t, s] of Object.entries(db.sessions)) if (s.expiresAt <= now) delete db.sessions[t]
  const token = randomHex(32)
  db.sessions[token] = { userId: user.id, expiresAt: now + sessionTtl() }
  mergeGuestCart(guestId, user.id)
  return sessionView(token, user)
}

// Real image check: decodable base64 whose magic bytes match the declared MIME type.
const MAGIC: Record<string, RegExp> = { png: /^89504e47/, jpeg: /^ffd8ff/, webp: /^52494646.{8}57454250/ }
function sniffImage(dataUrl: string) {
  const invalid = () => new ApiFail(422, 'VALIDATION_ERROR', 'Arquivo de imagem inválido.', { dataUrl: 'Arquivo de imagem inválido' })
  const type = /^data:image\/(png|jpeg|webp);base64,/.exec(dataUrl)?.[1]
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  if (!type) throw invalid()
  if ((b64.length * 3) / 4 > 1_048_576) throw new ApiFail(422, 'VALIDATION_ERROR', 'Imagem acima de 1 MB.', { dataUrl: 'A imagem deve ter no máximo 1 MB' })
  let head: string
  try {
    head = [...atob(b64.slice(0, 24))].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  } catch {
    throw invalid()
  }
  if (!MAGIC[type].test(head)) throw invalid()
}

function assertUnique(userId: string | null, email: string, username: string) {
  const fields: Record<string, string> = {}
  if (db.users.some((u) => u.id !== userId && u.email === email)) fields.email = 'E-mail já cadastrado'
  if (db.users.some((u) => u.id !== userId && u.username.toLowerCase() === username.toLowerCase())) fields.username = 'Nome de usuário indisponível'
  if (Object.keys(fields).length) throw new ApiFail(409, 'CONFLICT', 'Já existe uma conta com estes dados.', fields)
}

/** Network simulation: latency, offline, scripted faults and scenario failures. */
async function simulate(method: string, path: string) {
  const f = takeFault(method, path)
  const ms = f?.delay ?? latency()
  if (ms > 0) await delay(ms)
  if (config.scenario === 'offline' || f?.network) return HttpResponse.error()
  const err = (status: number, code: string, message: string) => HttpResponse.json({ error: { code, message } }, { status })
  if (f?.status) return err(f.status, f.status >= 500 ? 'TRANSIENT' : 'INTERNAL', 'Falha simulada no servidor.')
  if (config.scenario === 'server-error' && method === 'GET') return err(503, 'TRANSIENT', 'Serviço temporariamente indisponível.')
  if (config.scenario === 'favorite-fail' && path.startsWith('/favorites/') && method !== 'GET') return err(500, 'TRANSIENT', 'Não foi possível atualizar seus favoritos.')
  return null
}

function route(method: Method, path: string, auth: Auth, fn: (c: Ctx) => unknown) {
  return http[method](API + path, async ({ request, params }) => {
    const url = new URL(request.url)
    const simulated = await simulate(method.toUpperCase(), url.pathname.slice(API.length) + url.search)
    if (simulated) return simulated
    const headers = { 'Cache-Control': 'no-store' }
    try {
      const m = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '')
      const token = m?.[1] ?? (request.headers.has('authorization') ? 'invalid' : null)
      const user = auth === 'none' ? null : resolveUser(token)
      if (auth === 'required' && !user) throw new ApiFail(401, 'UNAUTHENTICATED', 'Faça login para continuar.')
      const body = method === 'get' || method === 'delete' ? undefined : await request.json().catch(() => null)
      const out = await fn({ req: request, url, params: params as Record<string, string>, body, user, token })
      save()
      if (out instanceof Response) return out
      return out === undefined ? new HttpResponse(null, { status: 204, headers }) : HttpResponse.json(out, { headers })
    } catch (e) {
      save()
      if (e instanceof ApiFail)
        return HttpResponse.json({ error: { code: e.code, message: e.message, fields: e.fields, details: e.details } }, { status: e.status, headers })
      console.error('[mock api]', e)
      return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Erro interno no servidor simulado.' } }, { status: 500 })
    }
  })
}

const cartOf = (user: DbUser | null, req: Request) => (user ? getCart(`u:${user.id}`) : guestCart(req.headers.get('x-cart-id')))
const timedOut = new Set<string>()

/* ---------- routes ---------- */
export const handlers = [
  // Session & account
  route('post', '/auth/register', 'none', async ({ body, req }) => {
    const d = parse(RegisterInput, body)
    assertUnique(null, d.email, d.username)
    const salt = randomHex(16)
    const user: DbUser = {
      id: nextId('u'), email: d.email, username: d.username, displayName: d.username, profileName: d.username, ensName: '',
      walletNickname: 'Principal', avatarUrl: null, salt, hash: await hashPassword(d.password, salt),
    }
    db.users.push(user)
    db.wallets[user.id] = { primary: null, secondary: null }
    return HttpResponse.json(openSession(user, req.headers.get('x-cart-id')), { status: 201 })
  }),
  route('post', '/auth/login', 'none', async ({ body, req }) => {
    const d = parse(LoginInput, body)
    const attempt = db.attempts[d.email]
    if (attempt && attempt.until > Date.now()) throw new ApiFail(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde 1 minuto e tente novamente.')
    const user = db.users.find((u) => u.email === d.email)
    // Hash even for unknown e-mails so timing does not reveal registered accounts.
    const hash = await hashPassword(d.password, user?.salt ?? '00'.repeat(16))
    if (!user || !safeEqual(hash, user.hash)) {
      const count = (attempt?.count ?? 0) + 1
      db.attempts[d.email] = { count, until: count >= 5 ? Date.now() + 60_000 : 0 }
      throw new ApiFail(401, 'UNAUTHENTICATED', 'E-mail ou senha inválidos.')
    }
    delete db.attempts[d.email]
    return openSession(user, req.headers.get('x-cart-id'))
  }),
  route('get', '/auth/session', 'required', ({ user, token }) => sessionView(token!, user!)),
  route('post', '/auth/logout', 'none', ({ req }) => {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('authorization') ?? '')?.[1]
    if (token) delete db.sessions[token]
  }),

  // Catalog
  route('get', '/nfts', 'none', ({ url }) => listNfts(parse(NftListParams, Object.fromEntries(url.searchParams)), config.scenario === 'empty')),
  route('get', '/nfts/highlights', 'none', () =>
    config.scenario === 'empty'
      ? { featured: null, trending: [] }
      : { featured: toSummary(mustNft('sage-nomad-009')), trending: [...db.nfts].sort((a, b) => b.trending - a.trending).slice(0, 5).map(toSummary) },
  ),
  route('get', '/nfts/:id', 'none', ({ params }) => toDetail(mustNft(params.id))),
  route('get', '/nfts/:id/related', 'none', ({ params }) => {
    const n = mustNft(params.id)
    return db.nfts.filter((x) => x.id !== n.id && (x.collection === n.collection || x.category === n.category)).slice(0, 5).map(toSummary)
  }),

  // Favorites
  route('get', '/favorites', 'required', ({ user }) => ({ ids: db.favorites[user!.id] ?? [] })),
  route('put', '/favorites/:id', 'required', ({ user, params }) => {
    mustNft(params.id)
    const ids = [...new Set([...(db.favorites[user!.id] ?? []), params.id])]
    db.favorites[user!.id] = ids
    return { ids }
  }),
  route('delete', '/favorites/:id', 'required', ({ user, params }) => {
    const ids = (db.favorites[user!.id] ?? []).filter((x) => x !== params.id)
    db.favorites[user!.id] = ids
    return { ids }
  }),

  // Cart (guest via X-Cart-Id, user via session)
  route('get', '/cart', 'optional', ({ user, req }) => cartView(cartOf(user, req))),
  route('post', '/cart/items', 'optional', ({ user, req, body }) => {
    const d = parse(AddToCartInput, body)
    const c = cartOf(user, req)
    const line = c.lines.find((l) => l.nftId === d.nftId && l.editionId === d.editionId)
    assertQty(d.nftId, d.editionId, (line?.qty ?? 0) + d.qty)
    if (line) line.qty += d.qty
    else c.lines.push({ id: nextId('cl'), nftId: d.nftId, editionId: d.editionId, qty: d.qty })
    c.version++
    return HttpResponse.json(cartView(c), { status: 201 })
  }),
  route('patch', '/cart/items/:id', 'optional', ({ user, req, params, body }) => {
    const d = parse(UpdateCartItemInput, body)
    const c = cartOf(user, req)
    const line = c.lines.find((l) => l.id === params.id)
    if (!line) throw new ApiFail(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
    assertQty(line.nftId, line.editionId, d.qty)
    line.qty = d.qty
    c.version++
    return cartView(c)
  }),
  route('delete', '/cart/items/:id', 'optional', ({ user, req, params }) => {
    const c = cartOf(user, req)
    if (!c.lines.some((l) => l.id === params.id)) throw new ApiFail(404, 'NOT_FOUND', 'Item não encontrado no carrinho.')
    c.lines = c.lines.filter((l) => l.id !== params.id)
    c.version++
    return cartView(c)
  }),
  route('post', '/cart/coupon', 'optional', ({ user, req, body }) => {
    const d = parse(CouponInput, body)
    const c = cartOf(user, req)
    checkCoupon(d.code, cartView(c).summary.subtotal)
    c.coupon = d.code
    c.version++
    return cartView(c)
  }),
  route('delete', '/cart/coupon', 'optional', ({ user, req }) => {
    const c = cartOf(user, req)
    c.coupon = null
    c.version++
    return cartView(c)
  }),

  // Quote & orders
  route('post', '/quote', 'required', ({ user, body }) => {
    const d = parse(QuoteInput, body)
    const q = buildQuote(user!.id, d.network, d.walletSlot)
    // Scenario hooks: the catalog changes right after the quote is issued.
    const first = q.lines[0]
    if (config.scenario === 'price-change') setTimeout(() => updateNft(first.nftId, { editionId: first.editionId, price: eth.add(first.unitPrice, '0.05') }), 1500)
    if (config.scenario === 'sold-out') setTimeout(() => updateNft(first.nftId, { editionId: first.editionId, stock: 0 }), 1500)
    return quoteView(q)
  }),
  route('post', '/orders', 'required', async ({ user, body, req }) => {
    const key = req.headers.get('idempotency-key') ?? ''
    if (!/^[A-Za-z0-9-]{8,80}$/.test(key)) throw new ApiFail(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido.')
    const { order, replay } = createOrder(user!.id, parse(CreateOrderInput, body), key, config.scenario === 'payment-declined')
    if (!replay && config.scenario === 'order-timeout' && !timedOut.has(key)) {
      // The order is committed, but the response never arrives in time (client retries with the same key).
      timedOut.add(key)
      save()
      await delay(15_000)
    }
    return HttpResponse.json(orderView(order), { status: replay ? 200 : 201, headers: { 'Cache-Control': 'no-store' } })
  }),
  route('get', '/orders/:id', 'required', ({ user, params }) => {
    settleDue()
    const o = db.orders.find((x) => x.id === params.id)
    if (!o) throw new ApiFail(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (o.userId !== user!.id) throw new ApiFail(403, 'FORBIDDEN', 'Você não tem permissão para ver este pedido.')
    return orderView(o)
  }),

  // Profile
  route('get', '/profile', 'required', ({ user }) => userView(user!)),
  route('patch', '/profile', 'required', ({ user, body }) => {
    const d = parse(ProfileInput, body)
    assertUnique(user!.id, d.email, d.username)
    Object.assign(user!, d)
    return userView(user!)
  }),
  route('put', '/profile/avatar', 'required', ({ user, body }) => {
    const d = parse(AvatarInput, body)
    sniffImage(d.dataUrl)
    user!.avatarUrl = d.dataUrl
    return userView(user!)
  }),
  route('delete', '/profile/avatar', 'required', ({ user }) => {
    user!.avatarUrl = null
    return userView(user!)
  }),
  route('put', '/profile/password', 'required', async ({ user, body, token }) => {
    const d = parse(PasswordInput, body)
    const key = `pw:${user!.id}`
    if ((db.attempts[key]?.until ?? 0) > Date.now()) throw new ApiFail(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde 1 minuto e tente novamente.')
    if (!safeEqual(await hashPassword(d.currentPassword, user!.salt), user!.hash)) {
      const count = (db.attempts[key]?.count ?? 0) + 1
      db.attempts[key] = { count, until: count >= 5 ? Date.now() + 60_000 : 0 }
      throw new ApiFail(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta' })
    }
    delete db.attempts[key]
    user!.salt = randomHex(16)
    user!.hash = await hashPassword(d.newPassword, user!.salt)
    // Revoke every other session of this user.
    for (const [t, s] of Object.entries(db.sessions)) if (s.userId === user!.id && t !== token) delete db.sessions[t]
  }),

  // Wallets (connection routes first: they share the /wallets/:slot shape)
  route('get', '/wallets/connection', 'required', ({ user }) => HttpResponse.json(db.connections[user!.id] ?? null, { headers: { 'Cache-Control': 'no-store' } })),
  route('delete', '/wallets/connection', 'required', ({ user }) => {
    db.connections[user!.id] = null
  }),
  route('get', '/wallets', 'required', ({ user }) => db.wallets[user!.id] ?? { primary: null, secondary: null }),
  route('put', '/wallets/:slot', 'required', ({ user, params, body }) => {
    const slot = parse(WalletSlot, params.slot)
    const w = (db.wallets[user!.id] ??= { primary: null, secondary: null })
    const updatedAt = new Date().toISOString()
    if (slot === 'secondary' && (body as { sameAsPrimary?: boolean })?.sameAsPrimary === true) {
      if (!w.primary) throw new ApiFail(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.')
      w.secondary = { ...w.primary, slot, nickname: `${w.primary.nickname} (cópia)`.slice(0, 30), updatedAt }
    } else w[slot] = { ...parse(WalletInput, body), slot, updatedAt }
    if (db.connections[user!.id]?.slot === slot) db.connections[user!.id] = null
    return w
  }),
  route('post', '/wallets/:slot/connect', 'required', ({ user, params, body }) => {
    const slot = parse(WalletSlot, params.slot)
    const d = parse(ConnectInput, body)
    const w = db.wallets[user!.id]?.[slot]
    if (!w) throw new ApiFail(404, 'NOT_FOUND', 'Carteira não cadastrada.')
    if (config.scenario === 'wallet-reject') throw new ApiFail(422, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    if (w.network !== d.network) throw new ApiFail(422, 'VALIDATION_ERROR', 'Esta carteira não opera na rede selecionada.', { network: 'Rede incompatível com a carteira' })
    return (db.connections[user!.id] = { slot, provider: d.provider, network: d.network, address: w.address, connectedAt: new Date().toISOString() })
  }),
]
