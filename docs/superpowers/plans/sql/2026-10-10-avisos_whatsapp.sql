-- Migration aplicada no Supabase codium-agency como "avisos_whatsapp".
-- Cópia para referência; a fonte da verdade é o histórico de migrations do projeto.

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

-- Migration 2 ("avisos_whatsapp_log_seguro"): corrige achado da revisão final.
-- registrar_aviso agora só aceita uma versão do cliente decidida nos últimos 10 min,
-- grava no máximo 1 linha por versão e poda só avisos de decisão.
alter table public.avisos_whatsapp add column versao_id uuid;
create unique index avisos_whatsapp_decisao_versao_key
  on public.avisos_whatsapp (versao_id) where tipo = 'decisao';

drop function public.registrar_aviso(text, text, text, text, boolean, text);

create or replace function public.registrar_aviso(
  p_token text, p_versao_id uuid, p_destino text, p_texto text, p_ok boolean, p_erro text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  select cl.id into v_cliente
    from public.conteudo_versoes ver
    join public.conteudos c on c.id = ver.conteudo_id
    join public.clientes cl on cl.id = c.cliente_id
   where ver.id = p_versao_id
     and cl.link_token = p_token
     and ver.decidido_em is not null
     and ver.decidido_em > now() - interval '10 minutes';
  if not found then raise exception 'versao nao decidida'; end if;

  insert into public.avisos_whatsapp (tipo, cliente_id, versao_id, destino, texto, ok, erro)
  values ('decisao', v_cliente, p_versao_id, left(p_destino, 100), left(p_texto, 1000), p_ok, left(p_erro, 500))
  on conflict (versao_id) where tipo = 'decisao' do nothing;

  delete from public.avisos_whatsapp
   where tipo = 'decisao'
     and id not in (
       select id from public.avisos_whatsapp where tipo = 'decisao' order by created_at desc limit 200
     );
end $$;

revoke all on function public.registrar_aviso(text, uuid, text, text, boolean, text) from public;
grant execute on function public.registrar_aviso(text, uuid, text, text, boolean, text) to anon, authenticated;
