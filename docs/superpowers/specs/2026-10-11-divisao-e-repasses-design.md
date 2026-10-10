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
- **Excedente de um sócio**: `excesso_x = max(0, repassado_x − devido_x)`. Receber a mais que a própria parte é **aceito** (provavelmente foi usado em algo da empresa) e é **descontado do caixa**: `caixa_apos_retiradas = devido_caixa − excesso_brendo − excesso_victor`.
- **Diferença de movimentação**: se `caixa_apos_retiradas < 0`, os repasses somam mais que o faturamento do mês: `diferenca = repassado_brendo + repassado_victor − faturamento`. Isso indica um serviço ou entrada que ficou de fora do cadastro e gera aviso (ver Interface).
- **O caixa acumula de um mês para o outro** (decisão do dono). Para cada mês:
  `saldo_inicial(M) = saldo_final(M−1)` (zero no primeiro mês com movimento),
  `entradas(M) = entrou_caixa(M)`,
  `saidas(M) = despesas(M) + excessos dos sócios(M)`,
  `saldo_final(M) = saldo_inicial(M) + entradas(M) − saidas(M)`.
  Ex.: sobraram R$ 300 em outubro → novembro começa com R$ 300.
- Até a parte 3, `despesas(M)` são as despesas cadastradas no mês (comportamento de hoje). Na parte 3 passam a ser só as **pagas**.

## Dados (Supabase)
- Nova view `v_caixa_mes(mes, saldo_inicial, entradas, saidas_despesas, saidas_retiradas, saldo_final)` (saldo acumulado entre meses, calculado por soma acumulada ordenada por mês).
- Nova view `v_divisao_mes(mes, faturamento, devido_brendo, devido_victor, devido_caixa, entrou_brendo, entrou_victor, entrou_caixa, falta_brendo, falta_victor, falta_caixa, repassado_brendo, repassado_victor)`.
- Nova tabela `repasses(id uuid pk, socio text check in ('brendo','victor'), mes_referencia date, valor numeric > 0, data date not null default current_date, observacao text, created_at)`. RLS: só `authenticated`.
- `fechamentos_mensais` ganha: `devido_brendo`, `devido_victor`, `devido_caixa`, `repassado_brendo`, `repassado_victor`, `caixa_saldo_final` (nullable, preenchidos ao fechar o mês; meses já fechados ficam sem esses campos).
- `v_financeiro_mes` e os campos `liquido_*`/`caixa_total` por pagamento **não mudam** (compatibilidade com Histórico e telas atuais).

## Interface
- **Dashboard → "Resumo financeiro — {mês}"**: os cartões do Brendo, do Victor e do Caixa passam a mostrar o **devido sobre o total do mês**, com a linha de apoio "Entrou R$ X · Falta R$ Y". O seletor de mês existente vale para esses números.
- **Nova seção "Repasses aos sócios — {mês}"** (abaixo do resumo): por sócio, `Devido`, `Repassado`, `A repassar`, com botão **Registrar repasse** (valor, data, observação, mês de referência) e a lista de repasses do mês com opção de excluir. Mostra também o **Caixa do mês após retiradas** (devido do caixa menos os excedentes) e os avisos descritos em "Casos de borda".
- **Nova seção "Caixa — {mês}" (extrato)**: mostra **para onde o caixa foi**: Saldo anterior; (+) Entrou no mês; (−) cada despesa do mês, listada por descrição e categoria (ex.: Gasolina R$ 120, Internet R$ 70); (−) Retiradas dos sócios acima da parte deles; (=) **Saldo final**, que vira o saldo anterior do mês seguinte.
- **Nova seção "Recebimentos do mês — divisão por pagamento"**: uma linha por pagamento pago do mês (cliente, valor, pago em, Brendo, Victor, Caixa), com total no rodapé.
- **Histórico**: cada mês fechado mostra também devido e repassado (quando houver).

## Casos de borda
- Mês sem pagamentos: tudo zero, sem erro.
- Repasse maior que o devido de um sócio: **aceito**. A tela mostra uma nota informativa (não é erro): "Brendo recebeu R$ 500 além da parte dele; esse valor saiu do caixa de {mês}". O "A repassar" do sócio fica em R$ 0 e o excedente aparece como retirada do caixa.
- Repasses somando mais que o faturamento do mês: **aviso de atenção** (cor de alerta) no resumo e na seção de repasses: "Movimentação maior que o faturamento: os repasses somam R$ 21.000, mas {mês} faturou R$ 20.000 (diferença de R$ 1.000). Algum serviço ou pagamento ficou de fora do cadastro?". Mesmo assim o repasse é gravado; o aviso some quando a diferença for resolvida (cadastrando o que faltava).
- Mudar `pct_*` de um cliente depois de pagar não altera pagamentos já pagos (usa o aplicado).
- Fechar o mês grava o retrato da divisão; reabrir e fechar de novo recalcula.
- Pagamento de um mês fechado, lançado depois: o retrato fica desatualizado até fechar de novo (já é o comportamento do fechamento).

## Fora do escopo
Serviços avulsos, despesas recorrentes, extrato bancário, repasse ao caixa, impostos.

## Ligação com despesas (requisitos da parte 3, já definidos pelo dono)
Registrados aqui para a parte de despesas recorrentes não perder o fio; **não fazem parte da construção da parte 1**.
- **Despesa paga sai do caixa.** O caixa disponível desconta somente despesas marcadas como **pagas** (botão "Paga" com data). Ex.: caixa de R$ 1.570, conta fixa de R$ 70 paga → R$ 1.500 disponíveis.
- **Despesa fixa** aparece todo mês até ser alterada ou excluída; **variável** vale só pelo período definido (um mês, dois, três…), com valor **por mês**. Alterar o valor de uma fixa vale **daqui para frente**.
- **Vencimento:** o dia (ex.: todo dia 15) gera aviso no dashboard ("Internet vence hoje") enquanto não paga; marcada como paga, o aviso some. A despesa também aparece na tela Financeiro.
- **Quando a despesa paga é maior que o caixa disponível:** o sistema avisa ("a despesa é R$ 1.600 e há R$ 1.500 no caixa; a diferença de R$ 100 sairá de quem?") e pede **quem cobre a diferença**: um sócio, os dois em partes iguais, ou valores/porcentagens diferentes. Isso fica **gravado** junto da despesa ("coberto: 100% Victor", "R$ 10 Brendo + R$ 90 Victor") e reduz o "a repassar" de cada sócio no mês.
- Simetria com a parte 1: sócio que recebe **a mais** que a própria parte tira do caixa; caixa que **falta** tira dos sócios.
