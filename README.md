# Kurio — Marketplace de NFTs

Implementação do [desafio frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): descoberta, compra e conta do colecionador, com backend **simulado na camada de rede** (MSW + Socket.IO).

- **Demo publicada:** https://junglenfts.netlify.app (mocks ativos; acesso direto e refresh em qualquer rota)
- **Stack:** React 19 · TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS v4 · shadcn/ui · MSW 2 (+ `@mswjs/socket.io-binding`) · Playwright · Lighthouse
- Decisões técnicas, contratos e limitações: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Onde cada item do enunciado está implementado e testado: [Mapa de requisitos](#mapa-de-requisitos)

## Setup

Requisitos: Node 22+ e npm.

```bash
npm ci
npx playwright install chromium   # apenas para os testes E2E e a auditoria
npm run dev                       # http://localhost:5173 com mocks
```

No npm 12+, o aviso sobre o `postinstall` do `msw` pode ser ignorado: o service worker do MSW já está versionado em `public/`.

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
| `npm run lighthouse` | Lighthouse local sobre o build (3 execuções × página × perfil, mediana, relatórios HTML/JSON) |
| `npm run lighthouse:prod` | O mesmo Lighthouse local contra a URL publicada |
| `npm run lighthouse:psi` | PageSpeed Insights via API (requer `PSI_API_KEY`; sem chave a cota anônima esgota rápido) |

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

`npm run test:e2e` executa 26 cenários × 2 viewports (Chromium 1440×900 e 390×844), cobrindo os 12 grupos pedidos no desafio, mais regressão visual de início, detalhe, carrinho e pagamento (baselines versionadas em `e2e/visual.spec.ts-snapshots/`, geradas em Windows; em outro SO rode `npm run test:e2e:update`). Cada teste usa um contexto isolado (banco simulado novo), latência controlada e, nos cenários sensíveis a tempo, o relógio do Playwright (`page.clock`). Eventos em tempo real passam pelo `socket.io-client` e as chamadas REST pelos handlers MSW.

## Auditoria de performance

Configuração versionada em `lighthouse/config.json`. Resultados (mediana de 3 execuções por página e perfil, com LCP, CLS e TBT, versões, ambiente e condições) em [`lighthouse/summary.md`](lighthouse/summary.md), com os relatórios HTML/JSON em `lighthouse/reports/` e a análise dos resultados.

## Mapa de requisitos

Onde cada seção do [enunciado](https://github.com/junglegaming/frontend-challenge) está implementada, com os testes correspondentes em [`e2e/`](e2e) (executados em desktop 1440×900 e mobile 390×844).

### 1. Escopo

- **Descoberta, compra e conta, em desktop e mobile, com dados simulados:** telas em [`src/routes`](src/routes) e backend simulado em [`src/mocks`](src/mocks). Cada breakpoint monta só o próprio layout (`useMedia`, [`src/lib/use-media.ts`](src/lib/use-media.ts)).
- **Ações fora do escopo** (diário, newsletter, links de ajuda e áreas não entregues): exibem um aviso de que não fazem parte da demonstração (`soon()` em [`src/lib/utils.ts`](src/lib/utils.ts)).

### 2. Stack obrigatória

| Tecnologia | Onde participa |
| --- | --- |
| React 19 + TypeScript | Todo o `src/` (TypeScript estrito, `npm run typecheck`) |
| TanStack Router | Rotas por arquivo em [`src/routes`](src/routes); search params validados (`HomeSearch` em [`Catalog.tsx`](src/components/catalog/Catalog.tsx)); guarda dos fluxos privados em [`_auth.tsx`](src/routes/_auth.tsx); 404 em [`__root.tsx`](src/routes/__root.tsx) |
| TanStack Query | Consultas, mutations, atualização otimista e invalidação em [`src/api/queries.ts`](src/api/queries.ts); política de cache e retry em [`src/router.tsx`](src/router.tsx) |
| Axios | Cliente único em [`src/api/http.ts`](src/api/http.ts) (Bearer, `X-Cart-Id`, normalização de erros) e endpoints tipados em [`src/api/endpoints.ts`](src/api/endpoints.ts) |
| REST | Contratos zod em [`src/api/contracts.ts`](src/api/contracts.ts), documentados em [`ARCHITECTURE.md`](ARCHITECTURE.md#contratos-rest) |
| Socket.IO | `socket.io-client` em [`src/lib/realtime.ts`](src/lib/realtime.ts); servidor simulado com `@mswjs/socket.io-binding` em [`src/mocks/socket.ts`](src/mocks/socket.ts) |
| Tailwind CSS v4 | Tokens e utilitários em [`src/index.css`](src/index.css) |
| shadcn/ui | [`src/components/ui`](src/components/ui) (button, dialog, sheet, select, slider, tabs, skeleton, sonner…), adaptados à identidade do Figma |
| MSW | Handlers, cenários e banco em [`src/mocks`](src/mocks); worker em [`public/mock-sw.js`](public/mock-sw.js), que importa o `mockServiceWorker.js` |
| Playwright | [`e2e/`](e2e) e [`playwright.config.ts`](playwright.config.ts) |
| Lighthouse | [`scripts/lighthouse.mjs`](scripts/lighthouse.mjs) e [`lighthouse/`](lighthouse) |

### 3. Telas e fluxos

| Tela | Onde | Funcionalidades | Teste |
| --- | --- | --- | --- |
| Início `/` | [`index.tsx`](src/routes/index.tsx), [`Hero.tsx`](src/components/home/Hero.tsx), [`Catalog.tsx`](src/components/catalog/Catalog.tsx), [`CatalogControls.tsx`](src/components/catalog/CatalogControls.tsx), [`SearchDialog.tsx`](src/components/layout/SearchDialog.tsx) | Destaques (carrossel e NFT em destaque), catálogo, busca (barra mobile e diálogo global), filtros (lateral ou gaveta), ordenação, paginação e link para o NFT | `catalog.spec.ts` |
| Detalhe `/nft/:id` | [`nft.$id.tsx`](src/routes/nft.$id.tsx) | Galeria (vistas e zoom), informações, edição, quantidade, favoritos e compra | `detail.spec.ts`, `favorites.spec.ts` |
| Carrinho `/cart` | [`cart.tsx`](src/routes/cart.tsx), [`Summary.tsx`](src/components/cart/Summary.tsx) | Quantidades, remoção, cupom e resumo vindo da API | `cart.spec.ts` |
| Pagamento `/checkout` | [`checkout.tsx`](src/routes/_auth/checkout.tsx) | Dados do colecionador, carteira e rede (conexão, recusa e desconexão), revisão e envio | `purchase.spec.ts`, `payment-failures.spec.ts`, `realtime.spec.ts` |
| Confirmação `/orders/:id` | [`orders.$id.tsx`](src/routes/_auth/orders.$id.tsx) | Resultado (pendente, confirmado ou recusado), hash da transação, itens, taxas e total | `purchase.spec.ts`, `realtime.spec.ts` |
| Login `/login` | [`login.tsx`](src/routes/login.tsx), [`AuthView.tsx`](src/components/auth/AuthView.tsx) | Autenticação, validação e retorno ao fluxo anterior (`?redirect`, filtrado por `safeRedirect`) | `auth.spec.ts` |
| Cadastro `/register` | [`register.tsx`](src/routes/register.tsx), [`AuthView.tsx`](src/components/auth/AuthView.tsx) | Criação de conta, validação e conflito (409 por campo) | `auth.spec.ts` |
| Perfil `/profile` | [`profile.tsx`](src/routes/_auth/profile.tsx) | Dados, avatar (conferido por magic bytes no servidor) e senha | `account.spec.ts` |
| Carteiras `/wallets` | [`wallets.tsx`](src/routes/_auth/wallets.tsx) | Principal e secundária, com endereço validado por rede | `account.spec.ts` |

Perfil, carteiras e confirmação também funcionam no mobile (navegação de conta em [`AccountShell.tsx`](src/components/account/AccountShell.tsx)).

**Catálogo e detalhe**

- **Estado na URL:** busca, filtros, ordenação e página sobrevivem a refresh e ao histórico (`validateSearch: HomeSearch`). `useSetSearch` cria uma entrada de histórico a cada mudança e reinicia a paginação.
- **Consultas por parâmetros:** a chave da consulta inclui os parâmetros (`nftListQuery`). Há estado vazio (`EmptyState`), falha com nova tentativa (`ErrorState`) e dados anteriores mantidos durante a troca (`keepPreviousData`). Respostas fora de ordem são descartadas pela chave e pelo `AbortSignal` (cenário `jitter`).
- **Detalhe:**
  - acesso direto (fallback SPA em [`netlify.toml`](netlify.toml));
  - NFT inexistente (404 com estado próprio);
  - edição esgotada (opção desabilitada e rótulo "Esgotada");
  - limite de quantidade (`maxPerOrder`, estoque e o que já está no carrinho).
- **Favoritos:** persistidos no servidor por usuário, com atualização otimista e rollback (`useToggleFavorite`).

**Carrinho**

- **Disponibilidade:** validada no servidor por NFT e edição (`assertQty` em [`src/mocks/logic.ts`](src/mocks/logic.ts)).
- **Persistência:** o carrinho sobrevive ao refresh (id local e carrinho no servidor), e os itens do visitante são mesclados no login (`mergeGuestCart`).
- **Cupom:** aplicar e remover, com tratamento de inválido e expirado (`checkCoupon`: `KURIO10`, `GENESIS` e `HALLOWEEN25`, que está expirado).
- **Resumo:** subtotal, desconto, taxa de rede e total são calculados só no servidor (`summarize`, BigInt com 18 casas) e exibidos como chegam.
- **Tempo real:** com o carrinho aberto, um `nft.updated` gera aviso e o resumo é recalculado pela API (`onNft` em `realtime.ts`).
- **Precisão:** ETH trafega como string decimal (`EthAmount`) e as contas usam BigInt ([`src/lib/eth.ts`](src/lib/eth.ts)); quantidades são inteiras.

**Pagamento e confirmação**

- **Validação e revisão:** campos do layout validados (zod e React Hook Form) e diálogo "Revisar pedido" antes do envio.
- **Carteiras:** uso das carteiras cadastradas, com seleção de rede e conexão, recusa e desconexão simuladas (`useConnectWallet`, `useDisconnectWallet`, cenário `wallet-reject`).
- **Revalidação antes de confirmar:** a cotação tem `fingerprint` (`buildQuote`). Se preço, estoque, cupom ou taxa mudarem, a API responde 409 `QUOTE_OUTDATED` com as diferenças, e o usuário precisa confirmar de novo.
- **Sem pedido duplicado:**
  - `Idempotency-Key` por tentativa (`useCreateOrder`) e trava síncrona contra clique duplo;
  - `createOrder` é idempotente: mesma chave e conteúdo devolvem o mesmo pedido, conteúdo diferente gera 409 `IDEMPOTENCY_CONFLICT`;
  - após timeout de 8 s, o reenvio usa a mesma chave.
- **Estados do pedido:** pendente, confirmado e recusado, recuperados após refresh ou reconexão (`settle`/`settleDue`, `order.updated` e REST). O recibo só aparece para pedido confirmado.
- **Itens no carrinho:** uma falha preserva os itens; a confirmação remove só os itens e quantidades comprados (`settle`).
- **Recibo:** reproduz o snapshot do pedido; mudanças posteriores no catálogo não o alteram.

**Conta e sessão**

- **Sessão:** cadastro, login, logout e sessão integrados à API simulada (`useLogin`, `useRegister`, `useLogout`, `useSessionCheck`).
- **Autenticação obrigatória:** checkout, perfil, carteiras, favoritos e pedidos exigem login na rota (`_auth.tsx`) e no servidor (401 em todo endpoint privado, 403 para pedido de outro usuário).
- **Sessão recuperável:** sobrevive ao refresh e é revalidada em `GET /auth/session`.
- **Expiração:** tratada na navegação e no checkout ([`SessionWatcher.tsx`](src/components/layout/SessionWatcher.tsx) e interceptor de 401), com o rascunho do checkout preservado para retomada.
- **Logout e troca de usuário:** limpam o cache privado (`clearPrivate`) e reabrem o socket com o token novo.
- **Formulários:** cadastro, perfil, senha e carteiras são validados no cliente e no servidor; os erros da API aparecem no campo certo (`applyServerErrors` em [`Field.tsx`](src/components/common/Field.tsx)). As alterações persistem após refresh.
- **Senhas:** guardadas só como hash PBKDF2-SHA256 (`hashPassword` em [`src/mocks/db.ts`](src/mocks/db.ts)).

### 4. Integração e estado

- **Contratos tipados de ponta a ponta:** schemas zod geram os tipos TypeScript, e toda resposta passa por eles na fronteira do transporte (`parse` em `endpoints.ts`).
- **Estados de tela:** carregamento (skeletons), vazio, erro, sucesso e atualização em segundo plano (`aria-busy`, opacidade e aviso "Falha ao atualizar" com nova tentativa).
- **Invalidação e respostas obsoletas:** invalidação coerente após mutations e eventos (`queries.ts`, `realtime.ts`). Respostas obsoletas são canceladas (`AbortSignal`) ou descartadas (versão por recurso).
- **Isolamento e recuperação:** dados isolados por usuário (chaves `['me', uid, …]`, carrinho por dono) e por parâmetros. Falhas se recuperam sem duplicar operações: retry só para erros transitórios e pedidos idempotentes.
- **Rotas inexistentes e acesso direto:** `notFoundComponent` trata rotas inexistentes, e qualquer tela abre por acesso direto.
- **Atualização otimista com rollback:** favoritos.
- **Documentação:** política de cache, retries e sincronização em [`ARCHITECTURE.md`](ARCHITECTURE.md#estado-e-cache-tanstack-query).

### 5. Contratos REST

- **Recursos:** sessão e conta, NFTs, favoritos, carrinho, cotação, pedidos, perfil e carteiras, em [`src/mocks/handlers.ts`](src/mocks/handlers.ts). Tabela completa em [`ARCHITECTURE.md`](ARCHITECTURE.md#contratos-rest).
- **Erros padronizados** (`ApiErrorBody`/`ErrorCode`):
  - validação (422);
  - sessão inválida ou expirada (401);
  - falta de permissão (403);
  - recurso inexistente (404);
  - conflito de disponibilidade (409);
  - falha transitória (503).
- **Idempotência:** `POST /orders` exige `Idempotency-Key`. A mesma tentativa recupera o mesmo pedido; a mesma chave com outro conteúdo gera 409.

### 6. Mocking com MSW

- **Só na camada de rede:** [`handlers.ts`](src/mocks/handlers.ts) e o service worker. Componentes, hooks e Axios não têm respostas fictícias.
- **Estado consistente:** um banco único para catálogo, favoritos, carrinho, perfil, carteiras e pedidos ([`db.ts`](src/mocks/db.ts)), persistido em `localStorage`. `?reset` ou `__mock.reset()` restaura o seed.
- **Rede configurável e reproduzível** ([`config.ts`](src/mocks/config.ts)): cenários `slow`, `jitter` (latência variável com semente fixa), `offline` e `server-error`, além de `__mock.failNext({ status, network, delay, times })` e `setLatency`.
- **Fixtures** ([`fixtures.ts`](src/mocks/fixtures.ts)): 36 NFTs em 9 coleções e 3 redes, 2 usuários e cupons.
- **Cenários determinísticos** (tabela completa em [Cenários dos mocks](#cenários-dos-mocks)):
  - sucesso (`default`) e resultado vazio (`empty`);
  - latência variável e respostas fora de ordem (`jitter`);
  - falhas de conexão e HTTP 4xx/5xx (`offline`, `server-error`, `failNext`);
  - sessão expirada e acesso não autorizado (`session-expired`, `expireSessions()`, 403);
  - conflito de cadastro e validação de formulário (e-mail ou usuário existente, campos inválidos);
  - cupom inválido ou expirado;
  - preço alterado ou edição esgotada durante a compra (`price-change`, `sold-out`);
  - timeout após criar o pedido, recuperado por idempotência (`order-timeout`);
  - pagamento confirmado (`default`) e recusado (`payment-declined`).
- **Socket.IO simulado** com `@mswjs/socket.io-binding` ([`socket.ts`](src/mocks/socket.ts)); transporte e limitações em [`ARCHITECTURE.md`](ARCHITECTURE.md#eventos-socketio).
- **Eventos pelo `socket.io-client`:** `__mock.updateNft` altera o banco e publica o evento pelo socket, sem setters ou cache na UI.
- **Configuração e build:** ativado por `VITE_MOCKS` e presente no build publicado. Mudanças nos dados aparecem tanto no REST quanto nos eventos (`updateNft`).

### 7. Tempo real com Socket.IO

- **Eventos:** `nft.updated` atualiza catálogo, detalhe e carrinho; `order.updated` atualiza o pedido e mostra confirmação ou recusa (`onNft`/`onOrder` em `realtime.ts`).
- **Ordenação e duplicatas:** cada evento tem `id`, `resource` e `version`; duplicatas e versões antigas são ignoradas (`accept`).
- **Reconexão e sessões:**
  - a reconexão reconcilia os recursos ativos via REST (`reconcile`);
  - há um socket por sessão, reaberto no login e no logout;
  - eventos privados só vão para a sessão dona ([`socket.ts`](src/mocks/socket.ts));
  - listeners são liberados ao encerrar o ciclo de vida.
- **Cenários** (`realtime.spec.ts`):
  - preço muda com o NFT no carrinho, a interface avisa, o resumo é atualizado e o checkout bloqueia a cotação desatualizada;
  - pedido pendente sobrevive a queda de conexão e a recarga, sem nova compra.

  Confirmado e recusado são estados terminais.

### 8. Interface, responsividade e acessibilidade

- **Fidelidade ao Figma:** identidade em tokens ([`index.css`](src/index.css)) e componentes shadcn/ui adaptados. Desvios e substituições de assets estão em [`ARCHITECTURE.md`](ARCHITECTURE.md#decisões-de-ux-e-desvios-do-figma).
- **Responsividade:** desktop, tablet e mobile (390, 768 e 1440 px), sem overflow horizontal.
- **Skeletons com shimmer** ([`skeleton.tsx`](src/components/ui/skeleton.tsx)) no catálogo, no detalhe e no resumo do carrinho, com dimensões reservadas (CLS 0). O shimmer desliga com `prefers-reduced-motion`.
- **Teclado e foco:** foco visível (`:focus-visible`), link "Pular para o conteúdo" e foco levado ao conteúdo a cada troca de rota ([`__root.tsx`](src/routes/__root.tsx)). Diálogos e gavetas prendem o foco e o devolvem ao gatilho ao fechar (Radix). No mobile, `scroll-padding` mantém o elemento focado fora das barras fixas.
- **Navegação por setas** ([`src/lib/arrow-nav.ts`](src/lib/arrow-nav.ts)):
  - **coleções de cards** (catálogo, trilhos e diário): grades com uma única parada de Tab. As setas seguem as colunas visíveis, Home/End vão às pontas, Enter abre o NFT e Tab alcança as ações do card focado, que fica contornado;
  - **listas do catálogo e galeria do detalhe:** abas WAI-ARIA;
  - **demais controles:** carrossel, filtros, quantidade, menu principal, barra inferior, paginação, rodapé e navegação da conta, além de edições (rádio), abas, ordenação e faixa de preço.
- **Semântica:** labels, `aria-invalid` e `aria-describedby` nos campos ([`Field.tsx`](src/components/common/Field.tsx)); `alt` nas imagens relevantes; estados com texto além da cor.
- **Feedback acessível** de mutations e tempo real: região `aria-live` ([`announce.tsx`](src/lib/announce.tsx)) e toasts.

### 9. Testes com Playwright

| Item do enunciado | Teste |
| --- | --- |
| 1. Busca, filtros, ordenação, paginação e histórico | [`catalog.spec.ts`](e2e/catalog.spec.ts) |
| 2. Acesso direto e recurso inexistente | [`detail.spec.ts`](e2e/detail.spec.ts) |
| 3. Cadastro, login, expiração, logout e troca de usuário | [`auth.spec.ts`](e2e/auth.spec.ts) |
| 4. Favoritos com falha e recuperação | [`favorites.spec.ts`](e2e/favorites.spec.ts) |
| 5. Carrinho, quantidades, remoção, cupom e persistência | [`cart.spec.ts`](e2e/cart.spec.ts) |
| 6. Compra completa até o recibo | [`purchase.spec.ts`](e2e/purchase.spec.ts) |
| 7. Pagamento recusado, clique repetido e timeout | [`payment-failures.spec.ts`](e2e/payment-failures.spec.ts) |
| 8. Perfil, avatar, senha e carteiras | [`account.spec.ts`](e2e/account.spec.ts) |
| 9. Preço/disponibilidade via Socket.IO no checkout | [`realtime.spec.ts`](e2e/realtime.spec.ts) |
| 10. Eventos duplicados/antigos, queda e pedido pendente | [`realtime.spec.ts`](e2e/realtime.spec.ts) |
| 11. Teclado, foco de diálogos e validação (inclui o fluxo principal operado só pelo teclado) | [`a11y-loading.spec.ts`](e2e/a11y-loading.spec.ts) |
| 12. Skeletons, falha e nova tentativa | [`a11y-loading.spec.ts`](e2e/a11y-loading.spec.ts) |
| Regressão visual (início, detalhe, carrinho e pagamento) | [`visual.spec.ts`](e2e/visual.spec.ts), com baselines versionadas |

Condições de execução:
- Chromium em desktop e mobile.
- Estado isolado por teste (`boot` em [`e2e/utils.ts`](e2e/utils.ts)), com relógio e latência controlados.
- Eventos disparados no servidor simulado: tempo real via `socket.io-client` e REST via handlers MSW.
- Relatório HTML (`npm run test:e2e:report`) e traces das falhas.

### 10. Performance e Lighthouse

- **Execução:** configuração versionada ([`lighthouse/config.json`](lighthouse/config.json)) e execução reproduzível (`npm run lighthouse:prod` contra a URL publicada, ou `npm run lighthouse` local).
- **Resultados** em [`lighthouse/summary.md`](lighthouse/summary.md): mediana de 3 execuções por página e perfil, LCP, CLS e TBT, versões, ambiente, condições, relatórios HTML/JSON e a análise das causas.
- **Medianas (build publicado):** home mobile **92**, home desktop **100**, detalhe mobile **91**, detalhe desktop **100**. Accessibility, Best Practices e SEO **100** em todas. No mobile: LCP ~2,6 s, CLS ≤ 0,003 e TBT de 250 a 275 ms.

### 12. Entrega

- **Deploy:** https://junglenfts.netlify.app, publicado a partir do `main` ([`netlify.toml`](netlify.toml): fallback SPA para acesso direto e refresh, 404 para assets inexistentes e cabeçalhos de segurança).
- **Estrutura:**
  - código em `src/`;
  - mocks e fixtures em `src/mocks/`;
  - assets em `public/images/`;
  - testes em `e2e/`;
  - auditoria em `lighthouse/` e `scripts/lighthouse.mjs`;
  - lockfile `package-lock.json`.
- **Reprodutibilidade:** `npm ci` a partir de um checkout limpo, sem serviços privados (comandos em [Comandos](#comandos)).
- **Arquitetura e decisões:** [`ARCHITECTURE.md`](ARCHITECTURE.md) traz contratos REST e eventos, sessão, carrinho, cache, reconciliação, limitações, decisões de UX e desvios do Figma.
