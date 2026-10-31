// Fixed-point ETH math on BigInt (18 decimals): amounts travel as decimal strings and never touch floats.
const ONE = 10n ** 18n
const RE = /^(\d+)(?:\.(\d{1,18}))?$/

export const toWei = (v: string): bigint => {
  const m = RE.exec(v.trim())
  if (!m) throw new Error(`Invalid ETH amount: ${v}`)
  return BigInt(m[1]) * ONE + BigInt((m[2] ?? '').padEnd(18, '0'))
}

export const fromWei = (w: bigint): string => {
  const sign = w < 0n ? '-' : ''
  const a = w < 0n ? -w : w
  const frac = (a % ONE).toString().padStart(18, '0').replace(/0+$/, '')
  return `${sign}${a / ONE}${frac ? `.${frac}` : ''}`
}

export const eth = {
  add: (...v: string[]) => fromWei(v.reduce((s, x) => s + toWei(x), 0n)),
  sub: (a: string, b: string) => fromWei(toWei(a) - toWei(b)),
  mul: (a: string, qty: number) => fromWei(toWei(a) * BigInt(qty)),
  /** Percentage in basis points (1000 = 10%), floored to the wei. */
  bps: (a: string, bps: number) => fromWei((toWei(a) * BigInt(bps)) / 10000n),
  min: (a: string, b: string) => (toWei(a) <= toWei(b) ? a : b),
  max: (a: string, b: string) => (toWei(a) >= toWei(b) ? a : b),
  cmp: (a: string, b: string) => Math.sign(Number(toWei(a) - toWei(b))),
  isValid: (v: string) => RE.test(v),
}

/** Display format: 2..6 decimals (half-up rounding for display only). */
export function formatEth(v: string, min = 2, max = 6): string {
  const step = 10n ** BigInt(18 - max)
  const w = toWei(v)
  const [i, f = ''] = fromWei(((w + step / 2n) / step) * step).split('.')
  return `${i}.${f.padEnd(min, '0')}`
}
