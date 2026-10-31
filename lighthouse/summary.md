# Lighthouse — resultados (mediana de 3 execuções)

- Data: 2026-10-31T13:44:47.464Z
- Alvo: http://localhost:4174
- Ferramentas: Lighthouse 13.6.0 · Chrome/156.0.0.0 · local Chromium (Playwright 1.64.1) · Node v24.18.0
- Ambiente: Windows_NT 10.0.26300 (x64) · Intel(R) Core(TM) i5-9400F CPU @ 2.90GHz · 6 · 32 · 1691.5
- Condições: Production build (vite build) served locally with brotli; MSW mocks enabled, default scenario; cold load per run; Lighthouse mobile preset (simulated slow 4G, 4x CPU slowdown, Moto G Power viewport) and desktop preset.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | mobile | **77** ⚠ | 100 | 100 | 100 | 4156 ms | 0 | 387 ms |
| home | desktop | 99 | 100 | 100 | 100 | 892 ms | 0 | 8 ms |
| nft-detail | mobile | **78** ⚠ | 100 | 100 | 100 | 3841 ms | 0 | 410 ms |
| nft-detail | desktop | 99 | 100 | 100 | 100 | 858 ms | 0 | 4 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
Relatórios completos (HTML/JSON de cada execução) em `lighthouse/reports/`.
