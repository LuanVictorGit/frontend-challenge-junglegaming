import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }).format(new Date(iso))

/** Out-of-scope actions must not pretend to succeed: they explain they are unavailable. */
export const soon = (label: string) => toast.info(`${label} não faz parte desta demonstração.`)
