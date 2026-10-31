# Arquitetura

## Visão geral

```
UI (src/routes, src/components)            ← TanStack Router: rotas, search params, guarda /_auth
  └─ TanStack Query (src/api/queries.ts)   ← cache, mutations, otimismo, invalidação
      └─ endpoints (src/api/endpoints.ts)  ← resposta validada pelo contrato zod (src/api/contracts.ts)
          └─ Axios (src/api/http.ts)       ← Bearer, X-Cart-Id, ApiError normalizado, expiração de sessão
              └─ [rede] → MSW Service Worker → handlers (src/mocks) = "backend"
socket.io-client (src/lib/realtime.ts) ⇄ MSW ws.link + @mswjs/socket.io-binding (src/mocks/socket.ts)
```

O backend simulado (`src/mocks`) é a única autoridade: valida payloads com os **mesmos schemas zod** do cliente, autentica e autoriza cada chamada, calcula preços/descontos/taxas/totais, controla estoque, idempotência e liquidação dos pedidos. Validações no cliente existem só para UX. Componentes, hooks e cliente Axios não contêm respostas fictícias: tudo passa pela rede.

| Pasta | Responsabilidade |
| --- | --- |
| `src/api` | Contratos (zod/TS), Axios, endpoints tipados, hooks e chaves do TanStack Query |
| `src/lib` | Sessão, tempo real (Socket.IO → cache), matemática de ETH em BigInt, anúncios aria-live |
| `src/routes` | Rotas file-based (code splitting automático); `_auth` agrupa os fluxos privados |
| `src/components` | UI (shadcn/ui adaptado em `ui/`), catálogo, cards, layout, formulários |
| `src/mocks` | MSW: handlers REST, regras de negócio, banco persistido, cenários, Socket.IO |
| `e2e` | Playwright (fluxos, falhas, tempo real, acessibilidade, regressão visual) |
| `scripts`, `lighthouse` | Auditoria Lighthouse/PageSpeed e configuração versionada |

## Contratos REST

Base `VITE_API_URL` (`/api`). Erros sempre como `{ "error": { "code", "message", "fields?", "details?" } }`.

| Método e rota | Auth | Entrada → Saída |
| --- | --- | --- |
| `POST /auth/register` | — | `RegisterInput` → `201 Session` · `409 CONFLICT` (fields email/username) · `422` |
| `POST /auth/login` | — | `LoginInput` → `Session` · `401 UNAUTHENTICATED` (mensagem genérica) · `429 RATE_LIMITED` (5 falhas/min) |
| `GET /auth/session` | sim | → `Session` · `401 SESSION_EXPIRED / UNAUTHENTICATED` |
| `POST /auth/logout` | token | revoga a sessão → `204` |
| `GET /nfts` | — | `q, category, network, minPrice, maxPrice, tab, sort, page, pageSize` → `NftList` (itens, paginação, facets) · `422` |
| `GET /nfts/highlights` | — | → `{ featured, trending[] }` |
| `GET /nfts/:id` · `/nfts/:id/related` | — | → `NftDetail` / `NftSummary[]` · `404 NOT_FOUND` |
| `GET /favorites` · `PUT/DELETE /favorites/:id` | sim | → `{ ids }` · `404` |
| `GET /cart` | opcional | → `Cart` (visitante via `X-Cart-Id` emitido pelo servidor) |
| `POST /cart/items` · `PATCH/DELETE /cart/items/:id` | opcional | `{ nftId, editionId, qty }` / `{ qty }` → `Cart` · `409 OUT_OF_STOCK` (`details.available`) · `404` |
| `POST /cart/coupon` · `DELETE /cart/coupon` | opcional | `{ code }` → `Cart` · `422 COUPON_INVALID / COUPON_EXPIRED` |
| `POST /quote` | sim | `{ network, walletSlot }` → `Quote` (linhas, resumo, `fingerprint`, validade 10 min) · `409 OUT_OF_STOCK` · `422` |
| `POST /orders` + `Idempotency-Key` | sim | `{ quoteId, fingerprint, walletSlot, collector }` → `201 Order` (pendente) · mesma chave e mesmo conteúdo → `200` mesmo pedido · mesma chave e outro conteúdo → `409 IDEMPOTENCY_CONFLICT` · cotação desatualizada → `409 QUOTE_OUTDATED` (`details.quote`, `details.changes`) · `422` |
| `GET /orders/:id` | sim | → `Order` (recibo = snapshot) · `403 FORBIDDEN` (pedido de outro usuário) · `404` |
| `GET/PATCH /profile` | sim | `ProfileInput` → `User` · `409 CONFLICT` · `422` |
| `PUT/DELETE /profile/avatar` | sim | `{ dataUrl }` (PNG/JPG/WEBP ≤ 1 MB, conferido por magic bytes) → `User` |
| `PUT /profile/password` | sim | `PasswordInput` → `204` (revoga as demais sessões) · `422` (senha atual incorreta) |
| `GET /wallets` · `PUT /wallets/:slot` | sim | `WalletInput` ou `{ sameAsPrimary: true }` → `Wallets` · `422` (endereço por rede) |
| `GET/DELETE /wallets/connection` · `POST /wallets/:slot/connect` | sim | `{ provider, network }` → `WalletConnection` · `422 WALLET_REJECTED` · `404` |

Falhas transitórias (`503 TRANSIENT`), indisponibilidade de rede e timeouts vêm dos cenários/faults do mock. Respostas privadas usam `Cache-Control: no-store`.

## Eventos Socket.IO

Envelope comum: `{ id, type, resource: { type, id }, version, occurredAt, data }`.

| Evento | `data` | Destino |
| --- | --- | --- |
| `nft.updated` | `name, price, compareAtPrice, available, editions[{ id, price, stock }]` | todos os sockets |
| `order.updated` | `status` (`pending → confirmed / declined`, terminais) | apenas sockets autenticados como dono do pedido |

Cliente (`src/lib/realtime.ts`): valida cada evento com zod; descarta `id` repetido e qualquer `version` ≤ última aplicada (e ≤ versão em cache); `order.updated` nunca altera um estado terminal. Os eventos ajustam o cache (catálogo, detalhe, relacionados) e disparam refetch onde a API é a fonte da verdade (carrinho e pedido). Um socket por sessão: troca de token derruba o socket anterior e seus listeners (guarda por geração), então eventos de uma sessão anterior não alcançam outro usuário. O servidor também filtra: só envia eventos privados enquanto o token do handshake for uma sessão válida do dono.

**Transporte e limitações nos mocks:** apenas `transports: ['websocket']` (o MSW intercepta `WebSocket`; o binding não implementa long-polling). O binding simula o handshake Engine.IO/Socket.IO, mas não heartbeats nem acks: o mock envia `ping` a cada 20 s e lê o token do pacote `CONNECT` (`40{auth}`). Conexões recusadas (cenário `offline` ou `dropSockets`) disparam `error` para o cliente tentar de novo logo (timeout de conexão de 5 s, backoff até 4 s). Sem namespaces/rooms/acks. O host `wss://realtime.kurio.test` não existe: tudo roda no próprio navegador.

## Reconciliação REST × Socket.IO

- **Reconexão:** no `connect` após uma queda, invalida catálogo/detalhes, carrinho e pedidos ativos, e o TanStack Query refaz o que está na tela.
- **Refresh:** pedidos pendentes guardam `settleAt` no banco; a liquidação roda num ticker e também sob demanda em cada `GET /orders/:id`, então recarregar ou reconectar recupera o estado sem nova compra.
- **Cotação:** um `nft.updated` que toque itens da cotação marca a revisão como desatualizada (a confirmação exige nova cotação). Mesmo sem o evento, o servidor recalcula tudo na criação do pedido e responde `409 QUOTE_OUTDATED` com as diferenças.

## Sessão

- Token aleatório de 256 bits, TTL de 2 h (45 s no cenário `session-expired`), enviado como `Authorization: Bearer`. O servidor valida token e expiração em toda chamada privada.
- Persistido em `localStorage` para sobreviver ao refresh (limitação do ambiente simulado: um Service Worker não emite cookies `HttpOnly`; em produção real o token iria em cookie `HttpOnly; Secure; SameSite`). Revalidado no carregamento (`GET /auth/session`).
- Expiração durante a navegação ou no checkout: a guarda `/_auth` checa a validade local, e qualquer `401` do token atual limpa sessão e caches privados (`['me', uid]` e carrinho) e redireciona para `/login?redirect=<rota>`. O rascunho do checkout fica em `sessionStorage` e é restaurado após o login. Redirects pós-login aceitam só caminhos relativos (sem open redirect).
- Logout revoga a sessão no servidor, limpa caches privados e `sessionStorage` e reconecta o socket como visitante.
- Senhas: PBKDF2-SHA256 (100k, salt por usuário) com comparação em tempo constante; login com mensagem genérica e limite de tentativas; troca de senha revoga as demais sessões.

## Carrinho

- Carrinhos ficam no servidor: o do visitante é identificado por UUID emitido pelo servidor (`X-Cart-Id`) e o do usuário pela sessão. No login/cadastro o carrinho do visitante é mesclado ao do usuário respeitando estoque e limite por pedido.
- Disponibilidade por NFT **e edição** (`stock`, `maxPerOrder`), validada a cada inclusão ou alteração (`409` com a quantidade disponível). Quantidades são inteiras.
- Valores em ETH trafegam como strings decimais e são calculados com BigInt em 18 casas (`src/lib/eth.ts`). O cliente nunca envia preços e exibe exatamente o resumo da API (subtotal, desconto, taxa de rede, total).
- Após a confirmação, o servidor remove do carrinho apenas as quantidades compradas (por NFT + edição). Em recusa, o estoque reservado volta e os itens permanecem.

## Estado e cache (TanStack Query)

| Chave | Conteúdo |
| --- | --- |
| `['nfts','list',params]` | listagem (uma entrada por combinação de busca, filtros, ordenação e página) |
| `['nfts','detail',id]` · `['nfts','related',id]` · `['nfts','highlights']` | detalhe e vitrines |
| `['cart', 'guest' \| 'u:<uid>']` | carrinho por dono |
| `['me', uid, ...]` | dados privados (sessão, favoritos, perfil, carteiras, conexão, pedidos) — removidos em logout, expiração e troca de usuário |

- **Política:** `staleTime` 30 s e `gcTime` 5 min. Consultas tentam de novo até 2 vezes apenas em falhas transitórias (rede, timeout, 5xx), com backoff de 0,8 s e 1,6 s; erros 4xx não são repetidos. Mutations não têm retry automático, exceto a criação de pedido, que repete só com a **mesma** chave de idempotência (até 3x em timeout/rede).
- O `AbortSignal` do Query é repassado ao Axios, então respostas obsoletas são canceladas ou descartadas. Chaves por parâmetro isolam respostas fora de ordem, e o catálogo usa `keepPreviousData` com indicador de atualização em segundo plano (`aria-busy`).
- **Atualização otimista:** favoritos, com rollback em falha e revalidação no `onSettled`. Carrinho e pedidos usam a resposta do servidor (`setQueryData`).
- **URL como estado:** busca, filtros, ordenação e página vivem nos search params, validados com zod. Cada mudança é uma entrada no histórico e mudar um filtro volta à página 1.

## Mocks (MSW)

- Banco único persistido em `localStorage` (`kurio:db:v2`), sincronizado entre abas via evento `storage`; `?reset` restaura o seed.
- Fixtures determinísticas: 36 NFTs (4 artes do Figma × variações de coleção, rede, preço, edições e estoque), 2 usuários, carteiras e cupons. A latência usa PRNG com semente fixa.
- Cenários (`src/mocks/config.ts`) e faults pontuais (`__mock.failNext`) simulam lentidão, jitter, offline, HTTP 4xx/5xx, timeouts, sessão expirada, cupom inválido/expirado, preço alterado, edição esgotada, timeout após criar pedido e pagamento confirmado/recusado.
- Ativação por configuração (`VITE_MOCKS`), inclusive no build publicado.
- Limitações: o "servidor" roda dentro de cada aba (por isso a persistência local e a sincronização entre abas); Service Worker e WebCrypto exigem contexto seguro (`https` ou `localhost`).

## Acessibilidade

Skip link; foco movido para o conteúdo a cada troca de rota; foco preso e devolvido em diálogos e drawers (Radix); labels, `aria-invalid` e `aria-describedby` em todos os campos; feedback de mutations e de tempo real via toasts e região `aria-live`; estados com texto além da cor (ex.: "Esgotada", "Favoritado"); contraste dos tokens ≥ 4,5:1; navegação por teclado; `prefers-reduced-motion` desliga animações e shimmer; sem overflow horizontal em 390, 768 e 1440 px.

## Performance

Code splitting por rota; MSW e `socket.io-client` carregados sob demanda, sem bloquear a primeira pintura; imagens WebP responsivas (`srcset/sizes`) com preload da imagem LCP e da fonte; só o layout de hero visível é renderizado; skeletons com dimensões reservadas; animações de entrada não se aplicam à primeira pintura. Resultados e análise em [`lighthouse/summary.md`](lighthouse/summary.md).

## Decisões de UX e desvios do Figma

- **Galeria do detalhe:** o Figma fornece uma imagem por NFT; as miniaturas mostram recortes (rosto, figurino, lateral) da mesma arte, e a lupa abre a arte ampliada.
- **Revisão do pedido:** a ação principal do pagamento abre "Revisar pedido" (diálogo com a cotação da API) antes de "Confirmar compra", porque o desafio exige revisão antes do envio.
- **Pagamento mobile:** o frame mostra só carteiras, rede e total; os dados do colecionador (obrigatórios) aparecem abaixo, no mesmo formulário do desktop.
- **Breadcrumb do detalhe** inclui o nome do NFT. Nas abas, os textos de "Contrato" e "Direitos autorais" foram trocados para corresponder ao rótulo.
- **Fora do escopo** (Criadores, Aprenda, Atividade, Lista de interesse, Ofertas, Arquivos, Suporte, newsletter, login social, recuperação de senha, blog): continuam visíveis e informam que não fazem parte da demonstração, sem simular sucesso. "Ver no Etherscan" usa o hash simulado do pedido.
- Carrossel do hero sem autoplay (acessibilidade). Toasts no mobile ficam abaixo da barra superior para não cobrir suas ações.
- Animações de transição e interação suaves (pedido do produto), sempre respeitando `prefers-reduced-motion`.
- Preços com ponto decimal, como nos cards do Figma (inclusive no rótulo da faixa de preço).

## Assets

- As 4 artes são as image fills do arquivo Figma, convertidas para WebP em 320, 640 e 960 px. A fonte Roboto Mono (a do arquivo) é auto-hospedada via `@fontsource-variable`. Ícones de marcas desenhados inline (o lucide v1 não traz marcas).
- **CSP em produção** (`netlify.toml`): `script-src 'self'` mais o hash do script inline do selo da Netlify (plano gratuito), que roda num iframe `srcdoc` e herda a política do site.
