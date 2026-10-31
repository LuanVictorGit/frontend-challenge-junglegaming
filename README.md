# Kurio — Marketplace de NFTs

Implementação do [desafio frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): descoberta, compra e conta do colecionador, com backend **simulado na camada de rede** (MSW + Socket.IO).

- **Demo publicada:** https://junglenfts.netlify.app (mocks ativos; acesso direto e refresh em qualquer rota)
- **Stack:** React 19 · TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS v4 · shadcn/ui · MSW 2 (+ `@mswjs/socket.io-binding`) · Playwright · Lighthouse
- Decisões técnicas, contratos e limitações: [`ARCHITECTURE.md`](ARCHITECTURE.md)

## Setup

Requisitos: Node 22+ e npm.

```bash
npm ci
npx playwright install chromium   # apenas para os testes E2E e a auditoria
npm run dev                       # http://localhost:5173 com mocks
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (MSW + Socket.IO simulados) |
| `npm run dev:nomocks` | Desenvolvimento apontando para uma API/Socket.IO reais (`.env.nomocks`) |
| `npm run build` | Verificação de tipos + build otimizado em `dist/` |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (build + preview automáticos; desktop 1440 e mobile 390) |
| `npm run test:e2e:update` | Regenera as baselines de regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML (traces das falhas em `test-results/`) |
| `npm run lighthouse` | Auditoria local do build (3 execuções × página × perfil, mediana) |
| `npm run lighthouse:psi` | Mesma auditoria via PageSpeed Insights contra a URL publicada |

## Variáveis de ambiente

Definidas em `.env` (versionado, sem segredos):

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_MOCKS` | `true` | Liga o backend simulado (também no build de demonstração) |
| `VITE_MOCK_SCENARIO` | `default` | Cenário inicial dos mocks |
| `VITE_API_URL` | `/api` | Base REST usada pelo Axios |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.test` | Endpoint Socket.IO (interceptado pelo MSW) |

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Lima (2 carteiras, 1 favorito) | `ana@kurio.test` | `Kurio@123` |
| Bruno Costa (1 carteira) | `bruno@kurio.test` | `Kurio@456` |

As senhas existem no banco simulado apenas como hash PBKDF2-SHA256 (100k iterações, salt por usuário). Cupons: `KURIO10` (10%), `GENESIS` (0.05 ETH acima de 0.5 ETH), `HALLOWEEN25` (expirado); qualquer outro é inválido.

## Cenários dos mocks

Selecione pela URL (`?scenario=<nome>`, persistido no navegador) ou por `VITE_MOCK_SCENARIO`. **Reset:** `?reset` restaura integralmente o seed (dados, sessão e carrinho), por exemplo `https://junglenfts.netlify.app/?scenario=default&reset`.

| Cenário | Efeito |
| --- | --- |
| `default` | Sucesso, latência leve (120–320 ms, semente fixa) |
| `slow` | 2,5 s por requisição (skeletons) |
| `jitter` | Latência variável 80–1600 ms (respostas fora de ordem) |
| `offline` | Rede indisponível (REST e Socket.IO) |
| `server-error` | Leituras retornam HTTP 503 |
| `empty` | Catálogo vazio |
| `session-expired` | Sessões expiram em 45 s |
| `favorite-fail` | Favoritar retorna HTTP 500 (rollback otimista) |
| `price-change` | Preço do 1º item muda 1,5 s após a cotação |
| `sold-out` | Edição do 1º item esgota 1,5 s após a cotação |
| `order-timeout` | Pedido é criado, mas a resposta não chega a tempo (recuperação por idempotência) |
| `payment-declined` | Pagamento recusado |
| `wallet-reject` | Carteira recusa a conexão |

Controle fino pelo console do navegador (o mesmo usado pelos testes): `window.__mock.updateNft(id, { price, stock, editionId })`, `replayLastEvent()`, `emitStaleNft(id)`, `dropSockets(ms)`, `expireSessions()`, `failNext({ method, path, status, network, delay, times })`, `setLatency(min, max)`, `setScenario(nome)`, `reset()`. Todos atuam no **servidor simulado**: os efeitos chegam à interface pelas respostas REST e pelos eventos do `socket.io-client`.

## Reproduzindo os fluxos de falha

1. **Preço/disponibilidade em tempo real:** entre como Ana, adicione um NFT, abra o carrinho e rode `__mock.updateNft('emerald-ape-042', { price: '1.50' })` — o aviso aparece e o resumo é recalculado pela API. No checkout, abra “Revisar pedido” e repita: a cotação fica desatualizada e a confirmação exige nova cotação. Ou use `?scenario=price-change` / `?scenario=sold-out`.
2. **Cotação desatualizada sem evento:** com a revisão aberta, rode `__mock.dropSockets(30000)` e depois `__mock.updateNft(...)`; ao confirmar, a API responde 409 com as diferenças e pede nova confirmação.
3. **Timeout com idempotência:** `?scenario=order-timeout` → confirme a compra; após 8 s o cliente reenvia com a mesma `Idempotency-Key` e recupera o mesmo pedido.
4. **Pagamento recusado:** `?scenario=payment-declined` → o pedido termina recusado e os itens continuam no carrinho.
5. **Queda de conexão com pedido pendente:** confirme uma compra e, na tela do pedido, rode `__mock.dropSockets(5000)` ou recarregue a página; ao reconectar, o estado é reconciliado via REST sem nova compra.
6. **Sessão expirada:** `__mock.expireSessions()` (ou `?scenario=session-expired`) e navegue para uma área privada; o login retorna ao fluxo anterior (o rascunho do checkout é preservado).
7. **Falhas de rede/HTTP:** `?scenario=offline`, `?scenario=server-error`, `?scenario=slow`, ou `__mock.failNext({ path: '^/nfts', status: 503, times: 3 })`.

## Testes

`npm run test:e2e` executa 25 cenários × 2 viewports (Chromium 1440×900 e 390×844), cobrindo os 12 grupos pedidos no desafio, mais regressão visual de início, detalhe, carrinho e pagamento (baselines versionadas em `e2e/visual.spec.ts-snapshots/`, geradas em Windows; em outro SO rode `npm run test:e2e:update`). Cada teste usa um contexto isolado (banco simulado novo), latência controlada e, nos cenários sensíveis a tempo, o relógio do Playwright (`page.clock`). Eventos em tempo real passam pelo `socket.io-client` e as chamadas REST pelos handlers MSW.

## Auditoria de performance

Configuração versionada em `lighthouse/config.json`; resultados (mediana de 3 execuções por página e perfil, com LCP, CLS e TBT, versões e ambiente) em [`lighthouse/summary.md`](lighthouse/summary.md) e relatórios HTML/JSON em `lighthouse/reports/`.
