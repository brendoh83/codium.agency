# Divisão do mês pelo total e repasses aos sócios — design

Data: 2026-10-11. Projeto: dashboard Codium (`codium-agency/`, Next.js 14, Supabase `ssroxcrywymmusresjsn`).
Parte 1 de 3 do financeiro. Depois: serviços avulsos; despesas recorrentes.

## Objetivo
1. O **Total do Brendo, do Victor e do Caixa** de cada mês passa a ser calculado sobre o **faturamento total do mês** (todos os clientes), e não conforme cada cliente paga.
2. Para cada mês, mostrar **o que já entrou** (clientes que pagaram) e **o que falta** de cada um (Brendo, Victor, Caixa), inclusive em meses passados.
3. Ter uma **segunda seção**, por pagamento: "cliente X pagou R$ 1.200 → R$ 540 / R$ 540 / R$ 120".
4. Registrar o que **de fato foi repassado** a cada sócio (o que entrou na conta), para controlar "tem R$ 10 mil, recebeu R$ 2 mil, faltam R$ 8 mil".

## Decisões (confirmadas com o dono)
- Divisão é sempre **50/50** entre os sócios, com **10% de cada parte para o caixa**. Para cada R$ 100 faturados: Brendo R$ 45, Victor R$ 45, Caixa R$ 10.
- Serviços avulsos (parte 2) seguem a mesma divisão e entram no faturamento do mês do recebimento.
- Pagamento pertence ao mês da **competência**, mesmo que seja pago no mês seguinte (já é assim hoje).
- Ordem das partes: esta primeiro; depois avulsos; depois despesas recorrentes.

## Definições (por mês de competência M)
- `faturamento` = soma de `pagamentos.valor` com `competencia = M`.
- `devido_brendo` = `faturamento × pct_brendo × 0,9`, `devido_victor` = `faturamento × pct_victor × 0,9` (com `pct` de cada pagamento: o aplicado quando já pago, senão o do cliente), arredondado a centavos **no total do mês**.
- `devido_caixa` = `faturamento − devido_brendo − devido_victor` (garante que a soma bate com o faturamento).
- `entrou_*`: mesma conta, só sobre pagamentos com `status = 'pago'`.
- `falta_* = devido_* − entrou_*`.
- `repassado_brendo` / `repassado_victor` = soma de `repasses.valor` com `mes_referencia = M`.
- `a_repassar_* = devido_* − repassado_*` (o que ainda falta chegar à conta do sócio) e `disponivel_* = entrou_* − repassado_*` (o que já entrou e ainda não foi repassado).
- O **saldo do caixa** continua `entrou_caixa − despesas do mês`.

## Dados (Supabase)
- Nova view `v_divisao_mes(mes, faturamento, devido_brendo, devido_victor, devido_caixa, entrou_brendo, entrou_victor, entrou_caixa, falta_brendo, falta_victor, falta_caixa, repassado_brendo, repassado_victor)`.
- Nova tabela `repasses(id uuid pk, socio text check in ('brendo','victor'), mes_referencia date, valor numeric > 0, data date not null default current_date, observacao text, created_at)`. RLS: só `authenticated`.
- `fechamentos_mensais` ganha: `devido_brendo`, `devido_victor`, `devido_caixa`, `repassado_brendo`, `repassado_victor` (nullable, preenchidos ao fechar o mês; meses já fechados ficam sem esses campos).
- `v_financeiro_mes` e os campos `liquido_*`/`caixa_total` por pagamento **não mudam** (compatibilidade com Histórico e telas atuais).

## Interface
- **Dashboard → "Resumo financeiro — {mês}"**: os cartões do Brendo, do Victor e do Caixa passam a mostrar o **devido sobre o total do mês**, com a linha de apoio "Entrou R$ X · Falta R$ Y". O seletor de mês existente vale para esses números.
- **Nova seção "Repasses aos sócios — {mês}"** (abaixo do resumo): por sócio, `Devido`, `Repassado`, `A repassar`, com botão **Registrar repasse** (valor, data, observação, mês de referência) e a lista de repasses do mês com opção de excluir.
- **Nova seção "Recebimentos do mês — divisão por pagamento"**: uma linha por pagamento pago do mês (cliente, valor, pago em, Brendo, Victor, Caixa), com total no rodapé.
- **Histórico**: cada mês fechado mostra também devido e repassado (quando houver).

## Casos de borda
- Mês sem pagamentos: tudo zero, sem erro.
- Repasse maior que o devido: aceito, mostrando "A repassar" negativo (adiantamento), com aviso discreto.
- Mudar `pct_*` de um cliente depois de pagar não altera pagamentos já pagos (usa o aplicado).
- Fechar o mês grava o retrato da divisão; reabrir e fechar de novo recalcula.
- Pagamento de um mês fechado, lançado depois: o retrato fica desatualizado até fechar de novo (já é o comportamento do fechamento).

## Fora do escopo
Serviços avulsos, despesas recorrentes, extrato bancário, repasse ao caixa, impostos.
