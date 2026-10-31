import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

const SHORT_MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
const formats = new Map<string, Intl.DateTimeFormat>()
/** pt-BR, UTC. Default "12 de set. de 2026" is built by hand (same output as Intl, without its ~10ms first-use cost); custom options reuse cached formatters. */
export const formatDate = (iso: string, opts?: Intl.DateTimeFormatOptions) => {
  const d = new Date(iso)
  if (!opts) return `${String(d.getUTCDate()).padStart(2, '0')} de ${SHORT_MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
  const key = JSON.stringify(opts)
  if (!formats.has(key)) formats.set(key, new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }))
  return formats.get(key)!.format(d)
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
/** Compact date as in the receipt frame: "29 Jul, 2026". */
export const shortDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`
}

/** Out-of-scope actions must not pretend to succeed: they explain they are unavailable. */
export const soon = (label: string) => toast.info(`${label} não faz parte desta demonstração.`)
