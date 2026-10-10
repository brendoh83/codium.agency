import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { garantirPagamentosFuturos } from "@/actions/pagamentos";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import RepassesSecao, { type DivisaoMes, type RepasseLinha } from "@/components/RepassesSecao";
import CaixaExtrato, { type CaixaMes, type DespesaLinha } from "@/components/CaixaExtrato";
import RecebimentosMes, { type RecebimentoLinha } from "@/components/RecebimentosMes";
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
    { data: divisaoMesRow },
    { data: caixaMesRow },
    { data: repassesMes },
    { data: despesasMes },
    { data: parcelasAvulsasMes },
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
    supabase.from("v_divisao_mes").select("*").eq("mes", mes).maybeSingle(),
    supabase.from("v_caixa_mes").select("*").eq("mes", mes).maybeSingle(),
    supabase.from("repasses").select("*").eq("mes_referencia", mes).order("data", { ascending: false }),
    supabase.from("despesas").select("id, descricao, categoria, tipo, valor").eq("mes_referencia", mes).order("valor", { ascending: false }),
    supabase
      .from("servico_parcelas")
      .select("id, valor, data_pagamento, servicos_avulsos(descricao, empresa_externa, clientes(empresa))")
      .eq("competencia", mes)
      .eq("status", "pago"),
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
  const num = (v: unknown) => Number(v ?? 0);
  const dv = (divisaoMesRow ?? {}) as any;
  const divisao: DivisaoMes = {
    faturamento: num(dv.faturamento),
    devido_brendo: num(dv.devido_brendo),
    devido_victor: num(dv.devido_victor),
    devido_caixa: num(dv.devido_caixa),
    entrou_brendo: num(dv.entrou_brendo),
    entrou_victor: num(dv.entrou_victor),
    repassado_brendo: num(dv.repassado_brendo),
    repassado_victor: num(dv.repassado_victor),
    excesso_brendo: num(dv.excesso_brendo),
    excesso_victor: num(dv.excesso_victor),
    caixa_apos_retiradas: num(dv.caixa_apos_retiradas),
    diferenca_movimentacao: num(dv.diferenca_movimentacao),
  };
  const entrouCaixa = num(dv.entrou_caixa);
  const cx = (caixaMesRow ?? {}) as any;
  const caixa: CaixaMes = {
    saldo_inicial: num(cx.saldo_inicial),
    entradas: num(cx.entradas),
    saidas_despesas: num(cx.saidas_despesas),
    saidas_retiradas: num(cx.saidas_retiradas),
    saldo_final: num(cx.saldo_final),
  };
  const repassesLista: RepasseLinha[] = ((repassesMes ?? []) as any[]).map((r) => ({
    id: r.id,
    socio: r.socio,
    valor: num(r.valor),
    data: r.data,
    observacao: r.observacao,
  }));
  const despesasLista: DespesaLinha[] = ((despesasMes ?? []) as any[]).map((d) => ({
    id: d.id,
    descricao: d.descricao,
    categoria: d.categoria,
    tipo: d.tipo,
    valor: num(d.valor),
  }));
  const recebimentos: RecebimentoLinha[] = lista
    .filter((p) => p.status_efetivo === "pago")
    .map((p) => ({
      id: p.id,
      empresa: p.clientes?.empresa ?? "",
      valor: num(p.valor),
      data_pagamento: p.data_pagamento,
      pct_brendo: num(p.pct_brendo_aplicado ?? 50),
      pct_victor: num(p.pct_victor_aplicado ?? 50),
    }));
  const recebimentosAvulsos: RecebimentoLinha[] = ((parcelasAvulsasMes ?? []) as any[]).map((a) => ({
    id: a.id,
    empresa: `${a.servicos_avulsos?.clientes?.empresa ?? a.servicos_avulsos?.empresa_externa ?? "Avulso"} — ${a.servicos_avulsos?.descricao ?? "serviço avulso"}`,
    valor: num(a.valor),
    data_pagamento: a.data_pagamento,
    pct_brendo: 50,
    pct_victor: 50,
  }));
  const todosRecebimentos = [...recebimentos, ...recebimentosAvulsos];
  const totalBrendo = divisao.devido_brendo;
  const totalVictor = divisao.devido_victor;
  const totalCaixaMes = divisao.devido_caixa;
  const despesasFixas = fm?.despesas_fixas ?? 0;
  const despesasVariaveis = fm?.despesas_variaveis ?? 0;
  const despesasTotais = fm?.despesas_totais ?? 0;
  const saldoCaixa = caixa.saldo_final;
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
          <StatCard
            label="Total do Brendo"
            value={formatBRL(totalBrendo)}
            sub={`Entrou ${formatBRL(divisao.entrou_brendo)} · Falta ${formatBRL(totalBrendo - divisao.entrou_brendo)}`}
          />
          <StatCard
            label="Total do Victor"
            value={formatBRL(totalVictor)}
            sub={`Entrou ${formatBRL(divisao.entrou_victor)} · Falta ${formatBRL(totalVictor - divisao.entrou_victor)}`}
          />
          <StatCard
            label="Total destinado ao caixa"
            value={formatBRL(totalCaixaMes)}
            tone="ok"
            sub={`Entrou ${formatBRL(entrouCaixa)} · Falta ${formatBRL(totalCaixaMes - entrouCaixa)}`}
          />
          <StatCard
            label="Saldo disponível no caixa"
            value={formatBRL(saldoCaixa)}
            tone={saldoCaixa >= 0 ? "ok" : "danger"}
            sub="Acumulado: saldo anterior + entrou − despesas − retiradas"
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

      <RepassesSecao mesISO={mes} mesLabel={monthLabel(mes)} divisao={divisao} repasses={repassesLista} />

      <CaixaExtrato mesLabel={monthLabel(mes)} caixa={caixa} despesas={despesasLista} />

      <RecebimentosMes
        mesLabel={monthLabel(mes)}
        linhas={todosRecebimentos}
        totais={{
          brendo: divisao.entrou_brendo,
          victor: divisao.entrou_victor,
          caixa: entrouCaixa,
        }}
      />

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
