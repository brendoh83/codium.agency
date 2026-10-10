# Despesas recorrentes, "paga" e cobertura pelos sócios — design

Data: 2026-10-13. Parte 3 de 3 do financeiro. Complementa `2026-10-11-divisao-e-repasses-design.md` (seção "Ligação com despesas").

## Decisões (do dono)
- **Fixa**: aparece todo mês até ser alterada ou excluída. **Variável**: vale só por um período definido, com valor **por mês**.
- Alterar o valor de uma fixa vale **daqui para frente** (meses passados e já pagos não mudam).
- Cada despesa tem **dia de vencimento**; sem pagar, gera aviso no dashboard e aparece na tela Financeiro.
- **Botão "Paga"** (com a data): só despesa paga **sai do caixa**.
- Se a despesa paga for maior que o caixa disponível, o sistema pede **quem cobre a diferença** (um sócio, os dois, valores diferentes) e **grava** isso; reduz o "a repassar" de cada um.
- O caixa acumula entre os meses (já implementado).

## Modelo
- `despesa_modelos(id, descricao, categoria, tipo fixa|variavel, valor, dia_vencimento 1..31, mes_inicio, meses null|>=1, created_at)`. Fixa: `meses = null`. Variável: `meses >= 1`.
- `despesas` (já existe, uma linha por mês) ganha `modelo_id`, `vencimento`, `pago`, `data_pagamento`. Linhas antigas viram `pago = true` com `data_pagamento = data` (preserva os números atuais).
- As ocorrências mensais são **geradas** a partir do modelo para os próximos meses (como já é feito com os pagamentos dos clientes). Único por `(modelo_id, mes_referencia)`.
- `despesa_coberturas(id, despesa_id, socio, valor)`: quanto de uma despesa paga cada sócio cobriu.
- `v_caixa_mes`: `saidas_despesas = soma das despesas PAGAS − coberturas`.
- `v_divisao_mes`: ganha `cobertura_brendo/victor`; o excedente do sócio passa a ser `max(0, repassado − (devido − cobertura))`.
- `v_alertas`: `despesa_atrasada` (crítico) e `despesa_proxima` (atenção, até 5 dias).

## Regras
- Vencimento: dia do mês; dia 29–31 em mês curto vira o último dia.
- Alterar fixa "daqui para frente": atualiza o modelo e as ocorrências **não pagas** do mês atual em diante.
- Excluir fixa: apaga o modelo e as ocorrências não pagas do mês atual em diante; as pagas e as passadas ficam.
- Cobertura: `falta = valor − max(0, caixa disponível)`; a soma das coberturas informadas precisa ser igual a `falta`.
- Caixa disponível ao pagar = `saldo_final` do mês da despesa antes desse pagamento.

## Interface
- `/despesas`: navegação por mês; lista com estado (A pagar, Atrasada, Paga), vencimento e botão **Marcar paga** (data). Se faltar caixa, abre a pergunta de **quem cobre** com valores prontos (meio a meio) editáveis. Formulário: descrição, valor, categoria, tipo, dia de vencimento, mês de início e, na variável, quantos meses.
- Menu de cada fixa: **Alterar valor daqui para frente** e **Excluir daqui para frente**.
- Extrato do caixa lista as pagas como saída e as não pagas como "a pagar" (sem descontar).
- Financeiro mostra as despesas do mês e o estado.

## Fora do escopo
Anexar comprovante, despesas parceladas com juros, conciliação bancária.
