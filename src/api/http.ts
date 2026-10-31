// Axios client: waits for the backend, attaches auth/cart headers and normalizes errors into ApiError.
import axios, { type AxiosError } from 'axios'
import { backendReady } from '@/lib/backend'
import { cartId, session } from '@/lib/session'
import { ApiErrorBody, type ErrorCode } from './contracts'

type Code = ErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: Code,
    public fields?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message)
  }
  get retryable() {
    return ['NETWORK', 'TIMEOUT', 'TRANSIENT'].includes(this.code) || this.status >= 500
  }
}

/** Fired when the server rejects the current session (expired/invalid). */
export const sessionEvents = new EventTarget()

export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api', timeout: 10_000 })

http.interceptors.request.use(async (cfg) => {
  await backendReady
  const s = session.get()
  if (s) cfg.headers.Authorization = `Bearer ${s.token}`
  const cid = cartId.get()
  if (cid) cfg.headers['X-Cart-Id'] = cid
  return cfg
})

http.interceptors.response.use(undefined, (err: AxiosError) => {
  if (axios.isCancel(err)) return Promise.reject(new ApiError('Requisição cancelada.', 0, 'CANCELED'))
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return Promise.reject(new ApiError('O servidor demorou para responder.', 0, 'TIMEOUT'))
  if (!err.response) return Promise.reject(new ApiError('Sem conexão com o servidor. Verifique sua internet.', 0, 'NETWORK'))
  const parsed = ApiErrorBody.safeParse(err.response.data)
  const e = parsed.success ? parsed.data.error : { code: 'INTERNAL' as const, message: 'Erro inesperado no servidor.' }
  const status = err.response.status
  // Only the session that made the request is dropped (a stale request can't log out a newer session).
  const sent = err.config?.headers?.Authorization
  if (status === 401 && sent && sent === `Bearer ${session.get()?.token}`) {
    session.set(null)
    sessionEvents.dispatchEvent(new CustomEvent('expired', { detail: e.code }))
  }
  return Promise.reject(new ApiError(e.message, status, e.code, 'fields' in e ? e.fields : undefined, 'details' in e ? e.details : undefined))
})
