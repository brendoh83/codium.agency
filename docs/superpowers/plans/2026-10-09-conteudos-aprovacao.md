# Conteúdos para aprovação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard "Conteúdos" onde a agência sobe vídeos/imagens por cliente e uma página pública por link onde o cliente aprova ou reprova (com motivo), com arquivos expirando em 30 dias.

**Architecture:** Arquivos no Cloudflare R2 (upload direto do navegador por URL pré-assinada, leitura por URL pré-assinada gerada no servidor). Metadados e decisões no Supabase `codium-agency`; a página pública fala com o banco só por duas funções `SECURITY DEFINER` validadas pelo token do link. Tudo no mesmo app Next.js; a rota pública `/c/[token]` fica fora do grupo `(app)`, sem sidebar.

**Tech Stack:** Next.js 14.2.15 (App Router, Server Actions), React 18.3.1, TypeScript 5.5.4, Tailwind 3.4.10, Supabase (`@supabase/supabase-js` 2.45.4, `@supabase/ssr` 0.4.0), `aws4fetch` (novo), Node 24 (`node --test` para testes de funções puras).

**Spec:** `docs/superpowers/specs/2026-10-09-conteudos-aprovacao-design.md`

## Global Constraints

- Raiz do repo: `codium.agency/` (comandos `git` rodam daqui; caminhos nos `git add` já levam o prefixo `codium-agency/`). O app fica em `codium-agency/` (Root Directory da Vercel; comandos `npm`/`node`/`npx` rodam de lá). Caminhos de arquivo nos blocos "Files" são relativos a `codium-agency/`, exceto os de `docs/`.
- Token do link: **10 caracteres**, base62-like, aleatório, nunca derivado do nome do cliente; regenerável.
- Retenção: `expira_em = created_at + 30 days` por versão; regra de lifecycle do R2 apaga o arquivo em 30 dias.
- Reprovar exige motivo não vazio (depois de `btrim`), máx. 2000 caracteres.
- Aprovar exige caixa de confirmação "Deseja aprovar este conteúdo? Sim / Não".
- Sem login na página do cliente; acesso anônimo às tabelas é proibido (RLS ligado, sem policy para `anon`).
- Chaves do R2 só em variáveis de ambiente (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`); nunca no repo nem no chat.
- Estilo: tokens Tailwind existentes (`navy-900`, `copper-500`, `ok`, `warn`, `danger`, `shadow-card`); código e textos de UI em português; seguir o padrão de `actions/tarefas.ts` (`"use server"`, `createClient()` de `@/lib/supabase/server`).
- Fora do escopo: aviso por WhatsApp, comentários, carrossel, download pelo cliente, miniaturas, transcodificação, exclusão de conteúdo.

## Review Focus

- Token inexistente ou de outro cliente: `feed_cliente` devolve `null`; `responder_versao` não afeta versão de outro cliente. (Task 1)
- Reprovar com motivo vazio ou só espaços é rejeitado no banco, não só na tela. (Task 1, Task 5)
- Responder a mesma versão duas vezes (duplo clique), versão que já tem versão mais nova, ou versão expirada é rejeitado. (Task 1)
- Upload de tipo não permitido (ex.: `.exe`), tamanho 0 ou acima de 500 MB é rejeitado antes de gerar URL. (Task 2, Task 3)
- Arquivo expirado: página mostra "Arquivo expirado", não tenta tocar o vídeo e não oferece Aprovar/Reprovar. (Task 2, Task 5)

---

## Task 0: Preparação (manual, usuário) — pode rodar em paralelo às Tasks 1–5

**Não é código.** O dono da conta faz isso no painel da Cloudflare e da Vercel; o agente não cria conta nem insere pagamento.

- [ ] **Step 1: Criar conta Cloudflare** em `https://dash.cloudflare.com/sign-up` e ativar **R2 Object Storage** no menu lateral (a Cloudflare pode pedir cartão para ativar; a cota grátis de 10 GB/mês vale igual).
- [ ] **Step 2: Criar bucket** `codium-conteudos` (privado, sem acesso público).
- [ ] **Step 3: CORS do bucket** (Settings → CORS policy), colando:

```json
[
  {
    "AllowedOrigins": [
      "https://codium-agency-brendo-henriques-projects.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Se o dashboard usar domínio próprio, incluir esse domínio em `AllowedOrigins`.

- [ ] **Step 4: Regra de expiração** (Settings → Object lifecycle rules → Add rule): aplicar a todo o bucket, ação "Delete objects", **30 dias** após a criação.
- [ ] **Step 5: Chave de API** (R2 → Manage API tokens → Create): permissão **Object Read & Write**, restrita ao bucket `codium-conteudos`. Anotar Account ID, Access Key ID e Secret Access Key.
- [ ] **Step 6: Cadastrar variáveis** na Vercel (projeto `codium-agency` → Settings → Environment Variables, Production + Preview): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=codium-conteudos`. Para teste local, as mesmas quatro em `codium-agency/.env.local` (já ignorado pelo `.gitignore`). **Não colar os valores no chat.**

---

## Task 1: Banco — tabelas, token do link e funções

**Files:**
- Apply via Supabase MCP (`apply_migration`, projeto `ssroxcrywymmusresjsn`), nome: `conteudos_aprovacao`
- Create: `docs/superpowers/plans/sql/2026-10-09-conteudos_aprovacao.sql` (cópia da migration, para o repo)

**Interfaces:**
- Produces (SQL):
  - `clientes.link_token text not null unique` (default `gerar_link_token()`)
  - `conteudos(id, cliente_id, titulo, tipo, created_at)`
  - `conteudo_versoes(id, conteudo_id, numero, r2_key, mime, tamanho, created_at, expira_em, decisao, motivo, decidido_em)`
  - `feed_cliente(p_token text) returns jsonb` → `null` se token inválido, senão `{ empresa, conteudos: [{ id, titulo, tipo, created_at, versoes: [{ id, numero, r2_key, mime, created_at, expirada, decisao, motivo, decidido_em }] }] }` (versões em ordem crescente de `numero`; conteúdos do mais novo ao mais antigo)
  - `responder_versao(p_token text, p_versao_id uuid, p_decisao text, p_motivo text default null) returns void` — erros por mensagem: `decisao invalida`, `motivo obrigatorio`, `versao nao encontrada`, `ja respondida`, `arquivo expirado`, `versao antiga`
  - `regerar_link_cliente(p_cliente_id uuid) returns text` (só `authenticated`)

- [ ] **Step 1: Escrever o teste SQL (falha antes da migration)**

Rodar com `execute_sql`. O teste faz tudo dentro de um bloco e termina com `raise exception 'TESTES OK'`, o que desfaz qualquer dado criado. Qualquer outra mensagem é falha.

```sql
do $$
declare
  cid uuid; tok text; cid2 uuid; tok2 text;
  cont uuid; v1 uuid; v2 uuid; vexp uuid; contexp uuid; r jsonb; n int;
begin
  select id, link_token into cid, tok from public.clientes order by id limit 1;
  select id, link_token into cid2, tok2 from public.clientes where id <> cid order by id limit 1;

  insert into public.conteudos (cliente_id, titulo, tipo) values (cid, 'teste', 'video') returning id into cont;
  insert into public.conteudo_versoes (conteudo_id, numero, r2_key, mime, tamanho)
    values (cont, 1, 'clientes/x/a.mp4', 'video/mp4', 10) returning id into v1;

  -- 1: token inexistente
  if public.feed_cliente('naoexiste') is not null then raise exception 'FALHA 1 token inexistente'; end if;

  -- 2: feed do cliente contém o conteúdo; feed de outro cliente não
  r := public.feed_cliente(tok);
  if not jsonb_path_exists(r, '$.conteudos[*] ? (@.id == $id)', jsonb_build_object('id', cont::text)) then
    raise exception 'FALHA 2a feed do cliente sem o conteudo';
  end if;
  r := public.feed_cliente(tok2);
  if jsonb_path_exists(r, '$.conteudos[*] ? (@.id == $id)', jsonb_build_object('id', cont::text)) then
    raise exception 'FALHA 2b feed de outro cliente vaza conteudo';
  end if;

  -- 3: outro cliente não responde versão alheia
  begin perform public.responder_versao(tok2, v1, 'aprovado', null); raise exception 'FALHA 3';
  exception when others then if sqlerrm = 'FALHA 3' then raise; end if; end;

  -- 4: reprovar sem motivo / só espaços
  begin perform public.responder_versao(tok, v1, 'reprovado', '   '); raise exception 'FALHA 4';
  exception when others then if sqlerrm = 'FALHA 4' then raise; end if; end;

  -- 5: decisão inválida
  begin perform public.responder_versao(tok, v1, 'talvez', null); raise exception 'FALHA 5';
  exception when others then if sqlerrm = 'FALHA 5' then raise; end if; end;

  -- 6: reprovar com motivo funciona e grava
  perform public.responder_versao(tok, v1, 'reprovado', '  trocar a musica  ');
  select count(*) into n from public.conteudo_versoes where id = v1 and decisao = 'reprovado' and motivo = 'trocar a musica';
  if n <> 1 then raise exception 'FALHA 6 reprovacao nao gravou'; end if;

  -- 7: responder de novo a mesma versão
  begin perform public.responder_versao(tok, v1, 'aprovado', null); raise exception 'FALHA 7';
  exception when others then if sqlerrm = 'FALHA 7' then raise; end if; end;

  -- 8: versão antiga (existe versão mais nova sem decisão em v1? v1 já decidida; testar com conteúdo novo)
  insert into public.conteudos (cliente_id, titulo, tipo) values (cid, 'teste2', 'imagem') returning id into contexp;
  insert into public.conteudo_versoes (conteudo_id, numero, r2_key, mime, tamanho)
    values (contexp, 1, 'clientes/x/b.png', 'image/png', 10) returning id into vexp;
  insert into public.conteudo_versoes (conteudo_id, numero, r2_key, mime, tamanho)
    values (contexp, 2, 'clientes/x/c.png', 'image/png', 10) returning id into v2;
  begin perform public.responder_versao(tok, vexp, 'aprovado', null); raise exception 'FALHA 8';
  exception when others then if sqlerrm = 'FALHA 8' then raise; end if; end;

  -- 9: versão expirada não pode ser respondida
  update public.conteudo_versoes set expira_em = now() - interval '1 day' where id = v2;
  begin perform public.responder_versao(tok, v2, 'aprovado', null); raise exception 'FALHA 9';
  exception when others then if sqlerrm = 'FALHA 9' then raise; end if; end;
  r := public.feed_cliente(tok);
  if not jsonb_path_exists(r, '$.conteudos[*].versoes[*] ? (@.expirada == true)') then
    raise exception 'FALHA 9b feed nao marca expirada';
  end if;

  -- 10: constraint de tabela: reprovado sem motivo
  begin
    update public.conteudo_versoes set decisao = 'reprovado', decidido_em = now(), motivo = '' where id = vexp;
    raise exception 'FALHA 10';
  exception when others then if sqlerrm = 'FALHA 10' then raise; end if; end;

  -- 11: aprovar versão atual válida funciona
  update public.conteudo_versoes set expira_em = now() + interval '30 days' where id = v2;
  perform public.responder_versao(tok, v2, 'aprovado', null);
  select count(*) into n from public.conteudo_versoes where id = v2 and decisao = 'aprovado' and motivo is null;
  if n <> 1 then raise exception 'FALHA 11'; end if;

  raise exception 'TESTES OK';
end $$;
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run (MCP `execute_sql`): o bloco acima.
Expected: erro `relation "public.conteudos" does not exist` (ou similar). Não pode terminar em `TESTES OK`.

- [ ] **Step 3: Aplicar a migration**

Rodar com `apply_migration` (nome `conteudos_aprovacao`) e salvar o mesmo texto em `docs/superpowers/plans/sql/2026-10-09-conteudos_aprovacao.sql`:

```sql
-- token curto e aleatório (9 bytes -> 12 chars base64; troca +/ e usa 10)
create or replace function public.gerar_link_token() returns text
language sql volatile set search_path = public, extensions as $$
  select substr(translate(encode(gen_random_bytes(9), 'base64'), '+/', 'ab'), 1, 10);
$$;
revoke all on function public.gerar_link_token() from public, anon;
grant execute on function public.gerar_link_token() to authenticated;

alter table public.clientes add column link_token text;
update public.clientes set link_token = public.gerar_link_token() where link_token is null;
alter table public.clientes
  alter column link_token set not null,
  alter column link_token set default public.gerar_link_token();
create unique index clientes_link_token_key on public.clientes (link_token);

create table public.conteudos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  tipo text not null check (tipo in ('video', 'imagem')),
  created_at timestamptz not null default now()
);
create index conteudos_cliente_idx on public.conteudos (cliente_id, created_at desc);

create table public.conteudo_versoes (
  id uuid primary key default gen_random_uuid(),
  conteudo_id uuid not null references public.conteudos(id) on delete cascade,
  numero int not null check (numero >= 1),
  r2_key text not null,
  mime text not null,
  tamanho bigint not null check (tamanho > 0),
  created_at timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 days',
  decisao text check (decisao in ('aprovado', 'reprovado')),
  motivo text,
  decidido_em timestamptz,
  unique (conteudo_id, numero),
  check ((decisao is null) = (decidido_em is null)),
  check (decisao is distinct from 'reprovado' or length(btrim(coalesce(motivo, ''))) > 0)
);

alter table public.conteudos enable row level security;
alter table public.conteudo_versoes enable row level security;
create policy auth_all_conteudos on public.conteudos for all to authenticated using (true) with check (true);
create policy auth_all_conteudo_versoes on public.conteudo_versoes for all to authenticated using (true) with check (true);

create or replace function public.feed_cliente(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cliente public.clientes%rowtype;
begin
  select * into v_cliente from public.clientes where link_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'empresa', v_cliente.empresa,
    'conteudos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'titulo', c.titulo, 'tipo', c.tipo, 'created_at', c.created_at,
        'versoes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', v.id, 'numero', v.numero, 'r2_key', v.r2_key, 'mime', v.mime,
            'created_at', v.created_at, 'expirada', v.expira_em < now(),
            'decisao', v.decisao, 'motivo', v.motivo, 'decidido_em', v.decidido_em
          ) order by v.numero)
          from public.conteudo_versoes v where v.conteudo_id = c.id
        ), '[]'::jsonb)
      ) order by c.created_at desc)
      from public.conteudos c where c.cliente_id = v_cliente.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.responder_versao(
  p_token text, p_versao_id uuid, p_decisao text, p_motivo text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_decisao is null or p_decisao not in ('aprovado', 'reprovado') then
    raise exception 'decisao invalida';
  end if;
  if p_decisao = 'reprovado' and length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo obrigatorio';
  end if;

  select ver.id, ver.numero, ver.conteudo_id, ver.decisao, ver.expira_em into r
    from public.conteudo_versoes ver
    join public.conteudos c on c.id = ver.conteudo_id
    join public.clientes cl on cl.id = c.cliente_id
   where ver.id = p_versao_id and cl.link_token = p_token;
  if not found then raise exception 'versao nao encontrada'; end if;
  if r.decisao is not null then raise exception 'ja respondida'; end if;
  if r.expira_em < now() then raise exception 'arquivo expirado'; end if;
  if exists (select 1 from public.conteudo_versoes
              where conteudo_id = r.conteudo_id and numero > r.numero) then
    raise exception 'versao antiga';
  end if;

  update public.conteudo_versoes
     set decisao = p_decisao,
         motivo = case when p_decisao = 'reprovado' then left(btrim(p_motivo), 2000) else null end,
         decidido_em = now()
   where id = p_versao_id and decisao is null;
  if not found then raise exception 'ja respondida'; end if;
end $$;

create or replace function public.regerar_link_cliente(p_cliente_id uuid) returns text
language plpgsql set search_path = public as $$
declare t text;
begin
  update public.clientes set link_token = public.gerar_link_token()
   where id = p_cliente_id returning link_token into t;
  return t;
end $$;

revoke all on function public.feed_cliente(text) from public;
revoke all on function public.responder_versao(text, uuid, text, text) from public;
revoke all on function public.regerar_link_cliente(uuid) from public, anon;
grant execute on function public.feed_cliente(text) to anon, authenticated;
grant execute on function public.responder_versao(text, uuid, text, text) to anon, authenticated;
grant execute on function public.regerar_link_cliente(uuid) to authenticated;
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: o bloco do Step 1.
Expected: erro com mensagem exatamente `TESTES OK` (a transação é desfeita; nenhum dado de teste fica).

- [ ] **Step 5: Conferir permissões e dados**

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as auth
from pg_proc p
where pronamespace = 'public'::regnamespace
  and proname in ('feed_cliente','responder_versao','regerar_link_cliente','gerar_link_token');
select count(*) filter (where link_token is null) as sem_token, count(*) as total from public.clientes;
```
Expected: `feed_cliente` e `responder_versao` com `anon = true`; `regerar_link_cliente` e `gerar_link_token` com `anon = false`; `sem_token = 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/sql/2026-10-09-conteudos_aprovacao.sql
git commit -m "feat(db): tabelas de conteudos, versoes e funcoes do feed"
```

---

## Task 2: Lógica pura de conteúdos (estado, feed, validação, mensagens)

**Files:**
- Create: `lib/conteudos.ts`
- Test: `lib/conteudos.test.ts`

**Interfaces:**
- Produces (`lib/conteudos.ts`, sem imports de `@/`):
  - `type Decisao = "aprovado" | "reprovado" | null`
  - `interface Versao { id: string; numero: number; mime: string; created_at: string; expirada: boolean; decisao: Decisao; motivo: string | null; decidido_em: string | null }`
  - `interface Conteudo { id: string; titulo: string; tipo: "video" | "imagem"; created_at: string; versoes: Versao[] }`
  - `type Estado = "pendente" | "reprovado" | "aprovado"`
  - `versaoAtual(c: { versoes: Versao[] }): Versao | undefined`
  - `estadoConteudo(c: { versoes: Versao[] }): Estado`
  - `separarFeed<T extends Conteudo>(cs: T[]): { topo: T[]; aprovados: T[] }`
  - `MAX_BYTES: number` (500 MB)
  - `tipoPorMime(mime: string): "video" | "imagem" | null`
  - `validarArquivo(mime: string, tamanho: number): string | null` (mensagem de erro ou `null`)
  - `chaveR2(clienteId: string, uuid: string, mime: string): string` → `clientes/<clienteId>/<uuid>.<ext>`
  - `mensagemErro(msg: string): string`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/conteudos.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveR2, estadoConteudo, mensagemErro, separarFeed, tipoPorMime, validarArquivo, versaoAtual,
  MAX_BYTES, type Conteudo, type Versao,
} from "./conteudos.ts";

const v = (numero: number, decisao: Versao["decisao"], extra: Partial<Versao> = {}): Versao => ({
  id: `v${numero}`, numero, mime: "video/mp4", created_at: "2026-10-01T00:00:00Z",
  expirada: false, decisao, motivo: decisao === "reprovado" ? "x" : null,
  decidido_em: decisao ? "2026-10-02T00:00:00Z" : null, ...extra,
});
const c = (id: string, versoes: Versao[], created_at = "2026-10-01T00:00:00Z"): Conteudo => ({
  id, titulo: id, tipo: "video", created_at, versoes,
});

test("estado vem da versão de maior número", () => {
  assert.equal(estadoConteudo(c("a", [v(1, null)])), "pendente");
  assert.equal(estadoConteudo(c("a", [v(1, "reprovado")])), "reprovado");
  assert.equal(estadoConteudo(c("a", [v(1, "reprovado"), v(2, null)])), "pendente");
  assert.equal(estadoConteudo(c("a", [v(2, "aprovado"), v(1, "reprovado")])), "aprovado");
});

test("conteúdo sem versões é tratado como pendente", () => {
  assert.equal(estadoConteudo(c("a", [])), "pendente");
  assert.equal(versaoAtual(c("a", [])), undefined);
});

test("separarFeed: topo = pendentes e reprovados (mais novos primeiro); aprovados por decisão mais recente", () => {
  const p = c("p", [v(1, null)], "2026-10-05T00:00:00Z");
  const r = c("r", [v(1, "reprovado")], "2026-10-06T00:00:00Z");
  const a1 = c("a1", [v(1, "aprovado", { decidido_em: "2026-10-03T00:00:00Z" })]);
  const a2 = c("a2", [v(1, "aprovado", { decidido_em: "2026-10-04T00:00:00Z" })]);
  const { topo, aprovados } = separarFeed([p, a1, r, a2]);
  assert.deepEqual(topo.map((x) => x.id), ["r", "p"]);
  assert.deepEqual(aprovados.map((x) => x.id), ["a2", "a1"]);
});

test("tipoPorMime", () => {
  assert.equal(tipoPorMime("video/mp4"), "video");
  assert.equal(tipoPorMime("image/jpeg"), "imagem");
  assert.equal(tipoPorMime("application/x-msdownload"), null);
  assert.equal(tipoPorMime(""), null);
});

test("validarArquivo rejeita tipo inválido, tamanho 0, negativo, NaN e acima do limite", () => {
  assert.equal(validarArquivo("video/mp4", 1000), null);
  assert.equal(validarArquivo("image/png", MAX_BYTES), null);
  assert.ok(validarArquivo("application/x-msdownload", 1000));
  assert.ok(validarArquivo("video/mp4", 0));
  assert.ok(validarArquivo("video/mp4", -5));
  assert.ok(validarArquivo("video/mp4", Number.NaN));
  assert.ok(validarArquivo("video/mp4", MAX_BYTES + 1));
});

test("chaveR2 usa a extensão do mime e o prefixo do cliente", () => {
  assert.equal(chaveR2("cli-1", "uuid-1", "video/mp4"), "clientes/cli-1/uuid-1.mp4");
  assert.equal(chaveR2("cli-1", "uuid-2", "video/quicktime"), "clientes/cli-1/uuid-2.mov");
  assert.equal(chaveR2("cli-1", "uuid-3", "image/jpeg"), "clientes/cli-1/uuid-3.jpg");
});

test("mensagemErro traduz erros do banco e tem fallback", () => {
  assert.match(mensagemErro("motivo obrigatorio"), /motivo/i);
  assert.match(mensagemErro("ja respondida"), /já foi respondido/i);
  assert.match(mensagemErro("arquivo expirado"), /expirou/i);
  assert.match(mensagemErro("versao antiga"), /mais nova/i);
  assert.match(mensagemErro("qualquer coisa"), /tente/i);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd codium-agency && node --test lib/conteudos.test.ts`
Expected: FAIL com `Cannot find module './conteudos.ts'`.

- [ ] **Step 3: Implementação mínima**

```ts
// lib/conteudos.ts
export type Decisao = "aprovado" | "reprovado" | null;

export interface Versao {
  id: string;
  numero: number;
  mime: string;
  created_at: string;
  expirada: boolean;
  decisao: Decisao;
  motivo: string | null;
  decidido_em: string | null;
}

export interface Conteudo {
  id: string;
  titulo: string;
  tipo: "video" | "imagem";
  created_at: string;
  versoes: Versao[];
}

export type Estado = "pendente" | "reprovado" | "aprovado";

export const MAX_BYTES = 500 * 1024 * 1024;

const MIMES: Record<string, { tipo: "video" | "imagem"; ext: string }> = {
  "video/mp4": { tipo: "video", ext: "mp4" },
  "video/quicktime": { tipo: "video", ext: "mov" },
  "video/webm": { tipo: "video", ext: "webm" },
  "image/jpeg": { tipo: "imagem", ext: "jpg" },
  "image/png": { tipo: "imagem", ext: "png" },
  "image/webp": { tipo: "imagem", ext: "webp" },
};

export function versaoAtual(c: { versoes: Versao[] }): Versao | undefined {
  return c.versoes.reduce<Versao | undefined>(
    (maior, v) => (!maior || v.numero > maior.numero ? v : maior),
    undefined
  );
}

export function estadoConteudo(c: { versoes: Versao[] }): Estado {
  const d = versaoAtual(c)?.decisao;
  return d === "aprovado" ? "aprovado" : d === "reprovado" ? "reprovado" : "pendente";
}

export function separarFeed<T extends Conteudo>(cs: T[]): { topo: T[]; aprovados: T[] } {
  const porDataDesc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  const topo = cs
    .filter((c) => estadoConteudo(c) !== "aprovado")
    .sort((a, b) => porDataDesc(a.created_at, b.created_at));
  const aprovados = cs
    .filter((c) => estadoConteudo(c) === "aprovado")
    .sort((a, b) =>
      porDataDesc(versaoAtual(a)?.decidido_em ?? "", versaoAtual(b)?.decidido_em ?? "")
    );
  return { topo, aprovados };
}

export function tipoPorMime(mime: string): "video" | "imagem" | null {
  return MIMES[mime]?.tipo ?? null;
}

export function validarArquivo(mime: string, tamanho: number): string | null {
  if (!MIMES[mime]) return "Tipo de arquivo não permitido. Use MP4, MOV, WEBM, JPG, PNG ou WEBP.";
  if (!Number.isFinite(tamanho) || tamanho <= 0) return "Arquivo vazio.";
  if (tamanho > MAX_BYTES) return "Arquivo maior que 500 MB.";
  return null;
}

export function chaveR2(clienteId: string, uuid: string, mime: string): string {
  const ext = MIMES[mime]?.ext ?? "bin";
  return `clientes/${clienteId}/${uuid}.${ext}`;
}

export function mensagemErro(msg: string): string {
  if (msg.includes("motivo obrigatorio")) return "Escreva o motivo da reprovação.";
  if (msg.includes("ja respondida")) return "Este conteúdo já foi respondido.";
  if (msg.includes("arquivo expirado")) return "O arquivo expirou. Peça uma nova versão.";
  if (msg.includes("versao antiga")) return "Existe uma versão mais nova deste conteúdo.";
  return "Não foi possível enviar. Tente de novo.";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd codium-agency && node --test lib/conteudos.test.ts`
Expected: todos os testes PASS.

- [ ] **Step 5: Excluir testes do typecheck do Next**

Os testes importam `./conteudos.ts` (extensão `.ts`, exigida pelo Node), o que o `tsc` do projeto não aceita. Em `tsconfig.json`, adicionar `"**/*.test.ts"` ao array `exclude` (criar o array `exclude` com `"node_modules"` e `"**/*.test.ts"` se não existir).

Run: `cd codium-agency && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add codium-agency/tsconfig.json codium-agency/lib/conteudos.ts codium-agency/lib/conteudos.test.ts
git commit -m "feat: logica pura de conteudos (estado, feed, validacao)"
```

---

## Task 3: Camada R2 e rota de URL de upload

**Files:**
- Modify: `package.json` (adicionar `"aws4fetch": "^1.0.20"` em `dependencies`)
- Create: `lib/r2.ts`
- Test: `lib/r2.test.ts`
- Create: `app/api/conteudos/upload-url/route.ts`

**Interfaces:**
- Consumes: `validarArquivo`, `chaveR2` de `lib/conteudos.ts`.
- Produces:
  - `urlUpload(key: string): Promise<string>` — URL pré-assinada de PUT, válida por 900 s
  - `urlLeitura(key: string): Promise<string>` — URL pré-assinada de GET, válida por 3600 s
  - `POST /api/conteudos/upload-url` body `{ clienteId: string; mime: string; tamanho: number }` → `200 { key: string; url: string }` | `400 { erro: string }` | `401 { erro: string }`

- [ ] **Step 1: Adicionar dependência e instalar**

Editar `package.json` (`dependencies`), depois:

Run: `cd codium-agency && npm install`
Expected: instala sem erro; cria `node_modules/` e `package-lock.json`. Acrescentar `package-lock.json` ao `.gitignore` da raiz do repo (o projeto não versiona lockfile) e `git add .gitignore`.

- [ ] **Step 2: Escrever o teste que falha**

```ts
// lib/r2.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.R2_ACCOUNT_ID = "acc123";
process.env.R2_ACCESS_KEY_ID = "AKIATESTE";
process.env.R2_SECRET_ACCESS_KEY = "segredo-de-teste";
process.env.R2_BUCKET = "bkt";

const { urlUpload, urlLeitura } = await import("./r2.ts");

test("urlUpload assina PUT com expiração de 900s", async () => {
  const u = new URL(await urlUpload("clientes/c1/arquivo.mp4"));
  assert.equal(u.host, "acc123.r2.cloudflarestorage.com");
  assert.equal(u.pathname, "/bkt/clientes/c1/arquivo.mp4");
  assert.equal(u.searchParams.get("X-Amz-Expires"), "900");
  assert.ok(u.searchParams.get("X-Amz-Signature"));
});

test("urlLeitura assina GET com expiração de 3600s", async () => {
  const u = new URL(await urlLeitura("clientes/c1/arquivo.mp4"));
  assert.equal(u.searchParams.get("X-Amz-Expires"), "3600");
  assert.ok(u.searchParams.get("X-Amz-Signature"));
});

test("sem variáveis de ambiente lança erro claro", async () => {
  const guardado = process.env.R2_BUCKET;
  delete process.env.R2_BUCKET;
  await assert.rejects(() => urlLeitura("k"), /R2/);
  process.env.R2_BUCKET = guardado;
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd codium-agency && node --test lib/r2.test.ts`
Expected: FAIL com `Cannot find module './r2.ts'`.

- [ ] **Step 4: Implementar `lib/r2.ts`**

```ts
// lib/r2.ts — somente servidor
import { AwsClient } from "aws4fetch";

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 não configurado: faltam variáveis de ambiente R2_*");
  }
  return {
    aws: new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    }),
    base: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
  };
}

async function assinar(method: "PUT" | "GET", key: string, expiraSeg: number): Promise<string> {
  const { aws, base } = config();
  const caminho = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${base}/${caminho}`);
  url.searchParams.set("X-Amz-Expires", String(expiraSeg));
  const assinada = await aws.sign(new Request(url, { method }), { aws: { signQuery: true } });
  return assinada.url;
}

export const urlUpload = (key: string) => assinar("PUT", key, 900);
export const urlLeitura = (key: string) => assinar("GET", key, 3600);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd codium-agency && node --test lib/r2.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 6: Rota de URL de upload**

```ts
// app/api/conteudos/upload-url/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { chaveR2, validarArquivo } from "@/lib/conteudos";
import { urlUpload } from "@/lib/r2";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clienteId = typeof body?.clienteId === "string" ? body.clienteId : "";
  const mime = typeof body?.mime === "string" ? body.mime : "";
  const tamanho = Number(body?.tamanho);

  if (!UUID.test(clienteId)) return NextResponse.json({ erro: "Cliente inválido." }, { status: 400 });
  const erro = validarArquivo(mime, tamanho);
  if (erro) return NextResponse.json({ erro }, { status: 400 });

  const key = chaveR2(clienteId, randomUUID(), mime);
  return NextResponse.json({ key, url: await urlUpload(key) });
}
```

- [ ] **Step 7: Typecheck e commit**

Run: `cd codium-agency && npx tsc --noEmit`
Expected: sem erros.

```bash
git add .gitignore codium-agency/package.json codium-agency/lib/r2.ts codium-agency/lib/r2.test.ts codium-agency/app/api/conteudos/upload-url/route.ts
git commit -m "feat: camada R2 (URLs pre-assinadas) e rota de upload"
```

---

## Task 4: Dashboard — seção Conteúdos

**Files:**
- Modify: `components/Sidebar.tsx` (adicionar item após "Briefing Clientes")
- Create: `actions/conteudos.ts`
- Create: `components/ConteudoUpload.tsx`
- Create: `components/LinkCliente.tsx`
- Create: `app/(app)/conteudos/page.tsx`
- Create: `app/(app)/conteudos/[clienteId]/page.tsx`

**Interfaces:**
- Consumes: `Conteudo`, `Versao`, `estadoConteudo`, `versaoAtual`, `validarArquivo`, `tipoPorMime` de `@/lib/conteudos`; `urlLeitura` de `@/lib/r2`; `POST /api/conteudos/upload-url` (Task 3); tabelas e `regerar_link_cliente` (Task 1).
- Produces (`actions/conteudos.ts`, `"use server"`):
  - `registrarConteudo(i: { clienteId: string; titulo: string; key: string; mime: string; tamanho: number }): Promise<{ erro?: string }>`
  - `registrarNovaVersao(i: { clienteId: string; conteudoId: string; key: string; mime: string; tamanho: number }): Promise<{ erro?: string }>`
  - `regerarLink(clienteId: string): Promise<{ erro?: string; token?: string }>`
- Produces (componentes): `<ConteudoUpload clienteId conteudoId? />`, `<LinkCliente clienteId token />`.

- [ ] **Step 1: Sidebar**

Em `components/Sidebar.tsx`, na lista `ITEMS`, depois da linha de `/briefing`:

```ts
  { href: "/conteudos", label: "Conteúdos", icon: "▶" },
```

- [ ] **Step 2: Server actions**

```ts
// actions/conteudos.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tipoPorMime, validarArquivo } from "@/lib/conteudos";

type Resultado = { erro?: string };

function chaveValida(key: string, clienteId: string) {
  return key.startsWith(`clientes/${clienteId}/`) && !key.includes("..");
}

export async function registrarConteudo(i: {
  clienteId: string;
  titulo: string;
  key: string;
  mime: string;
  tamanho: number;
}): Promise<Resultado> {
  const titulo = i.titulo.trim();
  if (!titulo) return { erro: "Informe um título." };
  const erro = validarArquivo(i.mime, i.tamanho);
  const tipo = tipoPorMime(i.mime);
  if (erro || !tipo) return { erro: erro ?? "Tipo de arquivo inválido." };
  if (!chaveValida(i.key, i.clienteId)) return { erro: "Arquivo inválido." };

  const supabase = createClient();
  const { data: conteudo, error } = await supabase
    .from("conteudos")
    .insert({ cliente_id: i.clienteId, titulo, tipo })
    .select("id")
    .single();
  if (error || !conteudo) return { erro: "Não foi possível criar o conteúdo." };

  const { error: erroVersao } = await supabase.from("conteudo_versoes").insert({
    conteudo_id: conteudo.id,
    numero: 1,
    r2_key: i.key,
    mime: i.mime,
    tamanho: i.tamanho,
  });
  if (erroVersao) {
    await supabase.from("conteudos").delete().eq("id", conteudo.id);
    return { erro: "Não foi possível registrar o arquivo." };
  }
  revalidatePath(`/conteudos/${i.clienteId}`);
  revalidatePath("/conteudos");
  return {};
}

export async function registrarNovaVersao(i: {
  clienteId: string;
  conteudoId: string;
  key: string;
  mime: string;
  tamanho: number;
}): Promise<Resultado> {
  const erro = validarArquivo(i.mime, i.tamanho);
  if (erro) return { erro };
  if (!chaveValida(i.key, i.clienteId)) return { erro: "Arquivo inválido." };

  const supabase = createClient();
  const { data: conteudo } = await supabase
    .from("conteudos")
    .select("id, tipo, cliente_id")
    .eq("id", i.conteudoId)
    .eq("cliente_id", i.clienteId)
    .maybeSingle();
  if (!conteudo) return { erro: "Conteúdo não encontrado." };
  if (tipoPorMime(i.mime) !== conteudo.tipo) {
    return { erro: `A nova versão precisa ser ${conteudo.tipo === "video" ? "um vídeo" : "uma imagem"}.` };
  }

  const { data: ultima } = await supabase
    .from("conteudo_versoes")
    .select("numero, decisao")
    .eq("conteudo_id", i.conteudoId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultima) return { erro: "Conteúdo sem versão anterior." };
  if (ultima.decisao !== "reprovado") {
    return { erro: "Só é possível subir nova versão de um conteúdo reprovado." };
  }

  const { error } = await supabase.from("conteudo_versoes").insert({
    conteudo_id: i.conteudoId,
    numero: ultima.numero + 1,
    r2_key: i.key,
    mime: i.mime,
    tamanho: i.tamanho,
  });
  if (error) return { erro: "Não foi possível registrar a nova versão." };
  revalidatePath(`/conteudos/${i.clienteId}`);
  revalidatePath("/conteudos");
  return {};
}

export async function regerarLink(clienteId: string): Promise<{ erro?: string; token?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("regerar_link_cliente", { p_cliente_id: clienteId });
  if (error || typeof data !== "string") return { erro: "Não foi possível gerar o link novo." };
  revalidatePath(`/conteudos/${clienteId}`);
  return { token: data };
}
```

- [ ] **Step 3: Componente de upload**

```tsx
// components/ConteudoUpload.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarConteudo, registrarNovaVersao } from "@/actions/conteudos";

function enviarArquivo(url: string, arquivo: File, onProgresso: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", arquivo.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgresso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha no envio do arquivo."));
    xhr.onerror = () => reject(new Error("Falha de rede no envio do arquivo."));
    xhr.send(arquivo);
  });
}

export default function ConteudoUpload({
  clienteId,
  conteudoId,
}: {
  clienteId: string;
  conteudoId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const novaVersao = Boolean(conteudoId);
  const ocupado = pct !== null;

  async function enviar() {
    setErro(null);
    if (!arquivo) return setErro("Escolha um arquivo.");
    if (!novaVersao && !titulo.trim()) return setErro("Informe um título.");
    setPct(0);
    try {
      const r = await fetch("/api/conteudos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, mime: arquivo.type, tamanho: arquivo.size }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível preparar o envio.");
      await enviarArquivo(j.url, arquivo, setPct);
      const base = { clienteId, key: j.key as string, mime: arquivo.type, tamanho: arquivo.size };
      const res = novaVersao
        ? await registrarNovaVersao({ ...base, conteudoId: conteudoId as string })
        : await registrarConteudo({ ...base, titulo });
      if (res.erro) throw new Error(res.erro);
      setTitulo("");
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no envio.");
    } finally {
      setPct(null);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      {!novaVersao && (
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título do conteúdo (ex.: Reels de lançamento)"
          maxLength={200}
          disabled={ocupado}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
        disabled={ocupado}
        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-600"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={enviar}
          disabled={ocupado}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 disabled:opacity-50"
        >
          {novaVersao ? "Subir nova versão" : "Enviar conteúdo"}
        </button>
        {pct !== null && <span className="text-sm text-slate-500">{pct}%</span>}
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Componente do link do cliente**

```tsx
// components/LinkCliente.tsx
"use client";

import { useState } from "react";
import { regerarLink } from "@/actions/conteudos";

export default function LinkCliente({ clienteId, token }: { clienteId: string; token: string }) {
  const [atual, setAtual] = useState(token);
  const [aviso, setAviso] = useState<string | null>(null);
  const url = typeof window === "undefined" ? `/c/${atual}` : `${window.location.origin}/c/${atual}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado.");
    } catch {
      setAviso("Não foi possível copiar. Selecione e copie o link acima.");
    }
  }

  async function gerarNovo() {
    if (!confirm("O link atual deixa de funcionar. Gerar um link novo?")) return;
    const r = await regerarLink(clienteId);
    if (r.token) {
      setAtual(r.token);
      setAviso("Link novo gerado. O anterior não funciona mais.");
    } else {
      setAviso(r.erro ?? "Erro ao gerar o link.");
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="text-xs uppercase text-slate-400">Link do cliente</div>
      <input readOnly value={url} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={copiar} className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white hover:bg-navy-950">
          Copiar link
        </button>
        <button onClick={gerarNovo} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Gerar link novo
        </button>
      </div>
      {aviso && <p className="text-xs text-slate-500">{aviso}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Lista de clientes**

```tsx
// app/(app)/conteudos/page.tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { estadoConteudo } from "@/lib/conteudos";

export const dynamic = "force-dynamic";

export default async function ConteudosPage() {
  const supabase = createClient();
  const [{ data: clientes }, { data: conteudos }] = await Promise.all([
    supabase.from("clientes").select("id, empresa, status").order("empresa"),
    supabase.from("conteudos").select("id, cliente_id, conteudo_versoes(numero, decisao)"),
  ]);

  const abertosPorCliente = new Map<string, number>();
  for (const c of conteudos ?? []) {
    const versoes = ((c as any).conteudo_versoes ?? []) as { numero: number; decisao: any }[];
    if (estadoConteudo({ versoes: versoes as any }) !== "aprovado") {
      abertosPorCliente.set(c.cliente_id, (abertosPorCliente.get(c.cliente_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Conteúdos</h1>
        <p className="text-sm text-slate-500">Escolha um cliente para enviar e acompanhar conteúdos.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(clientes ?? []).map((c: any) => (
          <Link
            key={c.id}
            href={`/conteudos/${c.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-card hover:bg-slate-50"
          >
            <span className="font-medium text-navy-900">{c.empresa}</span>
            {(abertosPorCliente.get(c.id) ?? 0) > 0 && (
              <span className="rounded-full bg-warn/10 px-2 py-1 text-xs font-medium text-warn">
                {abertosPorCliente.get(c.id)} aguardando
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Página do cliente**

```tsx
// app/(app)/conteudos/[clienteId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { urlLeitura } from "@/lib/r2";
import { estadoConteudo, versaoAtual, type Versao } from "@/lib/conteudos";
import ConteudoUpload from "@/components/ConteudoUpload";
import LinkCliente from "@/components/LinkCliente";

export const dynamic = "force-dynamic";

const ESTADO = {
  pendente: { texto: "Aguardando aprovação", cls: "bg-warn/10 text-warn" },
  reprovado: { texto: "Reprovado", cls: "bg-danger/10 text-danger" },
  aprovado: { texto: "Aprovado", cls: "bg-ok/10 text-ok" },
} as const;

export default async function ConteudosClientePage({ params }: { params: { clienteId: string } }) {
  const supabase = createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, empresa, link_token")
    .eq("id", params.clienteId)
    .maybeSingle();
  if (!cliente) notFound();

  const { data: conteudos } = await supabase
    .from("conteudos")
    .select(
      "id, titulo, tipo, created_at, conteudo_versoes(id, numero, r2_key, mime, created_at, expira_em, decisao, motivo, decidido_em)"
    )
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false });

  const itens = await Promise.all(
    (conteudos ?? []).map(async (c: any) => {
      const versoes: (Versao & { r2_key: string })[] = (c.conteudo_versoes ?? [])
        .map((v: any) => ({ ...v, expirada: new Date(v.expira_em) < new Date() }))
        .sort((a: any, b: any) => a.numero - b.numero);
      const atual = versaoAtual({ versoes });
      const url = atual && !atual.expirada ? await urlLeitura((atual as any).r2_key) : null;
      return { ...c, versoes, atual, url, estado: estadoConteudo({ versoes }) };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/conteudos" className="text-xs text-slate-500 hover:underline">
          ← Conteúdos
        </Link>
        <h1 className="text-xl font-semibold text-navy-900">{cliente.empresa}</h1>
      </div>

      <LinkCliente clienteId={cliente.id} token={cliente.link_token} />
      <ConteudoUpload clienteId={cliente.id} />

      <div className="space-y-4">
        {itens.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Nenhum conteúdo enviado ainda.
          </p>
        )}
        {itens.map((c) => (
          <div key={c.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-navy-900">{c.titulo}</div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO[c.estado as keyof typeof ESTADO].cls}`}>
                {ESTADO[c.estado as keyof typeof ESTADO].texto} · v{c.atual?.numero}
              </span>
            </div>

            {c.url ? (
              c.tipo === "imagem" ? (
                <img src={c.url} alt={c.titulo} className="max-h-96 rounded-lg" />
              ) : (
                <video src={c.url} controls playsInline preload="metadata" className="max-h-96 w-full rounded-lg bg-black" />
              )
            ) : (
              <p className="rounded-lg bg-slate-100 p-6 text-center text-sm text-slate-500">Arquivo expirado</p>
            )}

            {c.versoes.some((v: Versao) => v.decisao === "reprovado") && (
              <ul className="space-y-1 text-sm text-slate-600">
                {c.versoes
                  .filter((v: Versao) => v.decisao === "reprovado")
                  .map((v: Versao) => (
                    <li key={v.id}>
                      <span className="font-medium">v{v.numero} reprovada:</span> {v.motivo}
                    </li>
                  ))}
              </ul>
            )}

            {c.estado === "reprovado" && <ConteudoUpload clienteId={cliente.id} conteudoId={c.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck e build**

Run: `cd codium-agency && npx tsc --noEmit && npm run build`
Expected: sem erros; rotas `/conteudos` e `/conteudos/[clienteId]` aparecem na saída do build.

- [ ] **Step 8: Commit**

```bash
git add codium-agency/components/Sidebar.tsx codium-agency/actions/conteudos.ts codium-agency/components/ConteudoUpload.tsx codium-agency/components/LinkCliente.tsx "codium-agency/app/(app)/conteudos"
git commit -m "feat: secao Conteudos no dashboard (upload, versoes, link do cliente)"
```

---

## Task 5: Página pública do cliente `/c/[token]`

**Files:**
- Modify: `middleware.ts` (liberar `/c/`)
- Create: `lib/supabase/publico.ts`
- Create: `actions/feed.ts`
- Create: `components/FeedCliente.tsx`
- Create: `app/c/[token]/page.tsx`

**Interfaces:**
- Consumes: `feed_cliente`, `responder_versao` (Task 1); `separarFeed`, `estadoConteudo`, `versaoAtual`, `mensagemErro`, tipos de `@/lib/conteudos`; `urlLeitura` de `@/lib/r2`.
- Produces:
  - `createPublicClient()` (cliente anônimo, sem cookies)
  - `responderVersao(token, versaoId, decisao, motivo): Promise<{ erro?: string }>`
  - `interface ItemFeed { id; titulo; tipo; estado; versaoId; numero; url: string | null; expirada: boolean; historico: { numero: number; motivo: string }[] }`

- [ ] **Step 1: Liberar a rota no middleware**

Em `middleware.ts`, junto de `isPublicAsset`:

```ts
  const isPublicFeed = path.startsWith("/c/");
```

e na condição de redirecionamento:

```ts
  if (!user && !isAuthRoute && !isPublicAsset && !isPublicFeed) {
```

- [ ] **Step 2: Cliente anônimo**

```ts
// lib/supabase/publico.ts
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export function createPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}
```

- [ ] **Step 3: Server action de resposta**

```ts
// actions/feed.ts
"use server";

import { createPublicClient } from "@/lib/supabase/publico";
import { mensagemErro } from "@/lib/conteudos";

export async function responderVersao(
  token: string,
  versaoId: string,
  decisao: "aprovado" | "reprovado",
  motivo: string | null
): Promise<{ erro?: string }> {
  const { error } = await createPublicClient().rpc("responder_versao", {
    p_token: token,
    p_versao_id: versaoId,
    p_decisao: decisao,
    p_motivo: motivo,
  });
  return error ? { erro: mensagemErro(error.message) } : {};
}
```

- [ ] **Step 4: Componente do feed**

```tsx
// components/FeedCliente.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { responderVersao } from "@/actions/feed";

export interface ItemFeed {
  id: string;
  titulo: string;
  tipo: "video" | "imagem";
  estado: "pendente" | "reprovado" | "aprovado";
  versaoId: string;
  numero: number;
  url: string | null;
  expirada: boolean;
  historico: { numero: number; motivo: string }[];
}

function Midia({ item }: { item: ItemFeed }) {
  if (item.expirada || !item.url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
        Arquivo expirado
      </div>
    );
  }
  if (item.tipo === "imagem") return <img src={item.url} alt={item.titulo} className="w-full rounded-lg" />;
  return <video src={item.url} controls playsInline preload="metadata" className="w-full rounded-lg bg-black" />;
}

function Card({ item, token }: { item: ItemFeed; token: string }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [modo, setModo] = useState<null | "confirmar" | "reprovar">(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const podeResponder = item.estado === "pendente" && !item.expirada;

  function enviar(decisao: "aprovado" | "reprovado") {
    setErro(null);
    start(async () => {
      const r = await responderVersao(token, item.versaoId, decisao, decisao === "reprovado" ? motivo : null);
      if (r.erro) return setErro(r.erro);
      setModo(null);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-navy-900">{item.titulo}</h3>
        <div className="flex items-center gap-2">
          {item.estado === "pendente" && item.numero > 1 && (
            <span className="rounded-full bg-copper-100 px-2 py-1 text-xs font-medium text-copper-600">
              Nova versão atualizada
            </span>
          )}
          {item.estado === "aprovado" && (
            <span className="rounded-full bg-ok px-2 py-1 text-xs font-semibold text-white">Aprovado</span>
          )}
          {item.estado === "reprovado" && (
            <span className="rounded-full bg-danger/10 px-2 py-1 text-xs font-medium text-danger">
              Aguardando nova versão
            </span>
          )}
        </div>
      </div>

      <Midia item={item} />

      {item.historico.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {item.historico.map((h) => (
            <li key={h.numero}>
              <span className="font-medium">Versão {h.numero} reprovada:</span> {h.motivo}
            </li>
          ))}
        </ul>
      )}

      {podeResponder && modo !== "reprovar" && (
        <div className="flex gap-2">
          <button
            onClick={() => setModo("confirmar")}
            className="flex-1 rounded-lg bg-ok py-3 text-sm font-semibold text-white"
          >
            Aprovar
          </button>
          <button
            onClick={() => setModo("reprovar")}
            className="flex-1 rounded-lg border border-danger py-3 text-sm font-semibold text-danger"
          >
            Reprovar
          </button>
        </div>
      )}

      {podeResponder && modo === "reprovar" && (
        <div className="space-y-2">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="O que precisa mudar neste conteúdo?"
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => enviar("reprovado")}
              disabled={pendente || motivo.trim().length === 0}
              className="flex-1 rounded-lg bg-danger py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Enviar reprovação
            </button>
            <button
              onClick={() => {
                setModo(null);
                setErro(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-danger">{erro}</p>}

      {modo === "confirmar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-medium text-navy-900">Deseja aprovar este conteúdo?</p>
            <p className="text-sm text-slate-500">{item.titulo}</p>
            <div className="flex gap-2">
              <button
                onClick={() => enviar("aprovado")}
                disabled={pendente}
                className="flex-1 rounded-lg bg-ok py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Sim
              </button>
              <button
                onClick={() => setModo(null)}
                disabled={pendente}
                className="flex-1 rounded-lg border border-slate-300 py-3 text-sm font-semibold text-slate-700"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function FeedCliente({
  token,
  topo,
  aprovados,
}: {
  token: string;
  topo: ItemFeed[];
  aprovados: ItemFeed[];
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Para aprovar</h2>
        {topo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nada pendente por aqui. Tudo em dia!
          </p>
        ) : (
          topo.map((i) => <Card key={i.id} item={i} token={token} />)
        )}
      </section>

      {aprovados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Aprovados</h2>
          {aprovados.map((i) => (
            <Card key={i.id} item={i} token={token} />
          ))}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Página pública**

```tsx
// app/c/[token]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/publico";
import { urlLeitura } from "@/lib/r2";
import { estadoConteudo, separarFeed, versaoAtual, type Conteudo, type Versao } from "@/lib/conteudos";
import FeedCliente, { type ItemFeed } from "@/components/FeedCliente";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conteúdos para aprovação", robots: { index: false, follow: false } };

type VersaoComChave = Versao & { r2_key: string };

export default async function FeedPage({ params }: { params: { token: string } }) {
  const { data } = await createPublicClient().rpc("feed_cliente", { p_token: params.token });
  if (!data) notFound();

  const conteudos = (data.conteudos ?? []) as (Omit<Conteudo, "versoes"> & { versoes: VersaoComChave[] })[];
  const { topo, aprovados } = separarFeed(conteudos as unknown as Conteudo[]);
  const porId = new Map(conteudos.map((c) => [c.id, c]));

  async function paraItem(c: Conteudo): Promise<ItemFeed> {
    const original = porId.get(c.id)!;
    const atual = versaoAtual(original) as VersaoComChave;
    const url = atual && !atual.expirada ? await urlLeitura(atual.r2_key) : null;
    return {
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      estado: estadoConteudo(original),
      versaoId: atual.id,
      numero: atual.numero,
      url,
      expirada: atual.expirada,
      historico: original.versoes
        .filter((v) => v.decisao === "reprovado" && v.motivo)
        .map((v) => ({ numero: v.numero, motivo: v.motivo as string })),
    };
  }

  const [itensTopo, itensAprovados] = await Promise.all([
    Promise.all(topo.map(paraItem)),
    Promise.all(aprovados.map(paraItem)),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-100 p-4 pb-16">
      <header className="py-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Codium · Conteúdos</div>
        <h1 className="text-xl font-semibold text-navy-900">{data.empresa}</h1>
      </header>
      <FeedCliente token={params.token} topo={itensTopo} aprovados={itensAprovados} />
    </main>
  );
}
```

Observação: conteúdos sem versão não existem pelo fluxo (a action cria conteúdo e versão 1 juntos e desfaz se falhar); `versaoAtual` vazio não deve ocorrer.

- [ ] **Step 6: Typecheck e build**

Run: `cd codium-agency && npx tsc --noEmit && npm run build`
Expected: sem erros; rota `/c/[token]` aparece no build.

- [ ] **Step 7: Commit**

```bash
git add codium-agency/middleware.ts codium-agency/lib/supabase/publico.ts codium-agency/actions/feed.ts codium-agency/components/FeedCliente.tsx "codium-agency/app/c"
git commit -m "feat: pagina publica do cliente (feed, aprovar com confirmacao, reprovar com motivo)"
```

---

## Task 6: Verificação ponta a ponta e deploy

**Files:** nenhum arquivo novo; dados de teste são removidos no fim.

**Pré-requisito:** Task 0 concluída (bucket, CORS, lifecycle, chave, variáveis na Vercel e em `.env.local`).

- [ ] **Step 1: Rodar tudo local**

Run: `cd codium-agency && node --test lib/conteudos.test.ts lib/r2.test.ts && npx tsc --noEmit && npm run build`
Expected: todos os testes PASS, sem erros de tipo, build ok.

- [ ] **Step 2: Subir local e testar o upload**

Run: `cd codium-agency && npm run dev` (porta 3000). Logado em `http://localhost:3000/conteudos`, abrir um cliente, enviar um vídeo MP4 pequeno (menos de 20 MB) com título `TESTE`.
Expected: barra de progresso chega a 100%, o conteúdo aparece como "Aguardando aprovação · v1" e o vídeo toca. Se o upload falhar com erro de CORS no console, revisar a Task 0 Step 3.

- [ ] **Step 3: Testar o fluxo do cliente em janela anônima**

Copiar o link do cliente e abrir em janela anônima (sem login).
Expected:
- o card `TESTE` aparece em "Para aprovar" com o vídeo;
- clicar **Reprovar**, enviar com o campo vazio → botão desabilitado; com `trocar a música` → vira "Aguardando nova versão" com o motivo;
- no dashboard, o conteúdo aparece "Reprovado" com o motivo e o bloco **Subir nova versão**; enviar outro MP4;
- no link do cliente: card com "Nova versão atualizada" e o motivo da v1 ao lado;
- clicar **Aprovar** → aparece a caixa "Deseja aprovar este conteúdo?"; **Não** fecha sem aprovar; **Sim** aprova e o card desce para "Aprovados" com a tarja verde.

- [ ] **Step 4: Testar o link regenerado e token inválido**

No dashboard, **Gerar link novo**. Abrir o link antigo e `/c/xxxxxxxxxx`.
Expected: ambos mostram a página 404; o link novo funciona.

- [ ] **Step 5: Testar expiração**

```sql
update public.conteudo_versoes set expira_em = now() - interval '1 day'
where conteudo_id in (select id from public.conteudos where titulo = 'TESTE');
```

Recarregar o link do cliente e a página do dashboard.
Expected: "Arquivo expirado" no lugar do player; status de aprovado preservado; sem botões de responder.

- [ ] **Step 6: Conferir a regra de 30 dias**

```sql
select numero, created_at, expira_em, expira_em - created_at as retencao
from public.conteudo_versoes
where conteudo_id in (select id from public.conteudos where titulo = 'TESTE');
```

Expected: antes do `update` do Step 5, `retencao = 30 days`. No painel do R2, conferir que a regra de lifecycle de 30 dias está ativa no bucket.

- [ ] **Step 7: Limpar dados de teste**

```sql
delete from public.conteudos where titulo = 'TESTE';
```

Apagar os objetos de teste no painel do R2 (ou deixar a regra de 30 dias removê-los).

- [ ] **Step 8: Push e verificar o deploy**

```bash
git push
```

Esperar o deploy de produção ficar READY (agente confere pela Vercel). Repetir os Steps 2–3 no domínio de produção com um novo conteúdo `TESTE`, depois limpar como no Step 7.
Expected: tudo funciona em produção, inclusive CORS do domínio de produção.

- [ ] **Step 9: Registrar conclusão**

Atualizar a spec com um parágrafo "Estado: implementado em <data>" e commitar:

```bash
git add docs
git commit -m "docs: marca conteudos para aprovacao como implementado"
git push
```
