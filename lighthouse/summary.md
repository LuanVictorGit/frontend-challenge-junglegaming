# Lighthouse — resultados (mediana de 3 execuções)

- Data: 2026-10-31T14:07:06.667Z
- Alvo: http://localhost:4174
- Ferramentas: Lighthouse 13.6.0 · Chrome/156.0.0.0 · local Chromium (Playwright 1.64.1) · Node v24.18.0
- Ambiente: Windows_NT 10.0.26300 (x64) · Intel(R) Core(TM) i5-9400F CPU @ 2.90GHz · 6 · 32 · 1641.5
- Condições: Production build (vite build) served locally with brotli; MSW mocks enabled, default scenario; cold load per run; Lighthouse mobile preset (simulated slow 4G, 4x CPU slowdown, Moto G Power viewport) and desktop preset.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | mobile | **74** ⚠ | 100 | 100 | 100 | 3973 ms | 0 | 542 ms |
| home | desktop | 99 | 100 | 100 | 100 | 860 ms | 0 | 12 ms |
| nft-detail | mobile | **76** ⚠ | 100 | 100 | 100 | 3781 ms | 0 | 518 ms |
| nft-detail | desktop | 99 | 100 | 100 | 100 | 854 ms | 0 | 13 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
Relatórios completos (HTML/JSON de cada execução) em `lighthouse/reports/`.
