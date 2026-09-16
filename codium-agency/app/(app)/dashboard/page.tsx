import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { garantirPagamentosFuturos } from "@/actions/pagamentos";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { formatBRL, formatDate, monthLabel, firstDayOfMonth, shiftMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { mes?: string; status?: string; servico?: string };
}) {
  await garantirPagamentosFuturos(3);
  const supabase = createClient();

  const mes = searchParams.mes ?? firstDayOfMonth();
  const mesAnterior = shiftMonth(mes, -1);
  const mesSeguinte = shiftMonth(mes, 1);
  const proximoMes = shiftMonth(firstDayOfMonth(), 1);

  const [
    { data: metricas },
    { data: pagamentosMes },
    { data: pagamentosProx },
    { data: alertas },
    { data: financeiroMes },
    { data: divisaoClientes },
  ] = await Promise.all([
    supabase.from("v_metricas_gerais").select("*").single(),
    supabase
      .from("v_pagamentos")
      .select("*, clientes(empresa, status)")
      .eq("competencia", mes)
      .order("vencimento"),
    supabase.from("v_pagamentos").select("valor").eq("competencia", proximoMes),
    supabase.from("v_alertas").select("*").order("nivel"),
    supabase.from("v_financeiro_mes").select("*").eq("mes", mes).maybeSingle(),
    supabase.from("v_divisao_clientes").select("*").order("empresa"),
  ]);

  let lista = (pagamentosMes ?? []) as any[];
  if (searchParams.status) lista = lista.filter((p) => p.clientes?.status === searchParams.status);

  const recebido = lista.filter((p) => p.status_efetivo === "pago").reduce((s, p) => s + p.valor, 0);
  const pendente = lista
    .filter((p) => p.status_efetivo === "pendente")
    .reduce((s, p) => s + p.valor, 0);
  const atrasado = lista
    .filter((p) => p.status_efetivo === "atrasado")
    .reduce((s, p) => s + p.valor, 0);
  const previsto = lista.reduce((s, p) => s + p.valor, 0);
  const previsaoProximo = (pagamentosProx ?? []).reduce((s, p: any) => s + p.valor, 0);

  const alertasCriticos = (alertas ?? []).filter((a: any) => a.nivel === "critico").length;
  const alertasAtencao = (alertas ?? []).filter((a: any) => a.nivel === "atencao").length;

  const fm = financeiroMes as any;
  const totalBrendo = fm?.total_brendo ?? 0;
  const totalVictor = fm?.total_victor ?? 0;
  const totalCaixaMes = fm?.total_caixa ?? 0;
  const despesasFixas = fm?.despesas_fixas ?? 0;
  const despesasVariaveis = fm?.despesas_variaveis ?? 0;
  const despesasTotais = fm?.despesas_totais ?? 0;
  const saldoCaixa = fm?.saldo_caixa ?? 0;
  const distribuicao = (divisaoClientes ?? []) as any[];

  const dotStyle: Record<string, string> = {
    pago: "bg-ok",
    pendente: "bg-warn",
    atrasado: "bg-danger",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Visão geral da agência</p>
        </div>
        <Link
          href="/clientes/novo"
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950"
        >
          + Novo Cliente
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Faturamento recorrente (MRR)" value={formatBRL(metricas?.mrr)} />
        <StatCard label="Previsto no mês" value={formatBRL(previsto)} />
        <StatCard label="Já recebido" value={formatBRL(recebido)} tone="ok" />
        <StatCard label="Pendente" value={formatBRL(pendente)} tone="warn" />
        <StatCard label="Atrasado" value={formatBRL(atrasado)} tone={atrasado > 0 ? "danger" : "default"} />
        <StatCard label={`Previsão de ${monthLabel(proximoMes)}`} value={formatBRL(previsaoProximo)} />
        <StatCard label="Clientes ativos" value={String(metricas?.clientes_ativos ?? 0)} />
        <StatCard label="Ticket médio" value={formatBRL(metricas?.ticket_medio)} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy-900">
          Resumo financeiro — {monthLabel(mes)}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total do Brendo" value={formatBRL(totalBrendo)} />
          <StatCard label="Total do Victor" value={formatBRL(totalVictor)} />
          <StatCard label="Total destinado ao caixa" value={formatBRL(totalCaixaMes)} tone="ok" />
          <StatCard
            label="Saldo disponível no caixa"
            value={formatBRL(saldoCaixa)}
            tone={saldoCaixa >= 0 ? "ok" : "danger"}
            sub="Caixa do mês menos despesas"
          />
          <StatCard label="Despesas fixas" value={formatBRL(despesasFixas)} tone="warn" />
          <StatCard label="Despesas variáveis" value={formatBRL(despesasVariaveis)} tone="warn" />
          <StatCard label="Total de despesas" value={formatBRL(despesasTotais)} tone="danger" />
          <StatCard
            label="Previsto a receber"
            value={formatBRL(pendente + atrasado)}
            sub="Pendente + atrasado no mês"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-sm font-semibold text-navy-900">Distribuição por cliente</h2>
            <p className="text-xs text-slate-400">Divisão de ganhos configurada em cada cliente</p>
          </div>
          <Link href="/historico" className="text-xs font-medium text-copper-600 hover:underline">
            Ver histórico mensal
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Valor mensal</th>
                <th className="px-4 py-3">% Brendo / Victor</th>
                <th className="px-4 py-3">Líquido Brendo</th>
                <th className="px-4 py-3">Líquido Victor</th>
                <th className="px-4 py-3">Caixa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {distribuicao.map((c) => (
                <tr key={c.cliente_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.cliente_id}`} className="font-medium text-navy-900 hover:underline">
                      {c.empresa}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatBRL(c.valor_mensal)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {Number(c.pct_brendo)}% / {Number(c.pct_victor)}%
                  </td>
                  <td className="px-4 py-3 font-medium text-navy-900">{formatBRL(c.liquido_brendo)}</td>
                  <td className="px-4 py-3 font-medium text-navy-900">{formatBRL(c.liquido_victor)}</td>
                  <td className="px-4 py-3 text-ok">{formatBRL(c.caixa_total)}</td>
                </tr>
              ))}
              {distribuicao.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhum cliente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <h2 className="text-sm font-semibold text-navy-900">Agenda financeira do mês</h2>
              <p className="text-xs text-slate-400">{monthLabel(mes)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={`/dashboard?mes=${mesAnterior}`}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                ← Anterior
              </Link>
              <Link
                href={`/dashboard?mes=${firstDayOfMonth()}`}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Hoje
              </Link>
              <Link
                href={`/dashboard?mes=${mesSeguinte}`}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Próximo →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {lista.length === 0 && (
              <p className="p-4 text-sm text-slate-400">Nenhum pagamento neste mês.</p>
            )}
            {lista.map((p: any) => (
              <Link
                key={p.id}
                href={`/clientes/${p.cliente_id}`}
                className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${dotStyle[p.status_efetivo]}`} />
                  <div>
                    <div className="font-medium text-navy-900">{p.clientes?.empresa}</div>
                    <div className="text-xs text-slate-400">Vence {formatDate(p.vencimento)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-navy-900">{formatBRL(p.valor)}</span>
                  <StatusBadge status={p.status_efetivo} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h2 className="text-sm font-semibold text-navy-900">Central de alertas</h2>
            <Link href="/alertas" className="text-xs font-medium text-copper-600 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="flex gap-2 border-b border-slate-100 p-3 text-xs">
            <span className="rounded-full bg-danger/10 px-2 py-1 font-medium text-danger">
              {alertasCriticos} críticos
            </span>
            <span className="rounded-full bg-warn/10 px-2 py-1 font-medium text-warn">
              {alertasAtencao} atenção
            </span>
          </div>
          <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {(alertas ?? []).length === 0 && (
              <p className="p-4 text-sm text-slate-400">Nenhum alerta no momento. 🎉</p>
            )}
            {(alertas ?? []).slice(0, 12).map((a: any, i: number) => (
              <Link
                key={i}
                href={a.cliente_id ? `/clientes/${a.cliente_id}` : "/alertas"}
                className="block p-3 text-sm hover:bg-slate-50"
              >
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${
                    a.nivel === "critico" ? "bg-danger" : a.nivel === "atencao" ? "bg-warn" : "bg-ok"
                  }`}
                />
                {a.mensagem}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
