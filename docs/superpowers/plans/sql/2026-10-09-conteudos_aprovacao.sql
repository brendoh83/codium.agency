-- Migration aplicada no Supabase codium-agency como "conteudos_aprovacao" (2026-10-10).
-- Cópia para referência; a fonte da verdade é o histórico de migrations do projeto.

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
