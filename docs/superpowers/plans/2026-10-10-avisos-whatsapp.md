# Avisos no WhatsApp para conteúdos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar por WhatsApp o grupo do cliente quando entra conteúdo novo ou nova versão, e o grupo da equipe quando o cliente aprova ou reprova.

**Architecture:** Um cliente fino do servidor Evolution (`lib/whatsapp.ts`) e funções puras de texto e agrupamento (`lib/avisos.ts`). Os disparos ficam nas server actions já existentes, depois da ação principal, sempre dentro de `try/catch`. A decisão do cliente (sem login) busca os dados do aviso por função `SECURITY DEFINER` validada pelo token do link.

**Tech Stack:** Next.js 14.2.15 (Server Actions), TypeScript 5.5.4, Supabase, `node --test` para lógica pura, Evolution API v2 (`apikey`).

**Spec:** `docs/superpowers/specs/2026-10-10-avisos-whatsapp-design.md`

## Global Constraints

- Raiz do repo `codium.agency/` (comandos `git`); app em `codium-agency/` (comandos `npm`/`node`/`npx`). Caminhos em "Files" são relativos a `codium-agency/`, exceto `docs/`.
- Falha no WhatsApp **nunca** pode lançar erro para a ação principal: o notificador captura tudo e devolve resultado.
- Agrupamento: aviso de conteúdo novo ou nova versão **não** sai se houve outro aviso desses tipos enviado com sucesso para o mesmo cliente há **menos de 10 minutos**; reenvio manual ignora a regra.
- Trocar arquivo **não** avisa. Cliente sem grupo não recebe aviso.
- Chaves (`EVOLUTION_API_KEY`) só em variável de ambiente, coladas pelo dono; nunca no repo, em log ou no chat.
- Timeout de 8 s em toda chamada ao Evolution.
- Instância da agência: `codium-agencia`, criada com `groupsIgnore: false`.
- Mensagens exatamente como na spec (emojis 📌 🔄 ✅ ❌, aspas «»).
- Código e textos de UI em português; seguir `actions/conteudos.ts` e `lib/whatsapp` como padrão.

## Review Focus

- O Evolution está fora do ar ou lento: upload, troca e aprovação continuam funcionando e o erro aparece no log de avisos. (Tasks 3, 4)
- 10 conteúdos subidos em sequência: só 1 mensagem sai, a seguinte só depois de 10 minutos. (Tasks 2, 4)
- Cliente sem grupo, ou equipe sem grupo definido: nada é enviado e nada quebra. (Task 4)
- Motivo de reprovação muito longo ou com quebras de linha: mensagem sai cortada em 500 caracteres, sem quebrar o envio. (Task 2)
- Token inválido ou versão de outro cliente na decisão: `dados_aviso_decisao` devolve `null` e nenhum aviso é enviado. (Task 1)

---

## Task 1: Banco — grupos, configuração, log e funções de aviso

**Files:**
- Apply via Supabase MCP `apply_migration` (projeto `ssroxcrywymmusresjsn`), nome `avisos_whatsapp`
- Create: `docs/superpowers/plans/sql/2026-10-10-avisos_whatsapp.sql` (cópia)

**Interfaces:**
- Produces (SQL):
  - `clientes.whatsapp_grupo_id text null`, `clientes.whatsapp_grupo_nome text null`
  - `app_config(chave text pk, valor text not null)`; chaves usadas: `whatsapp_instancia`, `whatsapp_grupo_equipe_id`, `whatsapp_grupo_equipe_nome`
  - `avisos_whatsapp(id, tipo, cliente_id, destino, texto, ok, erro, created_at)`
  - `dados_aviso_decisao(p_token text, p_versao_id uuid) returns jsonb` → `{empresa, titulo, grupo_equipe_id, instancia}` ou `null`
  - `registrar_aviso(p_token text, p_tipo text, p_destino text, p_texto text, p_ok boolean, p_erro text) returns void`

- [ ] **Step 1: Teste SQL que falha antes da migration**

Rodar via `execute_sql`. Termina sempre em `raise exception` para desfazer os dados.

```sql
do $$
declare cid uuid; tok text; cont uuid; ver uuid; r jsonb; n int;
begin
  select id, link_token into cid, tok from public.clientes order by id limit 1;
  insert into public.conteudos (cliente_id, titulo, tipo) values (cid, 'teste aviso', 'video') returning id into cont;
  insert into public.conteudo_versoes (conteudo_id, numero, r2_key, mime, tamanho)
    values (cont, 1, 'clientes/x/a.mp4', 'video/mp4', 10) returning id into ver;

  insert into public.app_config (chave, valor) values ('whatsapp_grupo_equipe_id', '1203@g.us');

  r := public.dados_aviso_decisao(tok, ver);
  if r is null or r->>'titulo' <> 'teste aviso' or r->>'grupo_equipe_id' <> '1203@g.us' then
    raise exception 'FALHA 1 dados_aviso_decisao: %', r;
  end if;
  if r->>'instancia' <> 'codium-agencia' then raise exception 'FALHA 2 instancia padrao: %', r; end if;

  if public.dados_aviso_decisao('naoexiste', ver) is not null then raise exception 'FALHA 3 token invalido'; end if;
  if public.dados_aviso_decisao(tok, gen_random_uuid()) is not null then raise exception 'FALHA 4 versao inexistente'; end if;

  perform public.registrar_aviso(tok, 'decisao', '1203@g.us', 'texto', true, null);
  select count(*) into n from public.avisos_whatsapp where cliente_id = cid and tipo = 'decisao';
  if n <> 1 then raise exception 'FALHA 5 log nao gravou'; end if;

  begin perform public.registrar_aviso('naoexiste', 'decisao', 'x', 'y', true, null); raise exception 'FALHA 6';
  exception when others then if sqlerrm = 'FALHA 6' then raise; end if; end;

  begin perform public.registrar_aviso(tok, 'outro_tipo', 'x', 'y', true, null); raise exception 'FALHA 7';
  exception when others then if sqlerrm = 'FALHA 7' then raise; end if; end;

  raise exception 'TESTES OK';
end $$;
```

- [ ] **Step 2: Rodar e ver falhar**

Expected: erro `relation "public.app_config" does not exist`.

- [ ] **Step 3: Aplicar a migration** (`apply_migration`, nome `avisos_whatsapp`; salvar o mesmo texto no arquivo `.sql`)

```sql
alter table public.clientes
  add column whatsapp_grupo_id text,
  add column whatsapp_grupo_nome text;

create table public.app_config (
  chave text primary key,
  valor text not null
);
alter table public.app_config enable row level security;
create policy auth_all_app_config on public.app_config
  for all to authenticated using (true) with check (true);

create table public.avisos_whatsapp (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('conteudo_novo', 'nova_versao', 'decisao')),
  cliente_id uuid references public.clientes(id) on delete set null,
  destino text not null,
  texto text not null,
  ok boolean not null,
  erro text,
  created_at timestamptz not null default now()
);
create index avisos_whatsapp_cliente_idx on public.avisos_whatsapp (cliente_id, tipo, created_at desc);
alter table public.avisos_whatsapp enable row level security;
create policy auth_all_avisos_whatsapp on public.avisos_whatsapp
  for all to authenticated using (true) with check (true);

create or replace function public.dados_aviso_decisao(p_token text, p_versao_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select cl.empresa, c.titulo into r
    from public.conteudo_versoes ver
    join public.conteudos c on c.id = ver.conteudo_id
    join public.clientes cl on cl.id = c.cliente_id
   where ver.id = p_versao_id and cl.link_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'empresa', r.empresa,
    'titulo', r.titulo,
    'grupo_equipe_id', (select valor from public.app_config where chave = 'whatsapp_grupo_equipe_id'),
    'instancia', coalesce((select valor from public.app_config where chave = 'whatsapp_instancia'), 'codium-agencia')
  );
end $$;

create or replace function public.registrar_aviso(
  p_token text, p_tipo text, p_destino text, p_texto text, p_ok boolean, p_erro text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  if p_tipo <> 'decisao' then raise exception 'tipo invalido'; end if;
  select id into v_cliente from public.clientes where link_token = p_token;
  if not found then raise exception 'token invalido'; end if;
  insert into public.avisos_whatsapp (tipo, cliente_id, destino, texto, ok, erro)
  values (p_tipo, v_cliente, left(p_destino, 100), left(p_texto, 1000), p_ok, left(p_erro, 500));
  delete from public.avisos_whatsapp
   where id not in (select id from public.avisos_whatsapp order by created_at desc limit 200);
end $$;

revoke all on function public.dados_aviso_decisao(text, uuid) from public;
revoke all on function public.registrar_aviso(text, text, text, text, boolean, text) from public;
grant execute on function public.dados_aviso_decisao(text, uuid) to anon, authenticated;
grant execute on function public.registrar_aviso(text, text, text, text, boolean, text) to anon, authenticated;
```

- [ ] **Step 4: Rodar o teste e ver passar** — Expected: erro com a mensagem exata `TESTES OK`.

- [ ] **Step 5: Conferir permissões**

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon
from pg_proc p where pronamespace = 'public'::regnamespace
  and proname in ('dados_aviso_decisao', 'registrar_aviso');
select has_table_privilege('anon', 'public.app_config', 'select') as anon_le_config;
```
Expected: ambas as funções `anon = true`. A segunda consulta mostra o privilégio de tabela; o acesso real continua bloqueado por RLS (sem policy para `anon`). Confirmar com `set role anon; select count(*) from public.app_config;` → 0 linhas.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/sql/2026-10-10-avisos_whatsapp.sql
git commit -m "feat(db): grupos de WhatsApp, config, log de avisos e funcoes da decisao"
```

---

## Task 2: Textos e regra de agrupamento (lógica pura)

**Files:**
- Create: `lib/avisos.ts`
- Test: `lib/avisos.test.ts`

**Interfaces:**
- Produces (`lib/avisos.ts`, sem imports de `@/`):
  - `type TipoAviso = "conteudo_novo" | "nova_versao" | "decisao"`
  - `JANELA_MIN = 10`
  - `textoConteudoNovo(i: { empresa: string; titulo: string; pendentes: number; link: string }): string`
  - `textoNovaVersao(i: { empresa: string; titulo: string; link: string }): string`
  - `textoDecisao(i: { empresa: string; titulo: string; decisao: "aprovado" | "reprovado"; motivo?: string | null }): string`
  - `deveAgrupar(ultimoOk: string | Date | null | undefined, agora: Date, janelaMin?: number): boolean`
  - `linkDoCliente(origem: string, token: string): string`

- [ ] **Step 1: Teste que falha**

```ts
// lib/avisos.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deveAgrupar, linkDoCliente, textoConteudoNovo, textoDecisao, textoNovaVersao, JANELA_MIN,
} from "./avisos.ts";

const link = "https://codium-agency.vercel.app/c/abc123XYZ0";

test("conteúdo novo: singular e plural", () => {
  assert.equal(
    textoConteudoNovo({ empresa: "Alecrim Store", titulo: "Reels de lançamento", pendentes: 1, link }),
    `📌 Alecrim Store: novo conteúdo para aprovar: «Reels de lançamento». Veja aqui: ${link}`
  );
  assert.equal(
    textoConteudoNovo({ empresa: "Alecrim Store", titulo: "x", pendentes: 4, link }),
    `📌 Alecrim Store: 4 conteúdos aguardando aprovação. Veja aqui: ${link}`
  );
  // zero ou negativo cai no singular (nunca "0 conteúdos")
  assert.match(textoConteudoNovo({ empresa: "A", titulo: "T", pendentes: 0, link }), /novo conteúdo/);
});

test("nova versão", () => {
  assert.equal(
    textoNovaVersao({ empresa: "Alecrim Store", titulo: "Reels", link }),
    `🔄 Alecrim Store: nova versão de «Reels» para aprovar. Veja aqui: ${link}`
  );
});

test("decisão: aprovado e reprovado com motivo", () => {
  assert.equal(
    textoDecisao({ empresa: "Alecrim Store", titulo: "Reels", decisao: "aprovado" }),
    "✅ Alecrim Store aprovou «Reels»"
  );
  assert.equal(
    textoDecisao({ empresa: "Alecrim Store", titulo: "Reels", decisao: "reprovado", motivo: "  cortar os 3 primeiros segundos  " }),
    "❌ Alecrim Store reprovou «Reels»: cortar os 3 primeiros segundos"
  );
});

test("decisão: motivo longo é cortado em 500 caracteres e quebras viram espaço", () => {
  const longo = "a".repeat(800);
  const t = textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: longo });
  assert.ok(t.length < 560);
  assert.ok(t.endsWith("…"));
  const t2 = textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "linha 1\n\nlinha 2" });
  assert.ok(!t2.includes("\n"));
  assert.ok(t2.endsWith("linha 1 linha 2"));
});

test("decisão reprovada sem motivo não deixa dois-pontos sobrando", () => {
  assert.equal(
    textoDecisao({ empresa: "A", titulo: "T", decisao: "reprovado", motivo: "   " }),
    "❌ A reprovou «T»"
  );
});

test("deveAgrupar: só dentro da janela de 10 minutos", () => {
  const agora = new Date("2026-10-10T12:00:00Z");
  assert.equal(JANELA_MIN, 10);
  assert.equal(deveAgrupar(null, agora), false);
  assert.equal(deveAgrupar(undefined, agora), false);
  assert.equal(deveAgrupar("2026-10-10T11:55:00Z", agora), true);
  assert.equal(deveAgrupar("2026-10-10T11:50:00Z", agora), false); // exatamente 10 min: já pode avisar
  assert.equal(deveAgrupar("2026-10-10T11:40:00Z", agora), false);
  assert.equal(deveAgrupar("lixo", agora), false);
  assert.equal(deveAgrupar("2026-10-10T12:30:00Z", agora), false); // data futura não agrupa
});

test("linkDoCliente tira barra final da origem", () => {
  assert.equal(linkDoCliente("https://x.app/", "tok"), "https://x.app/c/tok");
  assert.equal(linkDoCliente("https://x.app", "tok"), "https://x.app/c/tok");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd codium-agency && node --test lib/avisos.test.ts`
Expected: FAIL `Cannot find module './avisos.ts'`.

- [ ] **Step 3: Implementação**

```ts
// lib/avisos.ts
export type TipoAviso = "conteudo_novo" | "nova_versao" | "decisao";

export const JANELA_MIN = 10;
const MOTIVO_MAX = 500;

function limpar(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

function cortar(t: string, max: number): string {
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

export function linkDoCliente(origem: string, token: string): string {
  return `${origem.replace(/\/$/, "")}/c/${token}`;
}

export function textoConteudoNovo(i: {
  empresa: string;
  titulo: string;
  pendentes: number;
  link: string;
}): string {
  if (i.pendentes <= 1) {
    return `📌 ${i.empresa}: novo conteúdo para aprovar: «${i.titulo}». Veja aqui: ${i.link}`;
  }
  return `📌 ${i.empresa}: ${i.pendentes} conteúdos aguardando aprovação. Veja aqui: ${i.link}`;
}

export function textoNovaVersao(i: { empresa: string; titulo: string; link: string }): string {
  return `🔄 ${i.empresa}: nova versão de «${i.titulo}» para aprovar. Veja aqui: ${i.link}`;
}

export function textoDecisao(i: {
  empresa: string;
  titulo: string;
  decisao: "aprovado" | "reprovado";
  motivo?: string | null;
}): string {
  if (i.decisao === "aprovado") return `✅ ${i.empresa} aprovou «${i.titulo}»`;
  const motivo = cortar(limpar(i.motivo ?? ""), MOTIVO_MAX);
  return `❌ ${i.empresa} reprovou «${i.titulo}»${motivo ? `: ${motivo}` : ""}`;
}

export function deveAgrupar(
  ultimoOk: string | Date | null | undefined,
  agora: Date,
  janelaMin: number = JANELA_MIN
): boolean {
  if (!ultimoOk) return false;
  const t = new Date(ultimoOk).getTime();
  if (!Number.isFinite(t)) return false;
  const dif = agora.getTime() - t;
  return dif >= 0 && dif < janelaMin * 60_000;
}
```

- [ ] **Step 4: Rodar e ver passar** — `node --test lib/avisos.test.ts` → todos PASS.

- [ ] **Step 5: Commit**

```bash
git add codium-agency/lib/avisos.ts codium-agency/lib/avisos.test.ts
git commit -m "feat: textos dos avisos e regra de agrupamento"
```

---

## Task 3: Cliente do Evolution (WhatsApp)

**Files:**
- Create: `lib/whatsapp.ts`
- Test: `lib/whatsapp.test.ts`

**Interfaces:**
- Produces (`lib/whatsapp.ts`, somente servidor; sem imports de `@/`):
  - `INSTANCIA_PADRAO = "codium-agencia"`
  - `criarInstancia(instancia: string): Promise<unknown>`
  - `conectar(instancia: string, numero?: string): Promise<{ pairingCode?: string | null; code?: string; base64?: string }>`
  - `estadoConexao(instancia: string): Promise<string>` (`"open" | "connecting" | "close"`)
  - `listarGrupos(instancia: string): Promise<{ id: string; nome: string }[]>`
  - `enviarTexto(instancia: string, jid: string, texto: string): Promise<unknown>`

- [ ] **Step 1: Teste que falha**

```ts
// lib/whatsapp.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { enviarTexto, estadoConexao, listarGrupos, conectar, INSTANCIA_PADRAO } from "./whatsapp.ts";

process.env.EVOLUTION_URL = "https://evo.exemplo.test/";
process.env.EVOLUTION_API_KEY = "chave-de-teste";

function stub(resposta: { status?: number; json?: unknown; texto?: string }) {
  const chamadas: Request[] = [];
  const antes = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    chamadas.push(new Request(input, init));
    const status = resposta.status ?? 200;
    return new Response(resposta.texto ?? JSON.stringify(resposta.json ?? {}), { status });
  }) as typeof fetch;
  return { chamadas, restaurar: () => { globalThis.fetch = antes; } };
}

test("instância padrão", () => assert.equal(INSTANCIA_PADRAO, "codium-agencia"));

test("enviarTexto: POST com apikey e corpo {number, text}", async () => {
  const s = stub({ json: { key: { id: "x" } } });
  try {
    await enviarTexto("codium-agencia", "1203630@g.us", "olá");
  } finally { s.restaurar(); }
  const r = s.chamadas[0];
  assert.equal(r.method, "POST");
  assert.equal(new URL(r.url).pathname, "/message/sendText/codium-agencia");
  assert.equal(r.headers.get("apikey"), "chave-de-teste");
  assert.deepEqual(await r.json(), { number: "1203630@g.us", text: "olá" });
});

test("listarGrupos: só grupos, nome do subject, ordenado", async () => {
  const s = stub({ json: [
    { id: "2@g.us", subject: "Zeta" },
    { id: "5511@s.whatsapp.net", subject: "Não é grupo" },
    { id: "1@g.us", subject: "Alecrim Store" },
    { id: "3@g.us" },
  ] });
  let grupos;
  try { grupos = await listarGrupos("codium-agencia"); } finally { s.restaurar(); }
  assert.deepEqual(grupos, [
    { id: "1@g.us", nome: "Alecrim Store" },
    { id: "2@g.us", nome: "Zeta" },
    { id: "3@g.us", nome: "3@g.us" },
  ]);
  assert.equal(new URL(s.chamadas[0].url).search, "?getParticipants=false");
});

test("estadoConexao lê instance.state", async () => {
  const s = stub({ json: { instance: { instanceName: "x", state: "open" } } });
  try { assert.equal(await estadoConexao("x"), "open"); } finally { s.restaurar(); }
});

test("conectar com número usa ?number=", async () => {
  const s = stub({ json: { pairingCode: "ABCD-1234" } });
  try { await conectar("x", "5549999990000"); } finally { s.restaurar(); }
  assert.equal(new URL(s.chamadas[0].url).search, "?number=5549999990000");
});

test("resposta de erro lança com status e caminho", async () => {
  const s = stub({ status: 401, texto: "Unauthorized" });
  try {
    await assert.rejects(() => enviarTexto("x", "1@g.us", "t"), /Evolution.*401/);
  } finally { s.restaurar(); }
});

test("sem variáveis lança erro claro", async () => {
  const url = process.env.EVOLUTION_URL;
  delete process.env.EVOLUTION_URL;
  try {
    await assert.rejects(() => estadoConexao("x"), /EVOLUTION_URL/);
  } finally { process.env.EVOLUTION_URL = url; }
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test lib/whatsapp.test.ts` → `Cannot find module './whatsapp.ts'`.

- [ ] **Step 3: Implementação**

```ts
// lib/whatsapp.ts — somente servidor
export const INSTANCIA_PADRAO = "codium-agencia";

const TIMEOUT_MS = 8000;

function config() {
  const url = process.env.EVOLUTION_URL;
  const key = process.env.EVOLUTION_API_KEY;
  if (!url || !key) {
    throw new Error("Evolution não configurado: faltam EVOLUTION_URL e EVOLUTION_API_KEY");
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function evo<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = config();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${url}${path}`, {
      ...init,
      headers: { apikey: key, "Content-Type": "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Evolution ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const criarInstancia = (instancia: string) =>
  evo("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instancia,
      integration: "WHATSAPP-BAILEYS",
      qrcode: false,
      groupsIgnore: false,
      syncFullHistory: false,
      rejectCall: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
    }),
  });

export const conectar = (instancia: string, numero?: string) =>
  evo<{ pairingCode?: string | null; code?: string; base64?: string }>(
    `/instance/connect/${instancia}${numero ? `?number=${numero}` : ""}`
  );

export const estadoConexao = (instancia: string) =>
  evo<{ instance?: { state?: string } }>(`/instance/connectionState/${instancia}`).then(
    (r) => r.instance?.state ?? "close"
  );

export async function listarGrupos(instancia: string): Promise<{ id: string; nome: string }[]> {
  const r = await evo<{ id?: string; subject?: string }[]>(
    `/group/fetchAllGroups/${instancia}?getParticipants=false`
  );
  return (Array.isArray(r) ? r : [])
    .filter((g) => typeof g.id === "string" && g.id.endsWith("@g.us"))
    .map((g) => ({ id: g.id as string, nome: g.subject?.trim() || (g.id as string) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export const enviarTexto = (instancia: string, jid: string, texto: string) =>
  evo(`/message/sendText/${instancia}`, {
    method: "POST",
    body: JSON.stringify({ number: jid, text: texto }),
  });
```

- [ ] **Step 4: Rodar e ver passar** — `node --test lib/whatsapp.test.ts` → 7 PASS.

- [ ] **Step 5: Conferir contra o servidor real (leitura apenas)**

Com as variáveis em `codium-agency/.env.local` (o dono as cria), rodar:

```bash
cd codium-agency && node --env-file=.env.local --experimental-strip-types -e "import('./lib/whatsapp.ts').then(async m => { console.log(await m.estadoConexao('codium-agencia').catch(e => 'erro: ' + e.message)); })"
```
Expected: `close`, `open` ou erro 404 (instância ainda não criada). Qualquer outra resposta (ex.: 401) indica chave ou URL errada: parar e avisar o dono. **Nunca** imprimir o valor da chave.

- [ ] **Step 6: Commit**

```bash
git add codium-agency/lib/whatsapp.ts codium-agency/lib/whatsapp.test.ts
git commit -m "feat: cliente do Evolution para WhatsApp (grupos, envio, conexao)"
```

---

## Task 4: Notificador e disparos nas ações

**Files:**
- Create: `lib/avisos-servidor.ts`
- Create: `actions/whatsapp.ts`
- Modify: `actions/conteudos.ts` (disparos em `registrarConteudo` e `registrarNovaVersao`)
- Modify: `actions/feed.ts` (disparo da decisão)

**Interfaces:**
- Consumes: `lib/avisos.ts` (Task 2), `lib/whatsapp.ts` (Task 3), `estadoConteudo` e tipos de `@/lib/conteudos`, tabelas e funções da Task 1.
- Produces (`lib/avisos-servidor.ts`):
  - `avisarClienteConteudo(i: { supabase: SupabaseClient; clienteId: string; tipo: "conteudo_novo" | "nova_versao"; titulo: string; forcar?: boolean }): Promise<{ enviado: boolean; motivo?: "sem_grupo" | "agrupado" | "erro"; erro?: string }>` — **nunca lança**.
- Produces (`actions/whatsapp.ts`, `"use server"`, todas exigem usuário logado):
  - `statusWhatsapp(): Promise<{ instancia: string; estado: string; grupoEquipe: { id: string; nome: string } | null; configurado: boolean }>`
  - `iniciarConexao(numero?: string): Promise<{ erro?: string; qr?: string; codigo?: string }>`
  - `gruposDisponiveis(): Promise<{ erro?: string; grupos?: { id: string; nome: string }[] }>`
  - `salvarGrupoEquipe(id: string, nome: string): Promise<{ erro?: string }>`
  - `salvarGrupoCliente(clienteId: string, id: string | null, nome: string | null): Promise<{ erro?: string }>`
  - `reenviarAviso(clienteId: string): Promise<{ erro?: string; enviado?: boolean }>`

- [ ] **Step 1: Notificador**

```ts
// lib/avisos-servidor.ts — somente servidor
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarTexto, INSTANCIA_PADRAO } from "@/lib/whatsapp";
import { deveAgrupar, linkDoCliente, textoConteudoNovo, textoNovaVersao, type TipoAviso } from "@/lib/avisos";
import { estadoConteudo, type Versao } from "@/lib/conteudos";

export const origemDoSite = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://codium-agency.vercel.app";

type Resultado = { enviado: boolean; motivo?: "sem_grupo" | "agrupado" | "erro"; erro?: string };

async function instanciaConfigurada(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("app_config").select("valor").eq("chave", "whatsapp_instancia").maybeSingle();
  return data?.valor || INSTANCIA_PADRAO;
}

async function registrar(
  supabase: SupabaseClient,
  linha: { tipo: TipoAviso; cliente_id: string; destino: string; texto: string; ok: boolean; erro?: string | null }
) {
  try {
    await supabase.from("avisos_whatsapp").insert({ ...linha, erro: linha.erro?.slice(0, 500) ?? null });
  } catch {
    /* log é melhor esforço */
  }
}

async function contarPendentes(supabase: SupabaseClient, clienteId: string): Promise<number> {
  const { data } = await supabase
    .from("conteudos")
    .select("id, conteudo_versoes(numero, decisao, expira_em)")
    .eq("cliente_id", clienteId);
  const agora = new Date();
  return (data ?? []).filter((c: any) => {
    const versoes = ((c.conteudo_versoes ?? []) as any[]).map(
      (v) => ({ ...v, expirada: new Date(v.expira_em) < agora }) as Versao
    );
    const atual = versoes.reduce<Versao | undefined>((m, v) => (!m || v.numero > m.numero ? v : m), undefined);
    return atual && !atual.expirada && estadoConteudo({ versoes }) === "pendente";
  }).length;
}

export async function avisarClienteConteudo(i: {
  supabase: SupabaseClient;
  clienteId: string;
  tipo: "conteudo_novo" | "nova_versao";
  titulo: string;
  forcar?: boolean;
}): Promise<Resultado> {
  try {
    const { supabase, clienteId } = i;
    const { data: cliente } = await supabase
      .from("clientes")
      .select("empresa, link_token, whatsapp_grupo_id")
      .eq("id", clienteId)
      .maybeSingle();
    if (!cliente?.whatsapp_grupo_id) return { enviado: false, motivo: "sem_grupo" };

    if (!i.forcar) {
      const { data: ultimo } = await supabase
        .from("avisos_whatsapp")
        .select("created_at")
        .eq("cliente_id", clienteId)
        .in("tipo", ["conteudo_novo", "nova_versao"])
        .eq("ok", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (deveAgrupar(ultimo?.created_at, new Date())) return { enviado: false, motivo: "agrupado" };
    }

    const link = linkDoCliente(origemDoSite(), cliente.link_token);
    const texto =
      i.tipo === "nova_versao"
        ? textoNovaVersao({ empresa: cliente.empresa, titulo: i.titulo, link })
        : textoConteudoNovo({
            empresa: cliente.empresa,
            titulo: i.titulo,
            pendentes: await contarPendentes(supabase, clienteId),
            link,
          });

    const instancia = await instanciaConfigurada(supabase);
    try {
      await enviarTexto(instancia, cliente.whatsapp_grupo_id, texto);
      await registrar(supabase, { tipo: i.tipo, cliente_id: clienteId, destino: cliente.whatsapp_grupo_id, texto, ok: true });
      return { enviado: true };
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      await registrar(supabase, {
        tipo: i.tipo, cliente_id: clienteId, destino: cliente.whatsapp_grupo_id, texto, ok: false, erro,
      });
      return { enviado: false, motivo: "erro", erro };
    }
  } catch (e) {
    return { enviado: false, motivo: "erro", erro: e instanceof Error ? e.message : String(e) };
  }
}
```

Observação: a poda dos 200 registros acontece dentro de `registrar_aviso` (decisões). Os avisos de conteúdo entram direto na tabela e o log pode crescer; isso é aceito na v1, porque a lista de Configurações mostra só os últimos 20 e o volume é de poucas linhas por dia.

- [ ] **Step 2: Disparos nas ações de conteúdo**

Em `actions/conteudos.ts`:

```ts
import { avisarClienteConteudo } from "@/lib/avisos-servidor";
```

Em `registrarConteudo`, logo antes de `revalidatePath(...)` final (depois do insert da versão):

```ts
  await avisarClienteConteudo({ supabase, clienteId: i.clienteId, tipo: "conteudo_novo", titulo });
```

Em `registrarNovaVersao`: mudar o `select("id, tipo, cliente_id")` para `select("id, tipo, cliente_id, titulo")` e, logo antes do `revalidatePath` final:

```ts
  await avisarClienteConteudo({
    supabase, clienteId: i.clienteId, tipo: "nova_versao", titulo: conteudo.titulo,
  });
```

`trocarArquivo` **não** recebe disparo.

- [ ] **Step 3: Disparo da decisão (cliente sem login)**

Em `actions/feed.ts`, substituir o corpo por:

```ts
"use server";

import { createPublicClient } from "@/lib/supabase/publico";
import { mensagemErro } from "@/lib/conteudos";
import { textoDecisao } from "@/lib/avisos";
import { enviarTexto } from "@/lib/whatsapp";

async function avisarEquipe(
  supabase: ReturnType<typeof createPublicClient>,
  token: string,
  versaoId: string,
  decisao: "aprovado" | "reprovado",
  motivo: string | null
) {
  try {
    const { data } = await supabase.rpc("dados_aviso_decisao", { p_token: token, p_versao_id: versaoId });
    if (!data || !data.grupo_equipe_id) return;
    const texto = textoDecisao({ empresa: data.empresa, titulo: data.titulo, decisao, motivo });
    let ok = true;
    let erro: string | null = null;
    try {
      await enviarTexto(data.instancia, data.grupo_equipe_id, texto);
    } catch (e) {
      ok = false;
      erro = e instanceof Error ? e.message : String(e);
    }
    await supabase.rpc("registrar_aviso", {
      p_token: token, p_tipo: "decisao", p_destino: data.grupo_equipe_id, p_texto: texto, p_ok: ok, p_erro: erro,
    });
  } catch {
    /* aviso é melhor esforço: a decisão do cliente já foi gravada */
  }
}

export async function responderVersao(
  token: string,
  versaoId: string,
  decisao: "aprovado" | "reprovado",
  motivo: string | null
): Promise<{ erro?: string }> {
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("responder_versao", {
    p_token: token,
    p_versao_id: versaoId,
    p_decisao: decisao,
    p_motivo: motivo,
  });
  if (error) return { erro: mensagemErro(error.message) };
  await avisarEquipe(supabase, token, versaoId, decisao, motivo);
  return {};
}
```

- [ ] **Step 4: Ações de configuração**

```ts
// actions/whatsapp.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  conectar, criarInstancia, estadoConexao, listarGrupos, INSTANCIA_PADRAO,
} from "@/lib/whatsapp";
import { avisarClienteConteudo } from "@/lib/avisos-servidor";

async function usuario() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function instanciaAtual(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from("app_config").select("valor").eq("chave", "whatsapp_instancia").maybeSingle();
  return data?.valor || INSTANCIA_PADRAO;
}

export async function statusWhatsapp() {
  const { supabase, user } = await usuario();
  if (!user) return { instancia: INSTANCIA_PADRAO, estado: "sem_login", grupoEquipe: null, configurado: false };
  const instancia = await instanciaAtual(supabase);
  const { data: cfg } = await supabase
    .from("app_config").select("chave, valor")
    .in("chave", ["whatsapp_grupo_equipe_id", "whatsapp_grupo_equipe_nome"]);
  const mapa = new Map((cfg ?? []).map((c: any) => [c.chave, c.valor]));
  const configurado = Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY);
  let estado = "nao_configurado";
  if (configurado) {
    try { estado = await estadoConexao(instancia); } catch { estado = "sem_instancia"; }
  }
  const idEquipe = mapa.get("whatsapp_grupo_equipe_id");
  return {
    instancia,
    estado,
    grupoEquipe: idEquipe ? { id: idEquipe, nome: mapa.get("whatsapp_grupo_equipe_nome") ?? idEquipe } : null,
    configurado,
  };
}

export async function iniciarConexao(numero?: string): Promise<{ erro?: string; qr?: string; codigo?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  try {
    const instancia = await instanciaAtual(supabase);
    try {
      await estadoConexao(instancia);
    } catch {
      await criarInstancia(instancia);
    }
    await supabase.from("app_config").upsert({ chave: "whatsapp_instancia", valor: instancia });
    const r = await conectar(instancia, numero?.replace(/\D/g, "") || undefined);
    return { qr: r.base64, codigo: r.pairingCode ?? undefined };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao conectar." };
  }
}

export async function gruposDisponiveis(): Promise<{ erro?: string; grupos?: { id: string; nome: string }[] }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  try {
    return { grupos: await listarGrupos(await instanciaAtual(supabase)) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao listar grupos." };
  }
}

export async function salvarGrupoEquipe(id: string, nome: string): Promise<{ erro?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  if (!id.endsWith("@g.us")) return { erro: "Grupo inválido." };
  const { error } = await supabase.from("app_config").upsert([
    { chave: "whatsapp_grupo_equipe_id", valor: id },
    { chave: "whatsapp_grupo_equipe_nome", valor: nome },
  ]);
  if (error) return { erro: "Não foi possível salvar o grupo." };
  revalidatePath("/configuracoes");
  return {};
}

export async function salvarGrupoCliente(
  clienteId: string,
  id: string | null,
  nome: string | null
): Promise<{ erro?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  if (id && !id.endsWith("@g.us")) return { erro: "Grupo inválido." };
  const { error } = await supabase
    .from("clientes")
    .update({ whatsapp_grupo_id: id, whatsapp_grupo_nome: id ? nome : null })
    .eq("id", clienteId);
  if (error) return { erro: "Não foi possível salvar o grupo do cliente." };
  revalidatePath(`/conteudos/${clienteId}`);
  return {};
}

export async function reenviarAviso(clienteId: string): Promise<{ erro?: string; enviado?: boolean }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  const { data: conteudos } = await supabase
    .from("conteudos")
    .select("titulo, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(1);
  const titulo = conteudos?.[0]?.titulo ?? "Conteúdos";
  const r = await avisarClienteConteudo({ supabase, clienteId, tipo: "conteudo_novo", titulo, forcar: true });
  if (r.motivo === "sem_grupo") return { erro: "Este cliente ainda não tem grupo de WhatsApp escolhido." };
  if (!r.enviado) return { erro: r.erro ?? "Não foi possível enviar o aviso." };
  return { enviado: true };
}
```

- [ ] **Step 5: Typecheck e testes**

Run: `cd codium-agency && npx tsc --noEmit && node --test lib/avisos.test.ts lib/whatsapp.test.ts lib/conteudos.test.ts lib/r2.test.ts lib/format.test.ts`
Expected: sem erros de tipo; todos os testes PASS.

- [ ] **Step 6: Verificação do "nunca lança" com o Evolution indisponível**

Com `EVOLUTION_URL` apontando para um endereço morto (`http://127.0.0.1:9`) e as chaves quaisquer, subir um conteúdo de um cliente com grupo escolhido.
Expected: o conteúdo é criado normalmente; em `avisos_whatsapp` aparece uma linha `ok = false` com `erro` preenchido; nenhuma exceção chega à tela.

- [ ] **Step 7: Commit**

```bash
git add codium-agency/lib/avisos-servidor.ts codium-agency/actions/whatsapp.ts codium-agency/actions/conteudos.ts codium-agency/actions/feed.ts
git commit -m "feat: notificador de WhatsApp e disparos (conteudo novo, versao, decisao)"
```

---

## Task 5: Interface — Configurações → WhatsApp e grupo do cliente

**Files:**
- Create: `components/WhatsappConfig.tsx`
- Create: `components/GrupoCliente.tsx`
- Modify: `app/(app)/configuracoes/page.tsx` (nova seção)
- Modify: `app/(app)/conteudos/[clienteId]/page.tsx` (card do grupo)

**Interfaces:**
- Consumes: ações da Task 4; tabela `avisos_whatsapp`; colunas `clientes.whatsapp_grupo_id/nome`.
- Produces: `<WhatsappConfig status={Awaited<ReturnType<typeof statusWhatsapp>>} avisos={AvisoLinha[]} />`, `<GrupoCliente clienteId atualId atualNome />`.

- [ ] **Step 1: Componente de configuração**

```tsx
// components/WhatsappConfig.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gruposDisponiveis, iniciarConexao, salvarGrupoEquipe, statusWhatsapp } from "@/actions/whatsapp";

type Status = Awaited<ReturnType<typeof statusWhatsapp>>;
export interface AvisoLinha {
  id: string;
  tipo: string;
  destino: string;
  texto: string;
  ok: boolean;
  erro: string | null;
  created_at: string;
}

const ESTADO: Record<string, string> = {
  open: "Conectado",
  connecting: "Conectando…",
  close: "Desconectado",
  sem_instancia: "Instância ainda não criada",
  nao_configurado: "Servidor não configurado",
  sem_login: "Sem login",
};

export default function WhatsappConfig({ status, avisos }: { status: Status; avisos: AvisoLinha[] }) {
  const router = useRouter();
  const [estado, setEstado] = useState(status.estado);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<{ id: string; nome: string }[] | null>(null);
  const [pendente, start] = useTransition();

  // enquanto conectando, confere o estado a cada 3 s
  useEffect(() => {
    if (estado === "open" || !qr) return;
    const t = setInterval(async () => {
      const s = await statusWhatsapp();
      setEstado(s.estado);
      if (s.estado === "open") {
        setQr(null);
        setCodigo(null);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [estado, qr, router]);

  function conectar(comNumero: boolean) {
    setErro(null);
    start(async () => {
      const r = await iniciarConexao(comNumero ? numero : undefined);
      if (r.erro) return setErro(r.erro);
      setQr(r.qr ?? null);
      setCodigo(r.codigo ?? null);
      setEstado("connecting");
    });
  }

  function carregarGrupos() {
    setErro(null);
    start(async () => {
      const r = await gruposDisponiveis();
      if (r.erro) return setErro(r.erro);
      setGrupos(r.grupos ?? []);
    });
  }

  function escolherEquipe(id: string) {
    const g = grupos?.find((x) => x.id === id);
    if (!g) return;
    start(async () => {
      const r = await salvarGrupoEquipe(g.id, g.nome);
      if (r.erro) return setErro(r.erro);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            estado === "open" ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"
          }`}
        >
          {ESTADO[estado] ?? estado}
        </span>
        <span className="text-xs text-slate-400">Instância: {status.instancia}</span>
      </div>

      {!status.configurado && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          Faltam as variáveis <code>EVOLUTION_URL</code> e <code>EVOLUTION_API_KEY</code> na Vercel.
        </p>
      )}

      {status.configurado && estado !== "open" && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho, e escaneie o QR.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => conectar(false)}
              disabled={pendente}
              className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Gerar QR code
            </button>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ou número com DDI (ex.: 5549999990000)"
              className="input flex-1"
            />
            <button
              onClick={() => conectar(true)}
              disabled={pendente || numero.replace(/\D/g, "").length < 10}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Usar código de pareamento
            </button>
          </div>
          {qr && <img src={qr} alt="QR code do WhatsApp" className="h-56 w-56 rounded-lg border border-slate-200" />}
          {codigo && (
            <p className="text-sm">
              Código de pareamento: <span className="font-mono font-semibold">{codigo}</span>
            </p>
          )}
        </div>
      )}

      {estado === "open" && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="text-xs uppercase text-slate-400">Grupo da equipe (recebe aprovações e reprovações)</div>
          <div className="text-sm text-navy-900">{status.grupoEquipe ? status.grupoEquipe.nome : "Nenhum escolhido"}</div>
          {grupos === null ? (
            <button
              onClick={carregarGrupos}
              disabled={pendente}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              {status.grupoEquipe ? "Trocar grupo" : "Escolher grupo"}
            </button>
          ) : (
            <select
              defaultValue=""
              onChange={(e) => escolherEquipe(e.target.value)}
              className="input w-full"
            >
              <option value="" disabled>
                {grupos.length ? "Selecione um grupo" : "Nenhum grupo encontrado"}
              </option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {erro && <p className="text-sm text-danger">{erro}</p>}

      <div>
        <div className="mb-2 text-xs uppercase text-slate-400">Avisos recentes</div>
        {avisos.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum aviso enviado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
            {avisos.map((a) => (
              <li key={a.id} className="flex items-start gap-2 p-2">
                <span className={a.ok ? "text-ok" : "text-danger"}>{a.ok ? "✓" : "✕"}</span>
                <div className="min-w-0">
                  <div className="truncate text-slate-700">{a.texto}</div>
                  {!a.ok && a.erro && <div className="text-danger">{a.erro}</div>}
                  <div className="text-slate-400">{new Date(a.created_at).toLocaleString("pt-BR")}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Componente do grupo do cliente**

```tsx
// components/GrupoCliente.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gruposDisponiveis, reenviarAviso, salvarGrupoCliente } from "@/actions/whatsapp";

export default function GrupoCliente({
  clienteId,
  atualId,
  atualNome,
}: {
  clienteId: string;
  atualId: string | null;
  atualNome: string | null;
}) {
  const router = useRouter();
  const [grupos, setGrupos] = useState<{ id: string; nome: string }[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  function carregar() {
    setAviso(null);
    start(async () => {
      const r = await gruposDisponiveis();
      if (r.erro) return setAviso(r.erro);
      setGrupos(r.grupos ?? []);
    });
  }

  function escolher(id: string) {
    const g = grupos?.find((x) => x.id === id);
    start(async () => {
      const r = await salvarGrupoCliente(clienteId, g ? g.id : null, g ? g.nome : null);
      if (r.erro) return setAviso(r.erro);
      setGrupos(null);
      setAviso("Grupo salvo.");
      router.refresh();
    });
  }

  function reenviar() {
    setAviso(null);
    start(async () => {
      const r = await reenviarAviso(clienteId);
      setAviso(r.erro ?? "Aviso enviado no grupo.");
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="text-xs uppercase text-slate-400">Grupo de WhatsApp do cliente</div>
      <div className="text-sm text-navy-900">{atualId ? (atualNome ?? atualId) : "Nenhum grupo escolhido (sem avisos)"}</div>
      <div className="flex flex-wrap gap-2">
        {grupos === null ? (
          <button
            onClick={carregar}
            disabled={pendente}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            {atualId ? "Trocar grupo" : "Escolher grupo"}
          </button>
        ) : (
          <select defaultValue="" onChange={(e) => escolher(e.target.value)} className="input w-full">
            <option value="" disabled>
              {grupos.length ? "Selecione um grupo" : "Nenhum grupo encontrado (conecte o WhatsApp)"}
            </option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        )}
        {atualId && (
          <button
            onClick={reenviar}
            disabled={pendente}
            className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Avisar de novo no grupo
          </button>
        )}
      </div>
      {aviso && <p className="text-xs text-slate-500">{aviso}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Ligar nas páginas**

`app/(app)/configuracoes/page.tsx`: importar `WhatsappConfig` e `statusWhatsapp`; dentro do `Promise.all` do início da função, adicionar `statusWhatsapp()` e a consulta `supabase.from("avisos_whatsapp").select("*").order("created_at", { ascending: false }).limit(20)`; renderizar, antes do bloco "Catálogo de serviços":

```tsx
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">WhatsApp (avisos de conteúdo)</h2>
        <p className="mb-4 text-xs text-slate-400">
          Conecte o número que envia os avisos e escolha o grupo da equipe. O grupo de cada cliente é
          escolhido na página dele, em Conteúdos.
        </p>
        <WhatsappConfig status={statusWhats} avisos={(avisos ?? []) as any} />
      </div>
```

`app/(app)/conteudos/[clienteId]/page.tsx`: trocar o `select("id, empresa, link_token")` por `select("id, empresa, link_token, whatsapp_grupo_id, whatsapp_grupo_nome")` e renderizar, logo abaixo de `<LinkCliente ... />`:

```tsx
      <GrupoCliente
        clienteId={cliente.id}
        atualId={cliente.whatsapp_grupo_id}
        atualNome={cliente.whatsapp_grupo_nome}
      />
```
(com `import GrupoCliente from "@/components/GrupoCliente";`).

- [ ] **Step 4: Typecheck e build**

Run: `cd codium-agency && npx tsc --noEmit && npm run build`
Expected: sem erros; `/configuracoes` e `/conteudos/[clienteId]` compilam.

- [ ] **Step 5: Commit**

```bash
git add codium-agency/components/WhatsappConfig.tsx codium-agency/components/GrupoCliente.tsx "codium-agency/app/(app)/configuracoes/page.tsx" "codium-agency/app/(app)/conteudos"
git commit -m "feat: configuracao de WhatsApp e grupo por cliente"
```

---

## Task 6: Verificação ponta a ponta e deploy

**Pré-requisito do dono (não é código):**
1. Na Vercel, projeto `codium-agency`, Production + Preview: `EVOLUTION_URL` (tipo Config) = `https://evo.178-104-60-250.sslip.io` e `EVOLUTION_API_KEY` (tipo Secret), colada por ele. Valor da chave: a mesma do Rastreador, no servidor Hetzner.
2. O número que vai enviar precisa estar nos grupos dos clientes e no grupo da equipe.

- [ ] **Step 1: Suíte local completa**

Run: `cd codium-agency && node --test lib/*.test.ts && npx tsc --noEmit && npm run build`
Expected: todos PASS, sem erros de tipo, build ok.

- [ ] **Step 2: Subir, ver o estado "Servidor não configurado" antes das variáveis**

Em produção (ou local sem as variáveis), abrir Configurações → WhatsApp.
Expected: aviso "Faltam as variáveis EVOLUTION_URL e EVOLUTION_API_KEY".

- [ ] **Step 3: Conectar**

Com as variáveis na Vercel e o deploy READY: Configurações → WhatsApp → **Gerar QR code** → escanear com o celular.
Expected: estado muda para "Conectado". Se o QR não parear, usar **código de pareamento** com o número (plano B para o bug do Baileys já visto no Rastreador).

- [ ] **Step 4: Escolher grupos**

Configurações → **Escolher grupo** (equipe). Em Conteúdos → um cliente de teste → **Escolher grupo**.
Expected: as listas mostram os grupos do número conectado.

- [ ] **Step 5: Conteúdo novo avisa uma vez só**

Subir 3 imagens `TESTE` seguidas no cliente de teste.
Expected: **1** mensagem no grupo do cliente (a primeira); as outras 2 não geram mensagem. Em Configurações → Avisos recentes aparece 1 sucesso. Aguardar 10 minutos, subir outra: nova mensagem.

- [ ] **Step 6: Decisões avisam a equipe**

No link do cliente (janela anônima): aprovar um e reprovar outro com motivo.
Expected: o grupo da equipe recebe `✅ ... aprovou «...»` e `❌ ... reprovou «...»: <motivo>`.

- [ ] **Step 7: Nova versão e trocar arquivo**

Subir nova versão de um reprovado → mensagem `🔄 ...` no grupo do cliente. Trocar o arquivo de um pendente → **nenhuma** mensagem.

- [ ] **Step 8: Reenvio manual**

Clicar **Avisar de novo no grupo**.
Expected: mensagem enviada mesmo dentro dos 10 minutos.

- [ ] **Step 9: Falha não trava**

Em Configurações, desconectar (ou desligar o Evolution pelo painel do servidor) e subir um conteúdo.
Expected: conteúdo sobe normalmente; o aviso aparece como ✕ com o erro.

- [ ] **Step 10: Limpeza e registro**

```sql
delete from public.conteudos where titulo like 'TESTE%';
delete from public.avisos_whatsapp;
```
Atualizar a spec com "Estado: implementado em <data>", commitar e dar push.

```bash
git add docs
git commit -m "docs: marca avisos de WhatsApp como implementado"
git push
```
