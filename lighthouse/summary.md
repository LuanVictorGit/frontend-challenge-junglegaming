# Lighthouse — resultados (mediana de 3 execuções)

- Data: 2026-10-31T17:06:58.471Z
- Alvo: https://junglenfts.netlify.app
- Ferramentas: Lighthouse 13.6.0 · Chrome/156.0.0.0 · local Chromium (Playwright 1.64.1) · Node v24.18.0
- Ambiente: Windows_NT 10.0.26300 (x64) · Intel(R) Core(TM) i5-9400F CPU @ 2.90GHz · 6 · 32 · 1658.5
- Condições: Deployed production build (Netlify CDN); MSW mocks enabled, default scenario; cold load per run; Lighthouse mobile preset (simulated slow 4G, 4x CPU slowdown, Moto G Power viewport) and desktop preset; Chrome flags: --headless=new --no-first-run --disable-gpu.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | mobile | 92 | 100 | 100 | 100 | 2575 ms | 0.003 | 250 ms |
| home | desktop | 100 | 100 | 100 | 100 | 622 ms | 0.001 | 0 ms |
| nft-detail | mobile | 91 | 100 | 100 | 100 | 2595 ms | 0.003 | 275 ms |
| nft-detail | desktop | 100 | 100 | 100 | 100 | 631 ms | 0.001 | 0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
Relatórios completos (HTML/JSON de cada execução) em `lighthouse/reports/`.

## Análise

### Resultado

Todas as metas foram atingidas na mediana das 3 execuções por página e perfil (tabela acima). A nota de performance mobile varia alguns pontos entre execuções do mesmo build (nesta rodada, de 90 a 93 na home e de 89 a 92 no detalhe). Isso acontece porque o throttling simulado do Lighthouse parte da latência de rede observada até a CDN e do tempo de CPU da máquina que mede.

### Condições e ambiente

- **Alvo:** build publicado na Netlify (HTTP/2, brotli, CDN), cenário padrão dos mocks e carga fria a cada execução (perfil novo do Chrome).
- **Throttling:** simulado do Lighthouse (Lantern). No mobile, 4G lento simulado e CPU 4× mais lenta aplicada às tarefas observadas.
- **`--disable-gpu`:** no Windows, o Chrome headless emula a GPU por software (SwiftShader). Medimos que isso segura a apresentação do primeiro frame por ~1 s (FCP observado de ~1,3 s, contra ~0,3 s com rasterização por CPU), sem relação com o site. É um artefato do ambiente, que aparelhos reais (com GPU) e ambientes de CI não têm. Com a GPU emulada, a nota mobile cai de 3 a 5 pontos.
- **Entrega completa:** a auditoria carrega imagens, fonte, backend simulado (MSW e Socket.IO), tempo real e todas as funcionalidades. Também entra o selo que a Netlify injeta em sites do plano gratuito (`/.netlify/scripts/hud`, ~11 KB). Nada é desligado para pontuar.

### O que ainda pesa no mobile

- **LCP (~2,6 s):**
  - Na home, o elemento LCP é a imagem do hero (estática e pré-carregada) ou a primeira linha do catálogo.
  - No detalhe, é a imagem principal do NFT. Ela depende de `GET /nfts/:id`, e antes dessa resposta o chunk do backend simulado precisa carregar, registrar o service worker e responder com a latência do cenário padrão (120–320 ms).
- **TBT (250–275 ms):**
  - avaliação do bundle (React DOM, TanStack Router/Query, Axios e o Zod construindo os schemas);
  - primeira renderização;
  - backend simulado rodando na mesma thread (handlers do MSW, validação e "banco" no `localStorage`).

  Num deploy real, o chunk de mocks (~41 KB brotli), o service worker e a CPU dos handlers ficariam no servidor.

### O que foi feito

Na mesma configuração, o mobile saiu de 74–76 para 91–92.

- **Caminho crítico:**
  - CSS embutido no HTML (o arquivo continua publicado para os chunks que o listam);
  - preload da fonte e da imagem LCP;
  - WebP responsivo com `sizes` igual à largura renderizada: cards, trilhos e detalhe não baixam mais variantes maiores que o necessário;
  - chunk de mocks baixado em paralelo ao entry.
- **Menos JS antes da primeira pintura:** filtros, ordenação e a gaveta mobile (Select, Slider e Dialog do Radix), o diálogo de busca e o zoom do detalhe carregam no primeiro uso.
- **Primeira renderização enxuta:**
  - só o layout visível é montado;
  - na carga fria, o corpo do catálogo, as seções editoriais e o rodapé entram numa transição logo após a primeira pintura;
  - resultados do catálogo, abas do detalhe no mobile e "Mais desta coleção" renderizam em baixa prioridade (`useDeferredValue`);
  - seções abaixo da dobra usam `content-visibility: auto`.
- **Backend simulado mais barato:**
  - o service worker só entrega `/api/*` ao MSW;
  - `tough-cookie` trocado por um shim (chunk de mocks de 174 KB para 53 KB gzip);
  - nada de ICU no caminho crítico (ordenação padrão e datas).

Para conferir no PageSpeed Insights, `npm run lighthouse:psi` (com `PSI_API_KEY`) roda as mesmas medições pela API do Google.
