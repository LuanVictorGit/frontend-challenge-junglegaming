// Realtime sync: socket.io-client → validated events → TanStack Query cache (with dedupe and version guards).
import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { NftUpdatedEvent, OrderUpdatedEvent, type Cart, type NftDetail, type NftList, type NftSummary, type Order } from '@/api/contracts'
import { qk } from '@/api/queries'
import { announce } from './announce'
import { backendReady, SOCKET_URL } from './backend'
import { eth, formatEth } from './eth'
import { session } from './session'

const seen = new Set<string>()
const versions = new Map<string, number>()

/** Accept each event once and never apply a version older than one already applied. */
function accept(e: { id: string; version: number; resource: { type: string; id: string } }) {
  if (seen.has(e.id)) return false
  seen.add(e.id)
  if (seen.size > 500) seen.delete(seen.values().next().value!)
  const key = `${e.resource.type}:${e.resource.id}`
  if ((versions.get(key) ?? 0) >= e.version) return false
  versions.set(key, e.version)
  return true
}

function onNft(qc: QueryClient, raw: unknown) {
  const p = NftUpdatedEvent.safeParse(raw)
  if (!p.success || !accept(p.data)) return
  const e = p.data
  const id = e.resource.id
  const { price, compareAtPrice, available } = e.data
  const patch = <T extends NftSummary>(s: T): T => (s.id === id && s.version < e.version ? { ...s, price, compareAtPrice, available, version: e.version } : s)

  qc.setQueryData<NftDetail>(qk.nft(id), (old) =>
    old && old.version < e.version
      ? { ...patch(old), editions: old.editions.map((ed) => ({ ...ed, ...e.data.editions.find((x) => x.id === ed.id) })) }
      : old,
  )
  qc.setQueriesData<NftList>({ queryKey: ['nfts', 'list'] }, (old) => old && { ...old, items: old.items.map(patch) })
  qc.setQueriesData<NftSummary[]>({ queryKey: ['nfts', 'related'] }, (old) => old?.map(patch))
  qc.setQueriesData<{ featured: NftSummary | null; trending: NftSummary[] }>({ queryKey: qk.highlights }, (old) =>
    old && { featured: old.featured && patch(old.featured), trending: old.trending.map(patch) },
  )

  // Cart: explain what changed, then let the server recompute every total.
  for (const [key, cart] of qc.getQueriesData<Cart>({ queryKey: ['cart'] })) {
    const items = cart?.items.filter((i) => i.nftId === id) ?? []
    for (const it of items) {
      const ed = e.data.editions.find((x) => x.id === it.editionId)
      if (!ed) continue
      const msg =
        ed.stock < it.qty
          ? `${it.name} (${it.editionLabel}): disponibilidade reduzida para ${ed.stock}.`
          : eth.cmp(ed.price, it.unitPrice)
            ? `${it.name} (${it.editionLabel}): preço alterado de ${formatEth(it.unitPrice)} para ${formatEth(ed.price)} ETH.`
            : null
      if (msg) {
        toast.warning(msg, { id: `nft-${id}-${it.editionId}` })
        announce(msg)
      }
    }
    if (items.length) qc.invalidateQueries({ queryKey: key })
  }
  window.dispatchEvent(new CustomEvent('kurio:nft-updated', { detail: id }))
}

function onOrder(qc: QueryClient, raw: unknown) {
  const p = OrderUpdatedEvent.safeParse(raw)
  const uid = session.get()?.user.id
  if (!p.success || !uid || !accept(p.data)) return
  const e = p.data
  const key = qk.order(uid, e.resource.id)
  const cached = qc.getQueryData<Order>(key)
  if (cached && (cached.version >= e.version || cached.status !== 'pending')) return // terminal states never regress
  qc.invalidateQueries({ queryKey: key }) // REST holds the full receipt snapshot
  if (e.data.status === 'confirmed') {
    qc.invalidateQueries({ queryKey: ['cart'] })
    toast.success('Pagamento confirmado na rede!')
    announce('Pagamento confirmado.')
  } else if (e.data.status === 'declined') {
    toast.error('Pagamento recusado pela carteira.')
    announce('Pagamento recusado.')
  }
}

/** After a reconnection, resync with REST everything the socket may have missed. */
function reconcile(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['nfts'] })
  qc.invalidateQueries({ queryKey: ['cart'] })
  const uid = session.get()?.user.id
  if (uid) qc.invalidateQueries({ queryKey: ['me', uid, 'order'] })
}

/** One socket per session: a token change tears down the previous socket and its listeners. */
export function startRealtime(qc: QueryClient) {
  let socket: Socket | null = null
  let gen = 0
  let token: string | undefined | null = null

  const connect = async () => {
    const my = ++gen
    socket?.removeAllListeners()
    socket?.disconnect()
    socket = null
    await backendReady
    const { io } = await import('socket.io-client') // lazy: keeps it off the critical path
    if (my !== gen) return
    const s = io(SOCKET_URL, { transports: ['websocket'], auth: { token }, timeout: 5000, reconnectionDelay: 500, reconnectionDelayMax: 4000 })
    socket = s
    let connectedBefore = false
    s.on('connect', () => {
      if (connectedBefore) reconcile(qc)
      connectedBefore = true
    })
    s.on('nft.updated', (ev) => my === gen && onNft(qc, ev))
    s.on('order.updated', (ev) => my === gen && onOrder(qc, ev))
  }

  const sync = () => {
    const t = session.get()?.token
    if (t === token && socket) return
    token = t
    connect()
  }
  sync()
  const unsub = session.subscribe(sync)
  return () => {
    unsub()
    gen++
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}
