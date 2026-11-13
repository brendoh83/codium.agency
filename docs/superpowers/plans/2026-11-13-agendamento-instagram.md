# Agendamento e postagem no Instagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A aba Conteúdos do dashboard passa a receber legenda e data/hora, o cliente aprova por partes (mídia, legenda, data) e o sistema posta sozinho no Instagram do cliente na hora marcada, com cobrança automática no WhatsApp.

**Architecture:** O dashboard (Next 14 + Supabase `codium-agency`) guarda a conexão do Instagram (chave criptografada), a fila de postagem e a lógica de aprovação por partes. Uma tarefa a cada minuto (pg_cron chamando uma rota com segredo, como o AutoDM) publica o que venceu, marca "perdeu o horário" e manda lembretes. Ao conectar, o dash avisa o AutoDM (outro repositório e outro Supabase) para criar/ligar a conta do cliente.

**Tech Stack:** Next.js 14.2.15 (App Router, Server Actions), Supabase (Postgres, RLS, pg_cron, pg_net), API do Instagram com Instagram Login (Graph), Cloudflare R2 (aws4fetch), Evolution API (WhatsApp), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-agendamento-instagram-design.md`

## Global Constraints

- Código em `codium-agency/` (app) e SQL em `docs/superpowers/plans/sql/`; migrações aplicadas por MCP `apply_migration`; testes SQL como bloco `DO` que termina em `raise exception 'TESTES OK'` (dentro de transação revertida).
- Arquivo `"use server"` só exporta funções `async`. Libs testadas ficam sem alias `@/`, usam `import type` e rodam com `node --test` (Node 24, type stripping).
- Tabelas novas: RLS ligada com política `auth_all_<tabela>` para `authenticated`; `revoke all ... from anon`. Acesso do cliente (anônimo) só por função `SECURITY DEFINER` validada pelo `link_token`.
- Postagem é idempotente e nunca posta conteúdo sem mídia, legenda e data aprovadas; nunca posta duas vezes.
- Nunca guardar a senha do Instagram. Chave de acesso criptografada (AES-256-GCM, chave em `IG_TOKEN_KEY`).
- Limites da Meta: 100 posts por API em 24 h por conta; carrossel de 2 a 10 itens; legenda até 2200 caracteres e até 30 hashtags; mídia em URL que a Meta abra (link assinado do R2 com validade de 6 h).
- Fuso: guardar `timestamptz` (UTC); campos de data/hora do formulário são interpretados em `America/Sao_Paulo`.
- Textos para o usuário em português; mensagens de WhatsApp curtas, com o link `/c/<token>`.
- Variáveis de ambiente novas (o usuário cola na Vercel, nunca no chat): `IG_APP_ID`, `IG_APP_SECRET`, `IG_TOKEN_KEY`, `CRON_SECRET`, `AUTODM_URL`, `AUTODM_SECRET`.
- Estados de conteúdo existentes (`pendente`, `reprovado`, `aprovado`) e conteúdos antigos (só mídia, sem legenda/data) continuam funcionando sem mudança.

## Review Focus

1. **Duas execuções do cron ao mesmo tempo:** a mesma postagem não pode ser publicada duas vezes (reserva atômica `agendada → postando`).
2. **Queda no meio:** Meta já criou o item e o processo caiu antes de publicar; a nova tentativa continua do `creation_id` guardado, sem criar outro.
3. **Edição depois de aprovado:** mudar legenda, mídia ou data antes do horário volta a parte para pendente e cancela a postagem agendada; nada é postado sem reaprovação.
4. **Chave vencida ou revogada no horário:** não some em silêncio; postagem vira `falhou` com motivo e a equipe é avisada.
5. **Fuso e horário de corte:** "amanhã 8h" digitado no formulário vira 11:00 UTC; conteúdo agendado para o passado é recusado no formulário.
6. **Vídeo grande:** o container de Reels demora a ficar pronto; esperar o status `FINISHED` antes de publicar, sem estourar o tempo da função (continua na próxima execução).

---

### Task 0: Spike da Meta com a Toque Final (portão do projeto)

**Files:**
- Create: `docs/superpowers/plans/2026-11-13-meta-spike-resultado.md` (achados)
- Create: `scripts/meta-spike.mts` (descartável, fora de `codium-agency/`)

**Interfaces:**
- Produces: documento com as respostas que o resto do plano assume. Se alguma for "não", parar e voltar ao usuário.

Este task depende do usuário (login do Instagram da Toque Final na tela da Meta). Eu não digito senha.

- [ ] **Step 1: Pedir ao usuário que adicione a conta da Toque Final como testador do app do AutoDM** (Meta for Developers → app AutoDM → Funções → Testadores do Instagram) e aceite o convite em Instagram → Configurações → Apps e sites. Registrar o número máximo de testadores que a tela permite.
- [ ] **Step 2: Autorizar por OAuth** com as permissões `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights` e obter a chave de acesso (o usuário cola o código de retorno; eu troco pela chave localmente sem imprimir).
- [ ] **Step 3: Provar postar** uma imagem de teste (legenda `TESTE`) na conta e apagá-la em seguida; provar Reels de 5 s e carrossel de 2 imagens.
  Expected: cada chamada devolve um `id`; o post aparece no perfil (usuário confirma).
- [ ] **Step 4: Provar métricas:** chamar insights de uma mídia (alcance, curtidas, comentários, salvamentos, compartilhamentos) e da conta (visitas ao perfil, cliques no link da bio, seguidores); anotar se existe métrica "seguidores ganhos por mídia".
- [ ] **Step 5: Escrever o resultado** em `2026-11-13-meta-spike-resultado.md` com: funciona sem revisão da Meta? (sim/não), limite de testadores, permissões exatas, versão da API usada, e métricas disponíveis. Commit `docs: resultado do spike da Meta`.

---

### Task 1: Banco — aprovação por partes, abertura de link e fila de postagens

**Files:**
- Create: `docs/superpowers/plans/sql/2026-11-13-agendamento.sql`
- Test: o mesmo arquivo, bloco `DO` de testes ao final

**Interfaces:**
- Produces (tabelas): `conteudo_legendas(id, conteudo_id, numero, texto, decisao, motivo, decidido_em, created_at)`; `conteudo_datas(id, conteudo_id, numero, agendado_para, decisao, motivo, sugerida_para, decidido_em, created_at)`; `link_aberturas(id, cliente_id, aberto_em)`; `instagram_contas(id, cliente_id unique, ig_user_id, username, token_cifrado, token_expira_em, autodm_workspace_id, status, created_at)`; `postagens(id, conteudo_id unique, cliente_id, estado, agendado_para, creation_id, ig_media_id, permalink, tentativas, proxima_tentativa, erro, postado_em, lembretes, ultimo_aviso_em, created_at)`.
- Produces (funções): `responder_parte(p_token text, p_conteudo_id uuid, p_parte text, p_decisao text, p_motivo text default null, p_sugerida_para timestamptz default null) returns void` (anon+authenticated); `registrar_abertura(p_token text) returns void` (anon+authenticated); `feed_cliente(p_token text) returns jsonb` ganha em cada conteúdo `legendas` e `datas` (listas ordenadas por `numero`) e em cada versão `previa_ok` mantido.
- Regras: `estado` de `postagens` ∈ `agendada, postando, postada, falhou, perdeu_horario, cancelada`; `decisao` ∈ `aprovado, reprovado` (null = pendente), com as mesmas checagens de `conteudo_versoes` (motivo obrigatório em reprovado; `decidido_em` junto de `decisao`); `legenda` ≤ 2200 caracteres.

- [ ] **Step 1: Escrever o teste SQL** (bloco `DO`, usando um cliente e conteúdo criados no próprio teste): (a) `responder_parte` com token errado falha; (b) reprovar legenda sem motivo falha; (c) reprovar data sem `p_sugerida_para` falha; (d) aprovar legenda mantém mídia como estava; (e) parte já respondida não responde de novo (`ja respondida`); (f) `p_parte='midia'` grava na última versão; (g) `feed_cliente` devolve `legendas` e `datas` ordenadas.
- [ ] **Step 2: Rodar o teste e ver falhar** (funções não existem). Expected: erro `function ... does not exist`.
- [ ] **Step 3: Escrever a migração** com tabelas, RLS, `revoke ... from anon` (exceto as funções), e as funções. `responder_parte('midia')` reutiliza as regras de `responder_versao` (versão antiga, arquivo expirado). `responder_versao` continua existindo.
- [ ] **Step 4: Aplicar por `apply_migration` e rodar o teste.** Expected: `TESTES OK`.
- [ ] **Step 5: Commit** `feat(db): aprovacao por partes, aberturas de link e fila de postagens`.

---

### Task 2: Regras de estado por partes (lib pura)

**Files:**
- Modify: `codium-agency/lib/conteudos.ts`
- Test: `codium-agency/lib/conteudos.test.ts`

**Interfaces:**
- Consumes: `Estado`, `Decisao`, `Conteudo`, `versaoAtual`, `estadoConteudo` já existentes.
- Produces:
  - `type Parte = "midia" | "legenda" | "data"`
  - `interface RevisaoLegenda { numero: number; texto: string; decisao: Decisao; motivo: string | null; decidido_em: string | null }`
  - `interface RevisaoData { numero: number; agendado_para: string; decisao: Decisao; motivo: string | null; sugerida_para: string | null; decidido_em: string | null }`
  - `Conteudo` ganha `legendas?: RevisaoLegenda[]` e `datas?: RevisaoData[]`
  - `estadoPartes(c: Conteudo): { midia: Estado; legenda: Estado | null; data: Estado | null }` (null = parte não exigida porque o conteúdo é antigo)
  - `estadoGeral(p: ReturnType<typeof estadoPartes>): Estado` — qualquer reprovado → `reprovado`; senão qualquer pendente → `pendente`; senão `aprovado`
  - `prontoParaAgendar(p): boolean` — mídia, legenda e data todas `aprovado`

- [ ] **Step 1: Testes** `estadoPartes` (conteúdo antigo → legenda e data `null`; usa a última revisão de cada parte), `estadoGeral` (3 combinações acima + legado), `prontoParaAgendar` (false se legenda/data ausentes; true só com as três aprovadas).
- [ ] **Step 2: Rodar `node --test lib/conteudos.test.ts` e ver falhar.**
- [ ] **Step 3: Implementar** as funções e tipos em `lib/conteudos.ts`.
- [ ] **Step 4: Rodar e ver passar** (suíte inteira de `lib/`).
- [ ] **Step 5: Commit** `feat(conteudos): estado do conteudo por partes`.

---

### Task 3: Equipe sobe legenda e data; edita e reagenda

**Files:**
- Modify: `codium-agency/actions/conteudos.ts`, `codium-agency/components/ConteudoUpload.tsx`, `codium-agency/components/ConteudosGrade.tsx`, `codium-agency/app/(app)/conteudos/[clienteId]/page.tsx`
- Create: `codium-agency/lib/agendamento.ts`, `codium-agency/lib/agendamento.test.ts`

**Interfaces:**
- Consumes: Task 1 (tabelas `conteudo_legendas`, `conteudo_datas`, `postagens`), Task 2 (`Conteudo`).
- Produces (`lib/agendamento.ts`, pura):
  - `validarLegenda(texto: string): string | null` (vazia, > 2200 caracteres, > 30 hashtags)
  - `dataHoraSaoPauloParaUtc(local: string): string | null` — recebe `YYYY-MM-DDTHH:mm`, devolve ISO UTC; `null` se inválida
  - `validarAgendamento(isoUtc: string, agora: Date): string | null` (recusa passado)
- Produces (server actions): `registrarConteudo`/`registrarCarrossel` aceitam `legenda?: string` e `agendadoPara?: string` (ISO UTC) e gravam `conteudo_legendas(numero 1)` e `conteudo_datas(numero 1)` quando enviados; `editarLegenda(i: { clienteId; conteudoId; texto }): Promise<Resultado>` (cria revisão `numero + 1` pendente, cancela postagem agendada); `reagendar(i: { clienteId; conteudoId; agendadoPara; aprovada?: boolean }): Promise<Resultado>` (nova revisão de data; `aprovada: true` só quando confirma sugestão do cliente); `substituir mídia` continua pelos fluxos atuais e também cancela postagem agendada.
- Regra: qualquer edição de parte já aprovada cancela a `postagens` em `agendada` do conteúdo (`estado = 'cancelada'`).

- [ ] **Step 1: Testes de `lib/agendamento.test.ts`:** `validarLegenda("")` erro; 2200 ok, 2201 erro; 31 hashtags erro; `dataHoraSaoPauloParaUtc("2026-11-14T08:00")` → `"2026-11-14T11:00:00.000Z"`; entrada inválida → `null`; `validarAgendamento` recusa data no passado e aceita futura.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `lib/agendamento.ts`.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Actions:** estender `registrarConteudo`, `registrarCarrossel`; criar `editarLegenda` e `reagendar`; cancelar postagem agendada em toda edição aprovada. Teste de integração por SQL do cancelamento (conteúdo aprovado + edição → `postagens.estado = 'cancelada'`).
- [ ] **Step 6: Formulário:** campos "Legenda (com hashtags)" e "Postar em" (`datetime-local`, fuso São Paulo) em `ConteudoUpload` (novo conteúdo); no painel do conteúdo: editar legenda, reagendar, e botão "Confirmar nova data" quando houver sugestão do cliente.
- [ ] **Step 7: `npx tsc --noEmit`, testes, build.** Commit `feat(conteudos): legenda e agendamento no cadastro`.

---

### Task 4: Página do cliente — legenda, data e resposta por partes

**Files:**
- Modify: `codium-agency/app/c/[token]/page.tsx`, `codium-agency/components/FeedCliente.tsx`, `codium-agency/actions/feed.ts`, `codium-agency/lib/avisos.ts`, `codium-agency/lib/avisos.test.ts`
- Modify: `codium-agency/lib/conteudos.ts` (se necessário para `mensagemErro`)

**Interfaces:**
- Consumes: Task 1 (`responder_parte`, `registrar_abertura`, `feed_cliente`), Task 2 (`estadoPartes`).
- Produces: `ItemFeed` ganha `legenda?: string`, `agendadoPara?: string`, `partes?: { midia: Estado; legenda: Estado | null; data: Estado | null }`.
- Produces: `responderParte(token: string, conteudoId: string, parte: Parte, decisao: "aprovado" | "reprovado", motivo: string | null, sugeridaPara?: string | null): Promise<{ erro?: string }>` em `actions/feed.ts` (avisa a equipe no grupo).
- Produces (`lib/avisos.ts`): `textoDecisaoParte(i: { empresa; titulo; parte: Parte; decisao; motivo?; sugeridaPara?: string | null }): string` — ex.: `✅ Fulano aprovou a legenda de «X»`, `❌ ... reprovou a mídia de «X»: motivo`, `📅 ... sugeriu postar «X» em dd/mm às hh:mm: recado`.

- [ ] **Step 1: Testes de `textoDecisaoParte`** (aprovado/reprovado por parte; corta motivo em 500; data sugerida formatada em `America/Sao_Paulo`).
- [ ] **Step 2: Rodar e ver falhar; implementar; ver passar.**
- [ ] **Step 3: Página `/c/[token]`:** chamar `registrar_abertura` (no máximo uma vez por 5 minutos por link) ao carregar; montar `legenda`, `agendadoPara`, `partes` por item.
- [ ] **Step 4: UI** no detalhe do conteúdo: mostrar legenda e "Posta em dd/mm às hh:mm"; botões **Aprovar tudo** (chama `responderParte` nas partes pendentes), **Reprovar mídia**, **Reprovar legenda** (motivo obrigatório) e **Sugerir outra data** (data/hora + recado). Conteúdo antigo (sem legenda/data) mantém a tela atual.
- [ ] **Step 5: Verificação:** `tsc`, testes, build; conferir pelo navegador (Claude in Chrome) com um conteúdo de teste da Toque Final e depois apagar o teste.
- [ ] **Step 6: Commit** `feat(cliente): legenda, data e resposta por partes`.

---

### Task 5: Conexão do Instagram (OAuth, chave criptografada, renovação)

**Files:**
- Create: `codium-agency/lib/cripto.ts`, `codium-agency/lib/cripto.test.ts`, `codium-agency/lib/instagram.ts`, `codium-agency/lib/instagram.test.ts`
- Create: `codium-agency/app/api/instagram/connect/route.ts`, `codium-agency/app/api/instagram/callback/route.ts`, `codium-agency/components/ConectarInstagram.tsx`
- Modify: `codium-agency/app/(app)/conteudos/[clienteId]/page.tsx`, `codium-agency/middleware.ts` (rotas `/api/instagram/*` exigem login, exceto o retorno da Meta que valida o `state` assinado)

**Interfaces:**
- Consumes: Task 0 (permissões e versão da API), Task 1 (`instagram_contas`).
- Produces (`lib/cripto.ts`): `cifrar(texto: string, chaveHex: string): string`; `decifrar(cifrado: string, chaveHex: string): string` (AES-256-GCM, formato `iv.tag.dados` em base64url; falha com chave errada ou dado alterado).
- Produces (`lib/instagram.ts`, sem `@/`): `urlAutorizacao(i: { appId: string; redirectUri: string; state: string }): string`; `assinarState(i: { clienteId: string; segredo: string; agora: number }): string`; `lerState(state: string, segredo: string, agora: number): { clienteId: string } | null` (expira em 10 min); `trocarCodigo(deps: { fetch: typeof fetch }, i: { appId; appSecret; redirectUri; codigo }): Promise<{ token: string; igUserId: string }>`; `tornarLongo(deps, i: { appSecret; token }): Promise<{ token: string; expiraEm: string }>`; `renovar(deps, token: string): Promise<{ token: string; expiraEm: string }>`; `perfil(deps, token: string): Promise<{ igUserId: string; username: string; tipoConta: string }>`.
- Regras: `redirectUri` = `<NEXT_PUBLIC_SITE_URL>/api/instagram/callback` (usuário adiciona na Meta); recusar conta que não seja Business/Creator; conectar de novo o mesmo cliente atualiza a linha.

- [ ] **Step 1: Testes** de `cripto` (ida e volta; chave errada falha; dado adulterado falha) e de `lib/instagram` (`assinarState`/`lerState`: válido, adulterado, expirado; `urlAutorizacao` contém `client_id`, `redirect_uri`, `scope` com as 3 permissões, `state`; `trocarCodigo`/`tornarLongo`/`renovar`/`perfil` com `fetch` falso: caminho feliz e erro da Meta devolvendo mensagem em português).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** as duas libs.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Rotas e UI:** `connect` (exige usuário logado) redireciona para a Meta; `callback` valida `state`, troca código, vira chave longa, lê o perfil, cifra e grava `instagram_contas`, volta para a aba do cliente. Botão "Conectar Instagram" e estado "Conectado como @usuario (chave vence em N dias)".
- [ ] **Step 6: Renovação:** função `renovarContas(deps)` (renova as que vencem em até 10 dias; marca `status='reconectar'` quando a Meta recusa), chamada pelo cron da Task 8. Teste com fakes: renova só as que vencem; recusa marca `reconectar`.
- [ ] **Step 7: Verificação real:** pedir ao usuário as variáveis `IG_APP_ID`, `IG_APP_SECRET`, `IG_TOKEN_KEY`; conectar a Toque Final pela tela. Commit `feat(instagram): conectar conta do cliente`.

---

### Task 6: Ligação com o AutoDM (cross-repo)

**Files (repo AutoDM `C:\Users\Edecir\Desktop\CLAUDE\autodm`):**
- Create: rota autenticada por segredo para criar/ligar conta (caminho e tabelas definidos após a leitura do código; ver Step 1)
**Files (dashboard):**
- Create: `codium-agency/lib/autodm.ts`, `codium-agency/lib/autodm.test.ts`
- Modify: `codium-agency/components/ConectarInstagram.tsx` (seletor), `codium-agency/app/api/instagram/callback/route.ts`

**Interfaces:**
- Consumes: Task 5 (`instagram_contas`, chave decifrada).
- Produces (dashboard): `listarContasAutodm(deps): Promise<{ id: string; nome: string; temInstagram: boolean }[]>`; `ligarContaAutodm(deps, i: { contaId: string | null; nome: string; igUserId: string; username: string; token: string; expiraEm: string }): Promise<{ contaId: string }>` (contaId null = criar nova). Ambas usam `AUTODM_URL` + cabeçalho com `AUTODM_SECRET`.
- Regra: nunca ligar por nome igual; o usuário escolhe na lista; conta que já tem Instagram não aparece como escolha para ligar de novo.

- [ ] **Step 1: Ler o AutoDM** (migração `20261109000002_contas_multiplas.sql`, rotas de conexão do Instagram em `src/app/api/instagram`, como o WhatsApp cria a conta hoje) e anotar no topo deste task, em linha, o ponto de entrada reaproveitado. Se não houver forma segura de gravar a chave por rota, parar e perguntar ao usuário.
- [ ] **Step 2: Testes do dashboard** (`autodm.test.ts` com `fetch` falso): lista filtra contas com Instagram; `ligarContaAutodm` envia segredo e corpo certos; erro do AutoDM vira mensagem em português sem vazar a chave.
- [ ] **Step 3: Implementar a rota no AutoDM** (com testes de integração do repositório dele) e `lib/autodm.ts` no dash.
- [ ] **Step 4: Seletor na tela** após conectar: "Esse cliente já tem conta no AutoDM?" com a lista; "Criar conta nova" como alternativa. Falha do AutoDM não desfaz a conexão do dash: mostra aviso e permite tentar de novo.
- [ ] **Step 5: Mesma pergunta no Rastreador ao conectar o WhatsApp** (repo do Rastreador): escolher na lista em vez de criar sempre. Escopo: só a seleção; sem mexer no resto do Rastreador.
- [ ] **Step 6: Commits** nos três repositórios, cada um com mensagem própria.

---

### Task 7: Publicação no Instagram (imagem, carrossel, Reels)

**Files:**
- Modify: `codium-agency/lib/instagram.ts`
- Create: `codium-agency/lib/publicar.ts`, `codium-agency/lib/publicar.test.ts`

**Interfaces:**
- Consumes: Task 5 (`lib/instagram.ts`), Task 1 (`postagens`).
- Produces (`lib/instagram.ts`): `criarContainer(deps, token: string, i: { igUserId: string; tipo: "imagem" | "reels" | "item_carrossel" | "carrossel"; url?: string; legenda?: string; filhos?: string[] }): Promise<{ id: string }>`; `statusContainer(deps, token: string, id: string): Promise<"em_andamento" | "pronto" | "erro">`; `publicarContainer(deps, token: string, i: { igUserId: string; creationId: string }): Promise<{ id: string }>`; `permalink(deps, token: string, mediaId: string): Promise<string | null>`.
- Produces (`lib/publicar.ts`): `interface Postagem { id; creation_id: string | null; ig_media_id: string | null; tentativas: number }`; `publicarPostagem(deps: { ig: { criarContainer; statusContainer; publicarContainer; permalink } (as quatro funções acima, com o token já aplicado); salvar: (p: Partial<Postagem> & { id: string }) => Promise<void>; agora: () => Date }, i: { postagem: Postagem; conteudo: { tipo: "imagem" | "video" | "carrossel"; legenda: string; urls: string[] }; token: string; igUserId: string }): Promise<{ resultado: "postada" | "aguardando" | "falhou"; erro?: string }>`
- Regras: grava `creation_id` assim que a Meta devolve (antes de publicar); se já houver `creation_id`, não cria outro; `aguardando` quando o container ainda está em andamento (volta na próxima execução); depois de 3 tentativas com erro → `falhou` com a mensagem da Meta traduzida; carrossel cria um item por imagem e um container pai; Reels/vídeo usa `tipo: "reels"`.

- [ ] **Step 1: Testes** com `fetch`/`ig` falsos: (a) imagem: cria → publica → `postada` com `ig_media_id`; (b) já tem `creation_id` → não chama `criarContainer`; (c) container `em_andamento` → `aguardando`, não publica; (d) `erro` da Meta na 3ª tentativa → `falhou` com mensagem; (e) carrossel de 3 imagens → 3 itens + 1 pai, nesta ordem; (f) `salvar` recebe `creation_id` antes de `publicarContainer` ser chamado (ordem das chamadas).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** `criarContainer`, `statusContainer`, `publicarContainer`, `permalink` e `publicarPostagem`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(instagram): publicar imagem, carrossel e reels`.

---

### Task 8: Fila, tarefa a cada minuto e "perdeu o horário"

**Files:**
- Create: `codium-agency/lib/fila.ts`, `codium-agency/lib/fila.test.ts`, `codium-agency/app/api/cron/postagens/route.ts`, `docs/superpowers/plans/sql/2026-11-13-cron-postagens.sql`
- Modify: `codium-agency/lib/avisos.ts`, `codium-agency/lib/avisos.test.ts`, `codium-agency/lib/avisos-servidor.ts`

**Interfaces:**
- Consumes: Task 2 (`prontoParaAgendar`), Task 5 (`renovarContas`), Task 7 (`publicarPostagem`), Task 1 (`postagens`).
- Produces (`lib/fila.ts`): `decidirAcao(i: { postagem: { estado; agendado_para: string }; pronto: boolean; agora: Date }): "publicar" | "perdeu_horario" | "nada"` — `publicar` quando `estado='agendada'`, `pronto` e `agendado_para <= agora`; `perdeu_horario` quando horário passou e não está `pronto`; `nada` caso contrário.
- Produces: `criarPostagensProntas(deps): Promise<number>` — cria/atualiza `postagens` (`estado='agendada'`) para conteúdos com `prontoParaAgendar` e data futura; `processarFila(deps, agora: Date): Promise<{ publicadas: number; perdidas: number; falhas: number }>`.
- Produces (`lib/avisos.ts`): `textoPerdeuHorarioCliente(i: { empresa; titulo; link }): string` ("Não foi postado porque ainda falta sua aprovação. Se puder aprovar agora, a gente já vê o melhor horário para postar."); `textoPerdeuHorarioEquipe(i: { empresa; titulo }): string`; `textoFalhaPostagem(i: { empresa; titulo; erro }): string`; `textoPostada(i: { empresa; titulo; link: string | null }): string` (equipe).
- Cron: rota `POST /api/cron/postagens` exige cabeçalho `x-cron-secret` = `CRON_SECRET`; SQL cria o job `pg_cron` (a cada minuto) com `net.http_post` e o segredo no Vault; trava atômica por `update postagens set estado='postando' where id=... and estado='agendada' returning id`.

- [ ] **Step 1: Testes de `decidirAcao`** (os três resultados e a borda `agendado_para == agora`); testes de `processarFila` com fakes: (a) duas chamadas simultâneas sobre a mesma postagem publicam uma vez só; (b) postagem não pronta no horário vira `perdeu_horario` e envia os dois avisos uma única vez; (c) `falhou` avisa a equipe com o erro; (d) `postada` avisa a equipe.
- [ ] **Step 2: Rodar e ver falhar; implementar; ver passar.**
- [ ] **Step 3: Rota do cron** (valida segredo; chama `renovarContas`, `criarPostagensProntas`, `processarFila`, `processarLembretes` da Task 9; resposta com contagens). Rota sem segredo → 401.
- [ ] **Step 4: SQL do cron** e aplicação por `apply_migration`; usuário cola `CRON_SECRET` na Vercel e no Vault.
- [ ] **Step 5: Verificação:** deploy; conteúdo de teste da Toque Final agendado para daqui a 3 minutos, aprovado, e conferir o post (usuário confirma); depois um não aprovado que perde o horário. Apagar testes e o post.
- [ ] **Step 6: Commit** `feat(postagens): fila, cron e aviso de horario perdido`.

---

### Task 9: Cobrança automática (assistente)

**Files:**
- Create: `codium-agency/lib/lembretes.ts`, `codium-agency/lib/lembretes.test.ts`
- Modify: `codium-agency/lib/avisos.ts`, `codium-agency/lib/avisos.test.ts`, `codium-agency/lib/avisos-servidor.ts`, `codium-agency/lib/fila.ts` (chama `processarLembretes`)

**Interfaces:**
- Consumes: Task 1 (`link_aberturas`, `postagens.lembretes`, `postagens.ultimo_aviso_em`), Task 2 (estado por partes), Task 8 (cron).
- Produces (`lib/lembretes.ts`, pura): `proximoLembrete(i: { agora: Date; agendadoPara: Date; ultimoAviso: Date; abriuLinkEm: Date | null; lembretesEnviados: number }): Date | null`. Regras: não há lembrete se `lembretesEnviados >= 6` ou o horário já passou; se o cliente abriu o link depois do último aviso → `abriuLinkEm + 20 min`; senão → `ultimoAviso + intervalo`, com `intervalo = restante / 3` limitado entre 20 minutos e 6 horas (`restante = agendadoPara - ultimoAviso`).
- Produces: `processarLembretes(deps, agora: Date): Promise<number>` — para cada conteúdo aguardando aprovação (não `pronto`, com data futura) cujo `proximoLembrete <= agora`, envia `textoLembrete` ao grupo do cliente e atualiza `lembretes` e `ultimo_aviso_em`; conteúdo aprovado, excluído ou reagendado para de receber (recalcula pelo novo `agendado_para`).
- Produces (`lib/avisos.ts`): `textoLembrete(i: { empresa; titulo; agendadoPara: Date; link: string; jaViu: boolean }): string` (cita dia/hora da postagem em São Paulo; versão diferente quando o cliente já abriu o link).
- Produces: aviso à equipe quando há parte reprovada sem correção a menos de 2 h do horário: `textoCorrecaoAtrasada(i: { empresa; titulo; horas }): string`.

- [ ] **Step 1: Testes de `proximoLembrete`:** (a) abriu o link depois do último aviso → +20 min; (b) sem abrir, restante 12 h → intervalo 4 h; (c) restante 30 min → piso de 20 min; (d) restante 30 dias → teto de 6 h; (e) 6 lembretes já enviados → `null`; (f) horário já passou → `null`; (g) reagendar para depois recalcula.
- [ ] **Step 2: Testes de `processarLembretes`** com fakes: envia só os vencidos; não envia para aprovado; sem grupo cadastrado não quebra e registra no log (`avisos_whatsapp`); falha do WhatsApp não derruba o ciclo.
- [ ] **Step 3: Rodar e ver falhar; implementar; ver passar.**
- [ ] **Step 4: Textos** (`textoLembrete`, `textoCorrecaoAtrasada`) com testes de conteúdo e de corte.
- [ ] **Step 5: Verificação real:** conteúdo de teste na Toque Final (grupo de teste) agendado para daqui a 2 horas, sem abrir o link → lembretes chegam no ritmo esperado; abrir o link → lembrete 20 min depois. Apagar testes.
- [ ] **Step 6: Commit** `feat(cobranca): lembretes automaticos conforme a data de postagem`.

---

### Task 10: Painel da equipe — estado da postagem e alertas

**Files:**
- Modify: `codium-agency/components/ConteudosGrade.tsx`, `codium-agency/app/(app)/conteudos/[clienteId]/page.tsx`, `codium-agency/app/(app)/conteudos/page.tsx`, `codium-agency/app/(app)/alertas/page.tsx`
- Modify: view/consulta de alertas (migração pequena) para `postagem_falhou`, `postagem_perdeu_horario`, `instagram_reconectar`, `instagram_vence`

**Interfaces:**
- Consumes: Task 1 (`postagens`, `instagram_contas`), Task 2 (estados).
- Produces: selo por conteúdo ("Agendado dd/mm hh:mm", "Postado", "Falhou", "Perdeu o horário", "Aguardando aprovação de legenda"), botão "Reagendar" e "Tentar de novo" (volta `falhou`/`perdeu_horario` para `agendada` se ainda `pronto`), link para o post (`permalink`) quando postado.

- [ ] **Step 1: Migração dos alertas** (aplicada por `apply_migration`) e teste SQL dos quatro tipos.
- [ ] **Step 2: Action `tentarNovamente(conteudoId)`** com teste de integração (`falhou` → `agendada`; não permite se não `pronto`).
- [ ] **Step 3: UI** dos selos e botões; página de alertas reconhece os tipos novos e leva ao cliente.
- [ ] **Step 4: `tsc`, testes, build.** Commit `feat(conteudos): estado da postagem e alertas na equipe`.

---

### Task 11: Prova de ponta a ponta, limpeza e publicação

**Files:**
- Create: `docs/superpowers/plans/2026-11-13-agendamento-prova-final.md` (registro)

**Interfaces:**
- Consumes: todos os anteriores.

- [ ] **Step 1: Roteiro real com a Toque Final** (conteúdo de teste, sem poluir o perfil: postar e apagar o post depois): subir imagem + legenda + data 10 minutos à frente; cliente (usuário no link) aprova a mídia e reprova a legenda; equipe edita só a legenda; cliente aprova; confirmar post na hora; repetir com carrossel de 3 e com Reels de 15 s; um caso sem aprovação para ver "perdeu o horário"; um caso com "sugerir outra data" e confirmação.
  Expected: cada caso termina no estado esperado e com os avisos certos nos dois grupos.
- [ ] **Step 2: Conferir o AutoDM:** a conta da Toque Final aparece com o Instagram conectado, sem duplicata.
- [ ] **Step 3: Limpeza:** apagar conteúdos de teste, postagens de teste e posts no Instagram; conferir que clientes reais não receberam mensagens.
- [ ] **Step 4: Suíte completa** (`node --test lib/*.test.ts`), `tsc`, build; push em `main` apenas com o ok do usuário; conferir deploy `READY` e cron rodando (`select * from cron.job_run_details` do job).
- [ ] **Step 5: Atualizar a memória do projeto** com o estado, as variáveis de ambiente e as armadilhas encontradas.
