// Mock backend business rules: catalog, cart, coupons, quotes, idempotent orders and realtime events.
import { z } from 'zod'
import {
  Category, Network, NETWORK_LABEL, NftListParams,
  type Cart, type CartItem, type CreateOrderInput, type NftDetail, type NftSummary, type Order, type Quote, type QuoteLine, type Summary, type WalletSlot,
} from '@/api/contracts'
import { eth } from '@/lib/eth'
import { COUPONS, NETWORK_FEES, describe, reviewsFor, type DbNft } from './fixtures'
import { ApiFail, db, fingerprint, nextId, save, type DbCart, type DbOrder, type DbQuote } from './db'
import { broadcast } from './socket'

const iso = (t = Date.now()) => new Date(t).toISOString()
const DAY = 86_400_000

/* ---------- catalog ---------- */
export const findNft = (id: string) => db.nfts.find((n) => n.id === id)
export const edition = (n: DbNft, id: string) => n.editions.find((e) => e.id === id)
const priceOf = (n: DbNft) => edition(n, n.defaultEditionId)!.price

export function mustNft(id: string) {
  const n = findNft(id)
  if (!n) throw new ApiFail(404, 'NOT_FOUND', 'NFT não encontrado.')
  return n
}

export const toSummary = (n: DbNft): NftSummary => ({
  id: n.id, name: n.name, tokenId: n.tokenId, image: n.image, collection: n.collection, category: n.category,
  network: n.network, price: priceOf(n), compareAtPrice: n.compareAtPrice, badge: n.badge,
  available: n.editions.some((e) => e.stock > 0), defaultEditionId: n.defaultEditionId, createdAt: n.createdAt, version: n.version,
})

export const toDetail = (n: DbNft): NftDetail => ({
  ...toSummary(n), ...describe(n), attributes: n.attributes, editions: n.editions,
  rating: n.rating, reviewCount: n.reviewCount, reviews: reviewsFor(n), contract: '0x7a42c1d9e5b3f80a6c2d4e1f9b7a3c5d8e0f19e8', royaltyBps: 500,
})

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const SORTS: Record<string, (a: DbNft, b: DbNft) => number> = {
  recent: (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0), // ISO timestamps: no ICU collation
  'price-asc': (a, b) => eth.cmp(priceOf(a), priceOf(b)) || a.name.localeCompare(b.name),
  'price-desc': (a, b) => eth.cmp(priceOf(b), priceOf(a)) || a.name.localeCompare(b.name),
  rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
}

export function listNfts(p: z.output<typeof NftListParams>, empty: boolean) {
  const newest = Math.max(...db.nfts.map((n) => Date.parse(n.createdAt)))
  const base = (empty ? [] : db.nfts).filter(
    (n) =>
      (!p.q || norm(`${n.name} ${n.collection} ${n.tokenId}`).includes(norm(p.q))) &&
      (p.tab !== 'new' || Date.parse(n.createdAt) >= newest - 14 * DAY) &&
      (p.tab !== 'trending' || n.trending >= 60) &&
      (!p.minPrice || eth.cmp(priceOf(n), p.minPrice) >= 0) &&
      (!p.maxPrice || eth.cmp(priceOf(n), p.maxPrice) <= 0),
  )
  // Facet counts honour the other active filter (standard faceted search).
  const categories = Object.fromEntries(Category.options.map((c) => [c, base.filter((n) => n.category === c && (!p.network || n.network === p.network)).length]))
  const networks = Object.fromEntries(Network.options.map((k) => [k, base.filter((n) => n.network === k && (!p.category || n.category === p.category)).length]))
  const items = base.filter((n) => (!p.category || n.category === p.category) && (!p.network || n.network === p.network)).sort(SORTS[p.sort])
  const prices = db.nfts.map(priceOf).sort(eth.cmp)
  return {
    items: items.slice((p.page - 1) * p.pageSize, p.page * p.pageSize).map(toSummary),
    page: p.page,
    pageSize: p.pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / p.pageSize)),
    facets: { categories, networks, priceRange: [prices[0], prices[prices.length - 1]] as [string, string] },
  }
}

/* ---------- realtime events ---------- */
export function touchNft(n: DbNft) {
  n.version++
  broadcast({
    id: nextId('evt'), type: 'nft.updated', resource: { type: 'nft', id: n.id }, version: n.version, occurredAt: iso(),
    data: {
      name: n.name, price: priceOf(n), compareAtPrice: n.compareAtPrice, available: n.editions.some((e) => e.stock > 0),
      editions: n.editions.map(({ id, price, stock }) => ({ id, price, stock })),
    },
  })
}

/** Mock-control mutation: change price/stock of an edition and publish `nft.updated`. */
export function updateNft(id: string, patch: { editionId?: string; price?: string; stock?: number }) {
  const n = mustNft(id)
  const e = edition(n, patch.editionId ?? n.defaultEditionId)
  if (!e) throw new ApiFail(404, 'NOT_FOUND', 'Edição não encontrada.')
  if (patch.price !== undefined && eth.isValid(patch.price)) e.price = patch.price
  if (patch.stock !== undefined) e.stock = Math.max(0, Math.floor(patch.stock))
  touchNft(n)
  save()
  return toDetail(n)
}

/* ---------- coupons & totals ---------- */
const couponView = (code: string | null) => {
  const c = code ? COUPONS.find((x) => x.code === code) : undefined
  return c ? { code: c.code, label: c.label } : null
}

export function checkCoupon(code: string, subtotal: string) {
  const c = COUPONS.find((x) => x.code === code.toUpperCase())
  if (!c) throw new ApiFail(422, 'COUPON_INVALID', 'Cupom inválido.', { code: 'Cupom inválido' })
  if (Date.parse(c.expiresAt) < Date.now()) throw new ApiFail(422, 'COUPON_EXPIRED', 'Este cupom expirou.', { code: 'Cupom expirado' })
  if (c.minSubtotal && eth.cmp(subtotal, c.minSubtotal) < 0)
    throw new ApiFail(422, 'COUPON_INVALID', `Cupom válido para compras acima de ${c.minSubtotal} ETH.`, { code: `Subtotal mínimo de ${c.minSubtotal} ETH` })
  return c
}

function discountFor(code: string | null, subtotal: string) {
  const c = code ? COUPONS.find((x) => x.code === code) : undefined
  if (!c || Date.parse(c.expiresAt) < Date.now() || (c.minSubtotal && eth.cmp(subtotal, c.minSubtotal) < 0)) return '0'
  return c.bps ? eth.bps(subtotal, c.bps) : eth.min(c.fixed!, subtotal)
}

export function summarize(lines: { lineTotal: string }[], coupon: string | null, network: Network): Summary {
  const subtotal = eth.add('0', ...lines.map((l) => l.lineTotal))
  const discount = discountFor(coupon, subtotal)
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  return { subtotal, discount, networkFee, total: eth.add(eth.sub(subtotal, discount), networkFee), network }
}

/* ---------- cart ---------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function getCart(key: string): DbCart {
  return (db.carts[key] ??= { id: key.startsWith('g:') ? key.slice(2) : crypto.randomUUID(), lines: [], coupon: null, version: 1 })
}
/** Guest carts are keyed by an unguessable server-issued UUID (X-Cart-Id header); unknown ids are ignored. */
export const guestCart = (id: string | null) => getCart(id && UUID.test(id) && db.carts[`g:${id}`] ? `g:${id}` : `g:${crypto.randomUUID()}`)

export function cartView(c: DbCart): Cart {
  const items: CartItem[] = []
  for (const l of c.lines) {
    const n = findNft(l.nftId)
    const e = n && edition(n, l.editionId)
    if (!n || !e) continue
    items.push({
      id: l.id, nftId: n.id, editionId: e.id, editionLabel: e.label, name: n.name, tokenId: n.tokenId, image: n.image,
      unitPrice: e.price, qty: l.qty,
      lineTotal: eth.mul(e.price, l.qty), maxQty: Math.min(e.stock, e.maxPerOrder), available: e.stock >= l.qty,
    })
  }
  return { id: c.id, items, coupon: couponView(c.coupon), summary: summarize(items, c.coupon, 'ethereum'), count: items.reduce((s, i) => s + i.qty, 0), version: c.version }
}

/** Server-side availability rule: quantity must fit stock and the per-order limit. */
export function assertQty(nftId: string, editionId: string, qty: number) {
  const n = mustNft(nftId)
  const e = edition(n, editionId)
  if (!e) throw new ApiFail(404, 'NOT_FOUND', 'Edição não encontrada.')
  const max = Math.min(e.stock, e.maxPerOrder)
  if (e.stock === 0) throw new ApiFail(409, 'OUT_OF_STOCK', `A edição ${e.label} de ${n.name} está esgotada.`, undefined, { available: 0 })
  if (qty > max) throw new ApiFail(409, 'OUT_OF_STOCK', `Limite para a edição ${e.label}: ${max} unidade(s).`, undefined, { available: max })
  return e
}

/** Preserve visitor items on login: merge guest cart into the user cart, respecting limits. */
export function mergeGuestCart(guestId: string | null, userId: string) {
  const g = guestId && UUID.test(guestId) ? db.carts[`g:${guestId}`] : undefined
  if (!g) return
  const u = getCart(`u:${userId}`)
  for (const l of g.lines) {
    const n = findNft(l.nftId)
    const e = n && edition(n, l.editionId)
    if (!e) continue
    const max = Math.min(e.stock, e.maxPerOrder)
    const ex = u.lines.find((x) => x.nftId === l.nftId && x.editionId === l.editionId)
    if (ex) ex.qty = Math.max(ex.qty, Math.min(max, ex.qty + l.qty))
    else if (max > 0) u.lines.push({ ...l, id: nextId('cl'), qty: Math.min(max, l.qty) })
  }
  u.coupon ??= g.coupon
  u.version++
  delete db.carts[`g:${guestId}`]
}

/* ---------- quotes ---------- */
export function buildQuote(userId: string, network: Network, walletSlot: WalletSlot): DbQuote {
  const cart = getCart(`u:${userId}`)
  const view = cartView(cart)
  if (!view.items.length) throw new ApiFail(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')
  const short = view.items.filter((i) => !i.available)
  if (short.length)
    throw new ApiFail(409, 'OUT_OF_STOCK', `Disponibilidade alterada: ${short.map((i) => `${i.name} (${i.editionLabel})`).join(', ')}.`, undefined, {
      items: short.map((i) => ({ itemId: i.id, available: i.maxQty })),
    })
  const wallet = db.wallets[userId]?.[walletSlot]
  if (!wallet) throw new ApiFail(422, 'VALIDATION_ERROR', 'Cadastre a carteira selecionada antes de continuar.', { walletSlot: 'Carteira não cadastrada' })
  if (wallet.network !== network)
    throw new ApiFail(422, 'VALIDATION_ERROR', `A carteira ${wallet.nickname} opera na rede ${NETWORK_LABEL[wallet.network]}.`, { network: 'Rede incompatível com a carteira' })
  if (cart.coupon) {
    try {
      checkCoupon(cart.coupon, view.summary.subtotal)
    } catch (e) {
      cart.coupon = null
      cart.version++
      throw e
    }
  }
  const lines: QuoteLine[] = view.items.map((i) => ({
    itemId: i.id, nftId: i.nftId, editionId: i.editionId, editionLabel: i.editionLabel, name: i.name, tokenId: i.tokenId,
    image: i.image, unitPrice: i.unitPrice, qty: i.qty, lineTotal: i.lineTotal,
  }))
  const summary = summarize(lines, cart.coupon, network)
  const fp = fingerprint({ l: lines.map((l) => [l.itemId, l.editionId, l.unitPrice, l.qty]), c: cart.coupon, summary, walletSlot })
  // Keep only the latest quotes per user.
  Object.values(db.quotes).filter((q) => q.userId === userId).slice(0, -9).forEach((q) => delete db.quotes[q.id])
  const q: DbQuote = { id: nextId('q'), userId, fingerprint: fp, walletSlot, expiresAt: Date.now() + 10 * 60_000, lines, coupon: cart.coupon, summary }
  db.quotes[q.id] = q
  return q
}

export const quoteView = (q: DbQuote): Quote => ({
  id: q.id, fingerprint: q.fingerprint, lines: q.lines, coupon: couponView(q.coupon), summary: q.summary, walletSlot: q.walletSlot, expiresAt: iso(q.expiresAt),
})

function changesBetween(a: DbQuote, b: DbQuote) {
  const out: string[] = []
  for (const l of b.lines) {
    const o = a.lines.find((x) => x.itemId === l.itemId)
    if (!o) out.push(`${l.name}: item adicionado`)
    else if (eth.cmp(o.unitPrice, l.unitPrice)) out.push(`${l.name}: ${o.unitPrice} → ${l.unitPrice} ETH`)
    else if (o.qty !== l.qty) out.push(`${l.name}: quantidade ${o.qty} → ${l.qty}`)
  }
  a.lines.filter((o) => !b.lines.some((l) => l.itemId === o.itemId)).forEach((o) => out.push(`${o.name}: removido`))
  if (eth.cmp(a.summary.discount, b.summary.discount)) out.push(`Desconto: ${a.summary.discount} → ${b.summary.discount} ETH`)
  if (eth.cmp(a.summary.networkFee, b.summary.networkFee)) out.push(`Taxa de rede: ${a.summary.networkFee} → ${b.summary.networkFee} ETH`)
  return out
}

/* ---------- orders ---------- */
export const orderView = ({ userId: _u, settleAt: _s, outcome: _o, couponCode: _c, ...o }: DbOrder): Order => o

/** Idempotent order creation: same key + same payload → same order; same key + other payload → 409. */
export function createOrder(userId: string, input: CreateOrderInput, key: string, declined: boolean) {
  const idKey = `${userId}:${key}`
  const hash = fingerprint(input)
  const prev = db.idem[idKey]
  if (prev) {
    if (prev.hash !== hash) throw new ApiFail(409, 'IDEMPOTENCY_CONFLICT', 'Esta tentativa de compra já foi usada com outro conteúdo.')
    return { order: db.orders.find((o) => o.id === prev.orderId)!, replay: true }
  }
  const pending = db.orders.find((o) => o.userId === userId && o.status === 'pending')
  if (pending) throw new ApiFail(409, 'CONFLICT', 'Você já tem um pedido aguardando confirmação.', undefined, { orderId: pending.id })
  const quoted = db.quotes[input.quoteId]
  if (!quoted || quoted.userId !== userId) throw new ApiFail(404, 'NOT_FOUND', 'Cotação não encontrada. Revise o pedido novamente.')
  // Never trust the earlier quote: revalidate price, availability, coupon and fees right now.
  const fresh = buildQuote(userId, quoted.summary.network, input.walletSlot)
  if (fresh.fingerprint !== input.fingerprint || quoted.fingerprint !== input.fingerprint || quoted.expiresAt < Date.now())
    throw new ApiFail(409, 'QUOTE_OUTDATED', 'Preço, disponibilidade ou taxas mudaram. Revise e confirme novamente.', undefined, {
      quote: quoteView(fresh),
      changes: changesBetween(quoted, fresh),
    })
  const conn = db.connections[userId]
  if (!conn || conn.slot !== input.walletSlot || conn.network !== fresh.summary.network)
    throw new ApiFail(422, 'VALIDATION_ERROR', 'Conecte a carteira selecionada antes de confirmar.', { walletSlot: 'Carteira desconectada' })
  // Collector data must match the wallet actually used (the client form is never trusted).
  const c = input.collector
  const fields: Record<string, string> = {}
  if (c.walletAddress.toLowerCase() !== db.wallets[userId][input.walletSlot]!.address.toLowerCase()) fields['collector.walletAddress'] = 'Endereço diferente da carteira selecionada'
  if (c.network !== conn.network) fields['collector.network'] = 'Rede diferente da carteira conectada'
  if (c.walletType !== conn.provider) fields['collector.walletType'] = 'Tipo diferente da carteira conectada'
  if (Object.keys(fields).length) throw new ApiFail(422, 'VALIDATION_ERROR', 'Os dados do colecionador não conferem com a carteira conectada.', fields)
  // Reserve stock (released again if the payment is declined).
  const touched = new Set<DbNft>()
  for (const l of fresh.lines) {
    const n = findNft(l.nftId)!
    edition(n, l.editionId)!.stock -= l.qty
    touched.add(n)
  }
  const wallet = db.wallets[userId][input.walletSlot]!
  const now = Date.now()
  const order: DbOrder = {
    id: nextId('ord'), status: 'pending', createdAt: iso(now), updatedAt: iso(now), lines: fresh.lines, coupon: couponView(fresh.coupon),
    summary: fresh.summary, wallet: { slot: input.walletSlot, label: wallet.nickname, address: wallet.secondaryAddress || wallet.address, provider: conn.provider },
    network: fresh.summary.network, txHash: null, declineReason: null, version: 1, userId, settleAt: now + 3000,
    outcome: declined ? 'declined' : 'confirmed', couponCode: fresh.coupon,
  }
  db.orders.push(order)
  db.idem[idKey] = { hash, orderId: order.id }
  delete db.quotes[fresh.id]
  touched.forEach(touchNft)
  return { order, replay: false }
}

/** Settle due pending orders (also runs lazily on reads, so a refresh never loses the outcome). */
export function settleDue(now = Date.now()) {
  for (const o of db.orders) if (o.status === 'pending' && o.settleAt <= now) settle(o)
}

export function settle(o: DbOrder) {
  if (o.status !== 'pending') return // confirmed/declined are terminal
  o.status = o.outcome
  o.version++
  o.updatedAt = iso()
  if (o.status === 'confirmed') {
    o.txHash = `0x${fingerprint(o.id).repeat(4)}`
    // Remove only the purchased items/quantities from the cart.
    const cart = getCart(`u:${o.userId}`)
    for (const l of o.lines) {
      const cl = cart.lines.find((x) => x.nftId === l.nftId && x.editionId === l.editionId)
      if (cl) cl.qty -= l.qty
    }
    cart.lines = cart.lines.filter((l) => l.qty > 0)
    if (o.couponCode && cart.coupon === o.couponCode) cart.coupon = null
    cart.version++
  } else {
    o.declineReason = 'Pagamento recusado pela carteira (saldo insuficiente na simulação).'
    const touched = new Set<DbNft>()
    for (const l of o.lines) {
      const n = findNft(l.nftId)
      const e = n && edition(n, l.editionId)
      if (!n || !e) continue
      e.stock += l.qty
      touched.add(n)
    }
    touched.forEach(touchNft)
  }
  save()
  broadcast({ id: nextId('evt'), type: 'order.updated', resource: { type: 'order', id: o.id }, version: o.version, occurredAt: iso(), data: { status: o.status } }, o.userId)
}
