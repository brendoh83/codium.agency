# Divisão do mês, repasses e caixa acumulado — Implementation Plan

> **For agentic workers:** execute task-by-task (superpowers:executing-plans), TDD, commit por tarefa.

**Goal:** Dashboard mostra Devido/Entrou/Falta de Brendo, Victor e Caixa sobre o faturamento total do mês; registra repasses aos sócios; mostra extrato do caixa acumulado e avisos de diferença.

**Architecture:** Regras de conta no banco (views `v_divisao_mes` e `v_caixa_mes`, com `security_invoker`), tabela `repasses`. Next.js lê as views; formatação e textos de aviso em funções puras testadas. Fechar o mês grava o retrato.

**Tech Stack:** Next.js 14.2.15 (Server Actions), TypeScript 5.5.4, Supabase, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-11-divisao-e-repasses-design.md`

## Global Constraints
- 50/50 entre sócios, 10% de cada parte para o caixa; pct vem do pagamento (`pct_*_aplicado`) ou do cliente.
- Arredondar a centavos **no total do mês**; `devido_caixa = faturamento − devido_brendo − devido_victor`.
- Receber acima da própria parte é aceito e sai do caixa; repasses > faturamento geram aviso, nunca bloqueio.
- Meses já fechados não mudam (campos novos ficam nulos).
- Views novas: `security_invoker = true`, sem acesso para `anon`.
- Código e textos em português; comandos `git` na raiz `codium.agency/`, `npm/node` em `codium-agency/`.

## Tasks
1. **Banco:** tabela `repasses`; colunas novas em `fechamentos_mensais`; views `v_divisao_mes` e `v_caixa_mes`; teste SQL com dados de 2040 que desfaz tudo.
2. **Lógica pura:** `lib/divisao.ts` (`avisoExcedente`, `avisoMovimentacao`, `rotuloSocio`) + testes.
3. **Ações:** `actions/repasses.ts` (`registrarRepasse`, `excluirRepasse`); `fecharMes` grava devido/repassado/saldo final.
4. **Telas:** cartões do resumo (Devido/Entrou/Falta), seção Repasses, extrato do caixa, recebimentos por pagamento; Histórico mostra os campos novos.
5. **Verificação e deploy:** typecheck, testes, build, teste com dados reais (mês de teste), limpeza e push.
