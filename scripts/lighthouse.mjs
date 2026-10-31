// Lighthouse audit — 3 runs per page × profile, median per category + LCP/CLS/TBT → lighthouse/summary.{md,json}.
//   node scripts/lighthouse.mjs                      → local Chromium, dist/ served with brotli (mocks on, default scenario)
//   node scripts/lighthouse.mjs --url <https://url>   → local Chromium against the deployed site
//   node scripts/lighthouse.mjs --psi <https://url>   → PageSpeed Insights API (set PSI_API_KEY to avoid the shared quota)
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync } from 'node:zlib'
import os from 'node:os'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { ReportGenerator } from 'lighthouse/report/generator/report-generator.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const cfg = JSON.parse(await readFile(join(root, 'lighthouse/config.json'), 'utf8'))
const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1]?.replace(/\/$/, '') : null)
const psi = arg('--psi')
const remote = psi ?? arg('--url')
const out = join(root, 'lighthouse/reports')
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const retry = async (fn, n = 3) => {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= n) throw e
      console.warn(`  retry ${i}: ${e.message}`)
    }
  }
}

/* ---------- local: static server mirroring production (brotli, immutable assets, SPA fallback) ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain', '.json': 'application/json' }
function serveDist() {
  const dist = join(root, 'dist')
  const cache = new Map()
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '')
    let file = join(dist, path)
    let body = await readFile(file).catch(() => null)
    if (!body) body = await readFile((file = join(dist, 'index.html')))
    const type = TYPES[extname(file)] ?? 'application/octet-stream'
    const headers = { 'Content-Type': type, 'Cache-Control': file.includes('assets') ? 'public, max-age=31536000, immutable' : 'no-cache' }
    if (/text|javascript|json|svg/.test(type) && /br/.test(req.headers['accept-encoding'] ?? '')) {
      if (!cache.has(file)) cache.set(file, brotliCompressSync(body))
      body = cache.get(file)
      headers['Content-Encoding'] = 'br'
    }
    res.writeHead(200, headers).end(body)
  })
  return new Promise((r) => server.listen(cfg.port, () => r(server)))
}

async function localRun(url, profile) {
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: cfg.chromeFlags })
  try {
    const { lhr } = await lighthouse(url, { port: chrome.port, onlyCategories: cfg.categories, logLevel: 'error' }, profile === 'desktop' ? desktopConfig : undefined)
    return lhr
  } finally {
    await chrome.kill()
  }
}

async function psiRun(url, profile) {
  const cats = cfg.categories.map((c) => `category=${c.toUpperCase().replace('-', '_')}`).join('&')
  const key = process.env.PSI_API_KEY ? `&key=${process.env.PSI_API_KEY}` : ''
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${profile}&${cats}${key}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? res.statusText)
  return json.lighthouseResult
}

/* ---------- runs ---------- */
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
const server = remote ? null : await serveDist()
const base = remote ?? `http://localhost:${cfg.port}`
const runs = []
let env

for (const page of cfg.pages)
  for (const profile of cfg.profiles)
    for (let run = 1; run <= cfg.runs; run++) {
      const lhr = await retry(() => (psi ? psiRun : localRun)(base + page.path, profile))
      const name = `${page.name}-${profile}-${run}`
      await writeFile(join(out, `${name}.report.json`), JSON.stringify(lhr))
      await writeFile(join(out, `${name}.report.html`), ReportGenerator.generateReportHtml(lhr))
      env ??= { lighthouse: lhr.lighthouseVersion, userAgent: lhr.environment.hostUserAgent, benchmarkIndex: lhr.environment.benchmarkIndex }
      const r = {
        page: page.name, profile, run,
        scores: Object.fromEntries(cfg.categories.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
        lcp: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
        cls: +lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3),
        tbt: Math.round(lhr.audits['total-blocking-time'].numericValue),
        throttling: lhr.configSettings.throttling,
      }
      runs.push(r)
      console.log(name, JSON.stringify(r.scores), `LCP ${r.lcp}ms CLS ${r.cls} TBT ${r.tbt}ms`)
    }
server?.close()

/* ---------- medians + metadata ---------- */
const summary = []
for (const page of cfg.pages)
  for (const profile of cfg.profiles) {
    const rs = runs.filter((r) => r.page === page.name && r.profile === profile)
    summary.push({
      page: page.name, profile,
      scores: Object.fromEntries(cfg.categories.map((c) => [c, median(rs.map((r) => r.scores[c]))])),
      lcp: median(rs.map((r) => r.lcp)), cls: median(rs.map((r) => r.cls)), tbt: median(rs.map((r) => r.tbt)),
      throttling: rs[0].throttling,
    })
  }

const meta = {
  date: new Date().toISOString(),
  target: base,
  tools: {
    lighthouse: env.lighthouse,
    chrome: env.userAgent.match(/Chrome\/[\d.]+/)?.[0],
    node: process.version,
    runner: psi ? 'PageSpeed Insights API v5' : `local Chromium (Playwright ${JSON.parse(await readFile(join(root, 'node_modules/playwright/package.json'), 'utf8')).version})`,
  },
  environment: psi
    ? { host: 'Google PageSpeed Insights infrastructure', benchmarkIndex: env.benchmarkIndex }
    : { os: `${os.type()} ${os.release()} (${os.arch()})`, cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryGB: Math.round(os.totalmem() / 2 ** 30), benchmarkIndex: env.benchmarkIndex },
  conditions: `${remote ? 'Deployed production build (Netlify CDN)' : 'Production build (vite build) served locally with brotli'}; MSW mocks enabled, default scenario; cold load per run; Lighthouse mobile preset (simulated slow 4G, 4x CPU slowdown, Moto G Power viewport) and desktop preset${psi ? '' : `; Chrome flags: ${cfg.chromeFlags.join(' ')}`}.`,
}
await writeFile(join(root, 'lighthouse/summary.json'), JSON.stringify({ meta, targets: cfg.targets, summary, runs }, null, 2))

const ok = (c, v) => (v >= cfg.targets[c] ? `${v}` : `**${v}** ⚠`)
const md = [
  '# Lighthouse — resultados (mediana de 3 execuções)',
  '',
  `- Data: ${meta.date}`,
  `- Alvo: ${meta.target}`,
  `- Ferramentas: Lighthouse ${meta.tools.lighthouse} · ${meta.tools.chrome} · ${meta.tools.runner} · Node ${meta.tools.node}`,
  `- Ambiente: ${Object.values(meta.environment).join(' · ')}`,
  `- Condições: ${meta.conditions}`,
  '',
  '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...summary.map((s) => `| ${s.page} | ${s.profile} | ${ok('performance', s.scores.performance)} | ${ok('accessibility', s.scores.accessibility)} | ${ok('best-practices', s.scores['best-practices'])} | ${ok('seo', s.scores.seo)} | ${s.lcp} ms | ${s.cls} | ${s.tbt} ms |`),
  '',
  `Metas: Performance ≥ ${cfg.targets.performance}, Accessibility ≥ ${cfg.targets.accessibility}, Best Practices ≥ ${cfg.targets['best-practices']}, SEO ≥ ${cfg.targets.seo}.`,
  'Relatórios completos (HTML/JSON de cada execução) em `lighthouse/reports/`.',
  '',
]
// Hand-written analysis (causes, justification, PSI cross-check) is versioned apart and appended.
const analysis = await readFile(join(root, 'lighthouse/analysis.md'), 'utf8').catch(() => '')
await writeFile(join(root, 'lighthouse/summary.md'), md.join('\n') + (analysis && `\n${analysis}`))
console.log('\n' + md.join('\n'))
