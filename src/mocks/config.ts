// Mock runtime configuration: business scenario + network conditions, persisted per browser.
export const SCENARIOS = {
  default: 'Sucesso (latência leve)',
  slow: 'Rede lenta (2,5 s por requisição)',
  jitter: 'Latência variável (respostas fora de ordem)',
  offline: 'Sem conexão (REST e Socket.IO)',
  'server-error': 'Leituras retornam HTTP 503',
  empty: 'Catálogo vazio',
  'session-expired': 'Sessão expira em 45 s',
  'favorite-fail': 'Favoritar retorna HTTP 500',
  'price-change': 'Preço muda após a cotação',
  'sold-out': 'Edição esgota após a cotação',
  'order-timeout': 'Timeout após criar o pedido',
  'payment-declined': 'Pagamento recusado',
  'wallet-reject': 'Carteira recusa a conexão',
} as const

export type Scenario = keyof typeof SCENARIOS
export type Fault = { method?: string; path: string; status?: number; network?: boolean; delay?: number; times?: number }
type Config = { scenario: Scenario; seed: number; latency?: [number, number] }

const KEY = 'kurio:mock'
const isScenario = (s: unknown): s is Scenario => typeof s === 'string' && s in SCENARIOS

function read(): Config {
  let stored: Partial<Config> = {}
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    /* ignore corrupted config */
  }
  const env = import.meta.env.VITE_MOCK_SCENARIO
  const fromUrl = new URLSearchParams(location.search).get('scenario')
  const cfg: Config = { scenario: isScenario(env) ? env : 'default', seed: 42, ...stored }
  if (isScenario(fromUrl)) cfg.scenario = fromUrl
  if (!isScenario(cfg.scenario)) cfg.scenario = 'default'
  return cfg
}

export const config = read()
localStorage.setItem(KEY, JSON.stringify(config))

export function setConfig(patch: Partial<Config>) {
  Object.assign(config, patch)
  localStorage.setItem(KEY, JSON.stringify(config))
  rngState = config.seed
}

// Seeded PRNG (mulberry32) so latency sequences are reproducible.
let rngState = config.seed
export function rand() {
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function latency() {
  const [min, max] =
    config.latency ?? ({ slow: [2500, 2500], jitter: [80, 1600] } as Record<string, [number, number]>)[config.scenario] ?? [120, 320]
  return Math.round(min + rand() * (max - min))
}

// One-shot faults injected through window.__mock.failNext (tests / Mocks panel).
const faults: Fault[] = []
export const addFault = (f: Fault) => faults.push({ times: 1, ...f })
export function takeFault(method: string, path: string): Fault | undefined {
  const i = faults.findIndex((f) => (!f.method || f.method === method) && new RegExp(f.path).test(path))
  if (i < 0) return
  const f = faults[i]
  if (--f.times! <= 0) faults.splice(i, 1)
  return f
}
