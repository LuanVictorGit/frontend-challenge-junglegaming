import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }).format(new Date(iso))

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
/** Compact date as in the receipt frame: "29 Jul, 2026". */
export const shortDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`
}

/** Out-of-scope actions must not pretend to succeed: they explain they are unavailable. */
export const soon = (label: string) => toast.info(`${label} não faz parte desta demonstração.`)
