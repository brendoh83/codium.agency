-- Rodar via execute_sql DEPOIS da migração. Termina em erro 'TESTES OK' (nada fica gravado).
do $$
declare
  v_cli uuid; v_tok text; v_c uuid; v_ver uuid; v_n int; v_feed jsonb; v_post uuid;
begin
  insert into public.clientes (empresa) values ('ZZ teste agendamento') returning id, link_token into v_cli, v_tok;
  insert into public.conteudos (cliente_id, titulo, tipo) values (v_cli, 'T', 'imagem') returning id into v_c;
  insert into public.conteudo_versoes (conteudo_id, numero, r2_key, mime, tamanho) values (v_c, 1, 'k', 'image/png', 1) returning id into v_ver;
  insert into public.conteudo_legendas (conteudo_id, numero, texto) values (v_c, 1, 'legenda 1');
  insert into public.conteudo_datas (conteudo_id, numero, agendado_para) values (v_c, 1, now() + interval '2 days');

  -- (a) token errado
  begin perform public.responder_parte('xxx', v_c, 'legenda', 'aprovado'); raise exception 'devia falhar a';
  exception when others then if sqlerrm = 'devia falhar a' then raise; end if; end;
  -- (b) reprovar legenda sem motivo
  begin perform public.responder_parte(v_tok, v_c, 'legenda', 'reprovado'); raise exception 'devia falhar b';
  exception when others then if sqlerrm = 'devia falhar b' then raise; end if; if sqlerrm <> 'motivo obrigatorio' then raise exception 'b: %', sqlerrm; end if; end;
  -- (c) reprovar data sem sugestao
  begin perform public.responder_parte(v_tok, v_c, 'data', 'reprovado', 'x'); raise exception 'devia falhar c';
  exception when others then if sqlerrm = 'devia falhar c' then raise; end if; if sqlerrm <> 'data sugerida obrigatoria' then raise exception 'c: %', sqlerrm; end if; end;
  -- (d) aprovar legenda mantem midia pendente
  perform public.responder_parte(v_tok, v_c, 'legenda', 'aprovado');
  if (select decisao from public.conteudo_versoes where id = v_ver) is not null then raise exception 'd: midia mudou'; end if;
  -- (e) ja respondida
  begin perform public.responder_parte(v_tok, v_c, 'legenda', 'aprovado'); raise exception 'devia falhar e';
  exception when others then if sqlerrm = 'devia falhar e' then raise; end if; if sqlerrm <> 'ja respondida' then raise exception 'e: %', sqlerrm; end if; end;
  -- (f) midia grava na ultima versao
  insert into public.conteudo_versoes (conteudo_id, numero, r2_key, mime, tamanho) values (v_c, 2, 'k2', 'image/png', 1);
  perform public.responder_parte(v_tok, v_c, 'midia', 'aprovado');
  if (select decisao from public.conteudo_versoes where conteudo_id = v_c and numero = 2) <> 'aprovado' then raise exception 'f'; end if;
  if (select decisao from public.conteudo_versoes where conteudo_id = v_c and numero = 1) is not null then raise exception 'f: versao 1 mudou'; end if;
  -- data: sugerir outra
  perform public.responder_parte(v_tok, v_c, 'data', 'reprovado', 'quarta', now() + interval '5 days');
  if (select sugerida_para from public.conteudo_datas where conteudo_id = v_c and numero = 1) is null then raise exception 'data sugerida nao gravada'; end if;
  -- (g) feed ordenado
  insert into public.conteudo_legendas (conteudo_id, numero, texto) values (v_c, 2, 'legenda 2');
  v_feed := public.feed_cliente(v_tok);
  if jsonb_array_length(v_feed->'conteudos'->0->'legendas') <> 2 or (v_feed->'conteudos'->0->'legendas'->1->>'numero') <> '2' then raise exception 'g legendas'; end if;
  if jsonb_array_length(v_feed->'conteudos'->0->'datas') <> 1 then raise exception 'g datas'; end if;
  -- cancelamento por edicao (trigger)
  insert into public.postagens (conteudo_id, cliente_id, agendado_para) values (v_c, v_cli, now() + interval '1 day') returning id into v_post;
  insert into public.conteudo_legendas (conteudo_id, numero, texto) values (v_c, 3, 'legenda 3');
  if (select estado from public.postagens where id = v_post) <> 'cancelada' then raise exception 'cancelamento legenda'; end if;
  update public.postagens set estado = 'agendada' where id = v_post;
  insert into public.conteudo_datas (conteudo_id, numero, agendado_para) values (v_c, 2, now() + interval '3 days');
  if (select estado from public.postagens where id = v_post) <> 'cancelada' then raise exception 'cancelamento data'; end if;
  -- postada nao e cancelada
  update public.postagens set estado = 'postada' where id = v_post;
  insert into public.conteudo_versoes (conteudo_id, numero, r2_key, mime, tamanho) values (v_c, 3, 'k3', 'image/png', 1);
  if (select estado from public.postagens where id = v_post) <> 'postada' then raise exception 'postada cancelada'; end if;
  -- abertura: limite de 5 min
  perform public.registrar_abertura(v_tok); perform public.registrar_abertura(v_tok); perform public.registrar_abertura('xxx');
  select count(*) into v_n from public.link_aberturas where cliente_id = v_cli;
  if v_n <> 1 then raise exception 'aberturas: %', v_n; end if;

  raise exception 'TESTES OK';
end $$;
