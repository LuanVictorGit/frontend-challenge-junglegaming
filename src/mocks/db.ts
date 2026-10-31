// Mock database: single JSON state persisted in localStorage so REST + Socket.IO survive refreshes.
import type { ErrorCode, Order, QuoteLine, Summary, Wallet, WalletConnection, WalletSlot } from '@/api/contracts'
import { seedNfts, seedUsers, seedWallets, type DbNft, type DbUser } from './fixtures'

export type DbCartLine = { id: string; nftId: string; editionId: string; qty: number }
export type DbCart = { id: string; lines: DbCartLine[]; coupon: string | null; version: number }
export type DbQuote = { id: string; userId: string; fingerprint: string; walletSlot: WalletSlot; expiresAt: number; lines: QuoteLine[]; coupon: string | null; summary: Summary }
export type DbOrder = Order & { userId: string; settleAt: number; outcome: 'confirmed' | 'declined'; couponCode: string | null }

export type Db = {
  v: 2
  seq: number
  users: DbUser[]
  sessions: Record<string, { userId: string; expiresAt: number }>
  nfts: DbNft[]
  favorites: Record<string, string[]>
  carts: Record<string, DbCart>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  connections: Record<string, WalletConnection | null>
  quotes: Record<string, DbQuote>
  orders: DbOrder[]
  idem: Record<string, { hash: string; orderId: string }>
  attempts: Record<string, { count: number; until: number }>
}

const KEY = 'kurio:db:v2'

const seed = (): Db => ({
  v: 2, seq: 1, users: seedUsers(), sessions: {}, nfts: seedNfts(), favorites: { u_ana: ['emerald-ape-042'] },
  carts: {}, wallets: seedWallets(), connections: {}, quotes: {}, orders: [], idem: {}, attempts: {},
})

function load(): Db {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw?.v === 2) return raw
  } catch {
    /* corrupted state falls back to the seed */
  }
  return seed()
}

export let db = load()
export const save = () => localStorage.setItem(KEY, JSON.stringify(db))
export function resetDb() {
  db = seed()
  save()
}
// Keep tabs consistent: another tab wrote the DB.
addEventListener('storage', (e) => e.key === KEY && (db = load()))

export const nextId = (prefix: string) => `${prefix}_${(db.seq++).toString(36).padStart(4, '0')}`

/** Error thrown by handlers; mapped to the ApiErrorBody contract. */
export class ApiFail extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message)
  }
}

/* ---------- crypto (WebCrypto; requires a secure context) ---------- */
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)))

export const randomHex = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)))

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: 100_000 }, key, 256)
  return hex(bits)
}

/** Constant-time comparison to avoid timing side channels. */
export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/** Small deterministic hash (FNV-1a, 2×32 bits) for fingerprints and idempotency payloads. */
export function fingerprint(value: unknown) {
  const s = JSON.stringify(value)
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619)
    h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822507)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}
