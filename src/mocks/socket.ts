// Socket.IO server mock: MSW `ws` interception + @mswjs/socket.io-binding (websocket transport only).
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { RealtimeEvent } from '@/api/contracts'
import { config } from './config'
import { db } from './db'

// MSW strips the `/socket.io/` path prefix before matching, so the link targets the bare origin.
const URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.test'
type Conn = { token: string | null; io: ReturnType<typeof toSocketIo>; close: () => void }

const conns = new Map<string, Conn>()
let blockedUntil = 0
let last: { event: RealtimeEvent; userId?: string } | null = null

// A socket only receives private events while its handshake token is still a live session.
const userOf = (c: Conn) => {
  const s = c.token ? db.sessions[c.token] : undefined
  return s && s.expiresAt > Date.now() ? s.userId : null
}

export const socketHandler = ws.link(URL).addEventListener('connection', (connection) => {
  const { client } = connection
  // Simulated outage: drop the transport so socket.io-client retries with backoff.
  if (config.scenario === 'offline' || Date.now() < blockedUntil) return void queueMicrotask(() => client.close())
  const conn: Conn = { token: null, io: toSocketIo(connection), close: () => client.close() }
  conns.set(client.id, conn)
  // The binding mocks the Engine.IO handshake but not heartbeats: ping so the client never times out.
  const ping = setInterval(() => client.send('2'), 20_000)
  client.addEventListener('message', (e) => {
    // Socket.IO CONNECT packet ("40{auth}") carries the handshake auth payload.
    if (typeof e.data !== 'string' || !e.data.startsWith('40')) return
    try {
      const token = JSON.parse(e.data.slice(2) || '{}').token
      conn.token = typeof token === 'string' ? token : null
    } catch {
      conn.token = null
    }
  })
  client.addEventListener('close', () => {
    clearInterval(ping)
    conns.delete(client.id)
  })
})

/** Emit to every socket, or only to sockets authenticated as `userId`. */
export function broadcast(event: RealtimeEvent, userId?: string) {
  last = { event, userId }
  for (const c of conns.values()) if (!userId || userOf(c) === userId) c.io.client.emit(event.type, event)
}

export const replayLast = () => last && broadcast(last.event, last.userId)
export function dropSockets(blockMs = 0) {
  blockedUntil = Date.now() + blockMs
  conns.forEach((c) => c.close())
}
