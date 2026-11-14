-- Migration "agendamento_instagram" (codium-agency). Cópia para referência.

create table public.conteudo_legendas (
  id uuid primary key default gen_random_uuid(),
  conteudo_id uuid not null references public.conteudos(id) on delete cascade,
  numero int not null check (numero >= 1),
  texto text not null check (length(btrim(texto)) > 0 and length(texto) <= 2200),
  decisao text check (decisao in ('aprovado', 'reprovado')),
  motivo text,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  unique (conteudo_id, numero),
  check ((decisao is null) = (decidido_em is null)),
  check (decisao is distinct from 'reprovado' or length(btrim(coalesce(motivo, ''))) > 0)
);

create table public.conteudo_datas (
  id uuid primary key default gen_random_uuid(),
  conteudo_id uuid not null references public.conteudos(id) on delete cascade,
  numero int not null check (numero >= 1),
  agendado_para timestamptz not null,
  decisao text check (decisao in ('aprovado', 'reprovado')),
  motivo text,
  sugerida_para timestamptz,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  unique (conteudo_id, numero),
  check ((decisao is null) = (decidido_em is null)),
  check (decisao is distinct from 'reprovado' or sugerida_para is not null)
);

create table public.link_aberturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  aberto_em timestamptz not null default now()
);
create index link_aberturas_cliente_idx on public.link_aberturas (cliente_id, aberto_em desc);

create table public.instagram_contas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.clientes(id) on delete cascade,
  ig_user_id text not null,
  username text,
  token_cifrado text not null,
  token_expira_em timestamptz not null,
  autodm_workspace_id text,
  status text not null default 'ativa' check (status in ('ativa', 'reconectar')),
  created_at timestamptz not null default now()
);

create table public.postagens (
  id uuid primary key default gen_random_uuid(),
  conteudo_id uuid not null unique references public.conteudos(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estado text not null default 'agendada'
    check (estado in ('agendada', 'postando', 'postada', 'falhou', 'perdeu_horario', 'cancelada')),
  agendado_para timestamptz not null,
  creation_id text,
  ig_media_id text,
  permalink text,
  tentativas int not null default 0,
  proxima_tentativa timestamptz,
  erro text,
  postado_em timestamptz,
  lembretes int not null default 0,
  ultimo_aviso_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index postagens_fila_idx on public.postagens (estado, agendado_para);

do $$
declare t text;
begin
  foreach t in array array['conteudo_legendas','conteudo_datas','link_aberturas','instagram_contas','postagens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'auth_all_' || t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Nova versão de mídia, legenda ou data cancela a postagem ainda agendada.
create or replace function public.cancelar_postagem_agendada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.postagens set estado = 'cancelada'
   where conteudo_id = new.conteudo_id and estado = 'agendada';
  return new;
end $$;
create trigger cancela_ao_nova_versao after insert on public.conteudo_versoes
  for each row execute function public.cancelar_postagem_agendada();
create trigger cancela_ao_nova_legenda after insert on public.conteudo_legendas
  for each row execute function public.cancelar_postagem_agendada();
create trigger cancela_ao_nova_data after insert on public.conteudo_datas
  for each row execute function public.cancelar_postagem_agendada();

create or replace function public.registrar_abertura(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.clientes where link_token = p_token;
  if v_id is null then return; end if;
  if exists (select 1 from public.link_aberturas
              where cliente_id = v_id and aberto_em > now() - interval '5 minutes') then return; end if;
  insert into public.link_aberturas (cliente_id) values (v_id);
end $$;

create or replace function public.responder_parte(
  p_token text, p_conteudo_id uuid, p_parte text, p_decisao text,
  p_motivo text default null, p_sugerida_para timestamptz default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid; v_ver uuid; r record;
begin
  select cl.id into v_cliente
    from public.conteudos c join public.clientes cl on cl.id = c.cliente_id
   where c.id = p_conteudo_id and cl.link_token = p_token;
  if v_cliente is null then raise exception 'conteudo nao encontrado'; end if;
  if p_decisao is null or p_decisao not in ('aprovado', 'reprovado') then
    raise exception 'decisao invalida';
  end if;

  if p_parte = 'midia' then
    select id into v_ver from public.conteudo_versoes
     where conteudo_id = p_conteudo_id order by numero desc limit 1;
    if v_ver is null then raise exception 'versao nao encontrada'; end if;
    perform public.responder_versao(p_token, v_ver, p_decisao, p_motivo);

  elsif p_parte = 'legenda' then
    if p_decisao = 'reprovado' and length(btrim(coalesce(p_motivo, ''))) = 0 then
      raise exception 'motivo obrigatorio';
    end if;
    select id, decisao into r from public.conteudo_legendas
     where conteudo_id = p_conteudo_id order by numero desc limit 1;
    if r.id is null then raise exception 'legenda nao encontrada'; end if;
    if r.decisao is not null then raise exception 'ja respondida'; end if;
    update public.conteudo_legendas
       set decisao = p_decisao, decidido_em = now(),
           motivo = case when p_decisao = 'reprovado' then left(btrim(p_motivo), 2000) else null end
     where id = r.id and decisao is null;
    if not found then raise exception 'ja respondida'; end if;

  elsif p_parte = 'data' then
    if p_decisao = 'reprovado' and p_sugerida_para is null then
      raise exception 'data sugerida obrigatoria';
    end if;
    select id, decisao into r from public.conteudo_datas
     where conteudo_id = p_conteudo_id order by numero desc limit 1;
    if r.id is null then raise exception 'data nao encontrada'; end if;
    if r.decisao is not null then raise exception 'ja respondida'; end if;
    update public.conteudo_datas
       set decisao = p_decisao, decidido_em = now(),
           motivo = case when p_decisao = 'reprovado' then nullif(left(btrim(coalesce(p_motivo, '')), 2000), '') else null end,
           sugerida_para = case when p_decisao = 'reprovado' then p_sugerida_para else null end
     where id = r.id and decisao is null;
    if not found then raise exception 'ja respondida'; end if;

  else
    raise exception 'parte invalida';
  end if;
end $$;

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
            'created_at', v.created_at, 'expirada', v.expira_em < now(), 'expira_em', v.expira_em,
            'previa_ok', v.previa_ok,
            'decisao', v.decisao, 'motivo', v.motivo, 'decidido_em', v.decidido_em,
            'arquivos', coalesce((
              select jsonb_agg(jsonb_build_object('r2_key', a.r2_key, 'mime', a.mime, 'ordem', a.ordem) order by a.ordem)
              from public.conteudo_arquivos a where a.versao_id = v.id
            ), '[]'::jsonb)
          ) order by v.numero)
          from public.conteudo_versoes v where v.conteudo_id = c.id
        ), '[]'::jsonb),
        'legendas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'numero', l.numero, 'texto', l.texto, 'decisao', l.decisao,
            'motivo', l.motivo, 'decidido_em', l.decidido_em
          ) order by l.numero)
          from public.conteudo_legendas l where l.conteudo_id = c.id
        ), '[]'::jsonb),
        'datas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'numero', d.numero, 'agendado_para', d.agendado_para, 'decisao', d.decisao,
            'motivo', d.motivo, 'sugerida_para', d.sugerida_para, 'decidido_em', d.decidido_em
          ) order by d.numero)
          from public.conteudo_datas d where d.conteudo_id = c.id
        ), '[]'::jsonb)
      ) order by c.created_at desc)
      from public.conteudos c where c.cliente_id = v_cliente.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.responder_parte(text, uuid, text, text, text, timestamptz) from public;
revoke all on function public.registrar_abertura(text) from public;
revoke all on function public.cancelar_postagem_agendada() from public, anon, authenticated;
grant execute on function public.responder_parte(text, uuid, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.registrar_abertura(text) to anon, authenticated;
