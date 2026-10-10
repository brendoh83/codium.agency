# Serviços avulsos — design

Data: 2026-10-12. Projeto: dashboard Codium. Parte 2 de 3 do financeiro (depois: despesas recorrentes).
Depende de: `2026-10-11-divisao-e-repasses-design.md`.

## Objetivo
Cadastrar trabalhos pontuais (sem contrato mensal, fora da contagem de clientes ativos), de um cliente existente ou de uma empresa de fora, com pagamento **à vista** ou **parcelado**, cada parcela entrando no caixa e na divisão do **mês da sua própria data**.

## Decisões (do dono)
- Aba **"Serviços avulsos"** no menu (o "catálogo de serviços" de Configurações é outra coisa).
- **À vista:** uma data prevista de recebimento. **Parcelado:** número de parcelas, valor e data de cada uma, tudo visível.
- O mês de cada parcela é o mês da data dela (competência), mesmo que seja paga com atraso.
- Divisão igual à dos clientes: 45% Brendo, 45% Victor, 10% Caixa (50/50 com 10% de cada parte para o caixa).
- Cada parcela tem estado **Recebido / Ainda não**, com a data em que de fato foi paga e a etiqueta "com atraso (N dias)".
- Aviso no dashboard quando uma parcela vence em breve ou atrasa.

## Dados
- `servicos_avulsos(id, cliente_id null → clientes, empresa_externa text null, descricao text, forma text check in ('avista','parcelado'), valor_total numeric, created_at)`; `check (cliente_id is not null or empresa_externa is not null)`.
- `servico_parcelas(id, servico_id → servicos_avulsos on delete cascade, numero int, valor numeric > 0, vencimento date, competencia date (primeiro dia do mês do vencimento), status text check in ('pendente','pago') default 'pendente', data_pagamento date null, created_at)`; único `(servico_id, numero)`.
- `v_divisao_mes` passa a somar as parcelas ao faturamento (50/50 fixo); `v_caixa_mes` herda.
- `v_alertas` ganha `avulso_atrasado` (crítico) e `avulso_proximo` (atenção, até 5 dias).
- RLS: apenas `authenticated`; views com `security_invoker`.

## Regras
- Soma das parcelas = valor total (a última parcela absorve a diferença de centavos).
- Parcelado gera parcelas mensais a partir da primeira data; cada data pode ser ajustada antes de salvar.
- Dia 29, 30 ou 31 em mês mais curto vira o último dia do mês.
- Excluir um serviço apaga as parcelas e recalcula os meses.

## Interface
- `/avulsos`: formulário (cliente ou empresa de fora, descrição, à vista/parcelado, valor total, nº de parcelas e primeira data, com **pré-visualização editável das parcelas**) e lista de serviços; cada serviço mostra suas parcelas com mês, data, valor, estado e ações (marcar recebido com data, desfazer, excluir serviço).
- Dashboard: o **Recebimentos do mês** lista também as parcelas avulsas pagas, com a divisão.

## Fora do escopo
Editar um serviço depois de criado (exclui e recria), juros, notas fiscais, converter cliente em avulso automaticamente.
