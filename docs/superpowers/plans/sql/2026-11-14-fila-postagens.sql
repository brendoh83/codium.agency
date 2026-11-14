-- Migration "fila_postagens" (codium-agency). Cópia para referência.
-- O segredo do cron NÃO fica aqui: é gravado à parte no Vault (nome: cron_secret) com o mesmo valor de CRON_SECRET na Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- O dashboard não tem a chave mestra do banco: a rota do cron chama estas funções com CRON_SECRET.
create or replace function public.fila_autorizado(p_segredo text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select p_segredo is not null and p_segredo <> ''
     and p_segredo = (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1);
$$;

-- Partes do conteúdo que ainda não estão aprovadas (vazio = pronto para postar).
create or replace function public.conteudo_faltou(p uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when coalesce((select decisao from public.conteudo_versoes where conteudo_id = p order by numero desc limit 1), '') = 'aprovado' then null else 'midia' end,
    case when coalesce((select decisao from public.conteudo_legendas where conteudo_id = p order by numero desc limit 1), '') = 'aprovado' then null else 'legenda' end,
    case when coalesce((select decisao from public.conteudo_datas where conteudo_id = p order by numero desc limit 1), '') = 'aprovado' then null else 'data' end
  ], null);
$$;

-- Garante uma postagem para cada conteúdo com legenda e data; reagenda quando a data muda; destrava posts presos.
create or replace function public.fila_sincronizar(p_segredo text) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; k int;
begin
  if not public.fila_autorizado(p_segredo) then raise exception 'nao autorizado'; end if;

  insert into public.postagens (conteudo_id, cliente_id, estado, agendado_para)
  select c.id, c.cliente_id, 'agendada', d.agendado_para
    from public.conteudos c
    join lateral (select agendado_para from public.conteudo_datas where conteudo_id = c.id order by numero desc limit 1) d on true
   where exists (select 1 from public.conteudo_legendas l where l.conteudo_id = c.id)
  on conflict (conteudo_id) do nothing;
  get diagnostics k = row_count; n := n + k;

  -- data mudou (ou foi cancelada por edição): volta a agendada com a data nova e zera o andamento
  update public.postagens p
     set estado = 'agendada', agendado_para = d.agendado_para, creation_id = null, tentativas = 0,
         erro = null, proxima_tentativa = null, lembretes = 0, ultimo_aviso_em = now()
    from (select distinct on (conteudo_id) conteudo_id, agendado_para from public.conteudo_datas order by conteudo_id, numero desc) d
   where d.conteudo_id = p.conteudo_id
     and p.estado in ('agendada', 'cancelada', 'falhou', 'perdeu_horario')
     and (p.estado = 'cancelada' or p.agendado_para <> d.agendado_para);
  get diagnostics k = row_count; n := n + k;

  -- preso em "postando" há mais de 15 minutos (a execução caiu): tenta de novo
  update public.postagens
     set estado = 'agendada', tentativas = tentativas + 1
   where estado = 'postando' and proxima_tentativa < now() - interval '15 minutes';
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- Postagens que já chegaram na hora, com tudo que o servidor precisa para avisar e postar.
create or replace function public.fila_vencidas(p_segredo text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.fila_autorizado(p_segredo) then raise exception 'nao autorizado'; end if;
  return jsonb_build_object(
    'instancia', coalesce((select valor from public.app_config where chave = 'whatsapp_instancia'), 'codium-agencia'),
    'grupo_equipe_id', (select valor from public.app_config where chave = 'whatsapp_grupo_equipe_id'),
    'itens', coalesce((
      select jsonb_agg(x.item order by x.quando) from (
        select p.agendado_para as quando, jsonb_build_object(
          'postagem', jsonb_build_object('id', p.id, 'estado', p.estado, 'agendado_para', p.agendado_para,
                                         'creation_id', p.creation_id, 'ig_media_id', p.ig_media_id, 'tentativas', p.tentativas),
          'pronto', cardinality(public.conteudo_faltou(c.id)) = 0,
          'faltou', to_jsonb(public.conteudo_faltou(c.id)),
          'clienteId', cl.id,
          'empresa', cl.empresa,
          'titulo', c.titulo,
          'linkToken', cl.link_token,
          'grupoClienteId', cl.whatsapp_grupo_id,
          'conteudo', jsonb_build_object(
            'tipo', c.tipo,
            'legenda', coalesce((select texto from public.conteudo_legendas where conteudo_id = c.id order by numero desc limit 1), ''),
            'chaves', case when c.tipo = 'carrossel'
              then coalesce((select jsonb_agg(a.r2_key order by a.ordem) from public.conteudo_arquivos a
                              where a.versao_id = (select id from public.conteudo_versoes where conteudo_id = c.id order by numero desc limit 1)), '[]'::jsonb)
              else jsonb_build_array((select r2_key from public.conteudo_versoes where conteudo_id = c.id order by numero desc limit 1))
            end),
          'conta', (select jsonb_build_object('igUserId', i.ig_user_id, 'tokenCifrado', i.token_cifrado, 'status', i.status)
                      from public.instagram_contas i where i.cliente_id = cl.id)
        ) as item
        from public.postagens p
        join public.conteudos c on c.id = p.conteudo_id
        join public.clientes cl on cl.id = c.cliente_id
       where p.estado = 'agendada' and p.agendado_para <= now()
       order by p.agendado_para limit 20
      ) x
    ), '[]'::jsonb)
  );
end $$;

-- Troca o estado só se ainda for o esperado: quem perde a corrida recebe false (nunca posta duas vezes).
create or replace function public.fila_reservar(p_segredo text, p_id uuid, p_de text, p_para text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.fila_autorizado(p_segredo) then raise exception 'nao autorizado'; end if;
  if p_para not in ('postando', 'perdeu_horario', 'falhou') then raise exception 'estado invalido'; end if;
  update public.postagens
     set estado = p_para,
         proxima_tentativa = case when p_para = 'postando' then now() else proxima_tentativa end
   where id = p_id and estado = p_de;
  return found;
end $$;

create or replace function public.fila_salvar(p_segredo text, p_id uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.fila_autorizado(p_segredo) then raise exception 'nao autorizado'; end if;
  if p_dados ? 'estado' and (p_dados->>'estado') not in ('agendada', 'postando', 'postada', 'falhou', 'perdeu_horario', 'cancelada') then
    raise exception 'estado invalido';
  end if;
  update public.postagens set
    estado       = case when p_dados ? 'estado'       then p_dados->>'estado'                    else estado end,
    creation_id  = case when p_dados ? 'creation_id'  then p_dados->>'creation_id'               else creation_id end,
    ig_media_id  = case when p_dados ? 'ig_media_id'  then p_dados->>'ig_media_id'               else ig_media_id end,
    permalink    = case when p_dados ? 'permalink'    then p_dados->>'permalink'                 else permalink end,
    tentativas   = case when p_dados ? 'tentativas'   then (p_dados->>'tentativas')::int         else tentativas end,
    erro         = case when p_dados ? 'erro'         then left(p_dados->>'erro', 500)           else erro end,
    postado_em   = case when p_dados ? 'postado_em'   then (p_dados->>'postado_em')::timestamptz else postado_em end
  where id = p_id;
end $$;

create or replace function public.fila_contas(p_segredo text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.fila_autorizado(p_segredo) then raise exception 'nao autorizado'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'token_cifrado', token_cifrado,
                                                        'token_expira_em', token_expira_em, 'status', status))
                     from public.instagram_contas), '[]'::jsonb);
end $$;

create or replace function public.fila_conta_salvar(p_segredo text, p_id uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.fila_autorizado(p_segredo) then raise exception 'nao autorizado'; end if;
  update public.instagram_contas set
    token_cifrado   = case when p_dados ? 'token_cifrado'   then p_dados->>'token_cifrado'                   else token_cifrado end,
    token_expira_em = case when p_dados ? 'token_expira_em' then (p_dados->>'token_expira_em')::timestamptz  else token_expira_em end,
    status          = case when p_dados ? 'status' and (p_dados->>'status') in ('ativa', 'reconectar') then p_dados->>'status' else status end
  where id = p_id;
end $$;

revoke all on function public.fila_autorizado(text) from public, anon, authenticated;
revoke all on function public.conteudo_faltou(uuid) from public, anon, authenticated;
revoke all on function public.fila_sincronizar(text) from public;
revoke all on function public.fila_vencidas(text) from public;
revoke all on function public.fila_reservar(text, uuid, text, text) from public;
revoke all on function public.fila_salvar(text, uuid, jsonb) from public;
revoke all on function public.fila_contas(text) from public;
revoke all on function public.fila_conta_salvar(text, uuid, jsonb) from public;
grant execute on function public.fila_sincronizar(text) to anon, authenticated;
grant execute on function public.fila_vencidas(text) to anon, authenticated;
grant execute on function public.fila_reservar(text, uuid, text, text) to anon, authenticated;
grant execute on function public.fila_salvar(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.fila_contas(text) to anon, authenticated;
grant execute on function public.fila_conta_salvar(text, uuid, jsonb) to anon, authenticated;

-- A tarefa de 1 minuto é criada depois que o segredo existe no Vault (ver 2026-11-14-cron-postagens.sql).
