# Lighthouse — resultados (mediana de 3 execuções)

Data: 2026-10-31T13:14:37.587Z · Lighthouse 13.6.0 · Chrome/156.0.0.0 · Node v24.18.0 · Playwright 1.64.1
Ambiente: Windows_NT 10.0.26300 (x64), Intel(R) Core(TM) i5-9400F CPU @ 2.90GHz (6 núcleos, 32 GB), benchmarkIndex 1627
Condições: vite build (production) served locally with brotli; MSW mocks enabled, default scenario; fresh storage per run; Lighthouse default mobile (simulated slow 4G, 4x CPU) and desktop presets.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | mobile | **57** ⚠ | 95 | 100 | 100 | 5058 ms | 0.143 | 623 ms |
| home | desktop | 99 | 96 | 100 | 100 | 885 ms | 0.002 | 11 ms |
| nft-detail | mobile | **67** ⚠ | 99 | 100 | 100 | 4574 ms | 0 | 680 ms |
| nft-detail | desktop | 98 | 100 | 100 | 100 | 1082 ms | 0 | 20 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
Relatórios completos (HTML/JSON de cada execução) em `lighthouse/reports/`.
