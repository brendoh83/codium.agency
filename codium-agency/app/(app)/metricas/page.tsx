import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/StatCard";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const supabase = createClient();

  const [{ data: metricas }, { data: receitaServico }, { data: pagos }, { data: clientesAtivos }] =
    await Promise.all([
      supabase.from("v_metricas_gerais").select("*").single(),
      supabase.from("v_receita_por_servico").select("*"),
      supabase.from("pagamentos").select("valor").eq("status", "pago"),
      supabase.from("clientes").select("data_inicio").eq("status", "ativo"),
    ]);

  const receitaAcumulada = (pagos ?? []).reduce((s, p: any) => s + p.valor, 0);
  const mrr = metricas?.mrr ?? 0;
  const ticketMedio = metricas?.ticket_medio ?? 0;
  const ativos = metricas?.clientes_ativos ?? 0;
  const perdidosMes = metricas?.clientes_perdidos_mes ?? 0;
  const churn = ativos + perdidosMes > 0 ? (perdidosMes / (ativos + perdidosMes)) * 100 : 0;

  const hoje = new Date();
  const tempoMedioMeses =
    (clientesAtivos ?? []).length > 0
      ? (clientesAtivos ?? []).reduce((s: number, c: any) => {
          const inicio = new Date(c.data_inicio);
          const meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
          return s + Math.max(meses, 1);
        }, 0) / (clientesAtivos ?? []).length
      : 0;
  const ltv = ticketMedio * (churn > 0 ? 100 / churn : Math.max(tempoMedioMeses, 6));

  const receitaMax = Math.max(...(receitaServico ?? []).map((r: any) => r.receita_mensal), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Métricas da agência</h1>
        <p className="text-sm text-slate-500">Indicadores gerais de crescimento e receita</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Clientes ativos" value={String(ativos)} />
        <StatCard label="Novos no mês" value={String(metricas?.clientes_novos_mes ?? 0)} tone="ok" />
        <StatCard label="Perdidos no mês" value={String(perdidosMes)} tone={perdidosMes > 0 ? "danger" : "default"} />
        <StatCard label="Churn mensal" value={`${churn.toFixed(1)}%`} tone={churn > 5 ? "danger" : "default"} />
        <StatCard label="Ticket médio" value={formatBRL(ticketMedio)} />
        <StatCard label="LTV estimado" value={formatBRL(ltv)} sub="baseado no churn/tempo médio de contrato" />
        <StatCard label="Receita recorrente (MRR)" value={formatBRL(mrr)} />
        <StatCard label="Receita acumulada (histórico)" value={formatBRL(receitaAcumulada)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">Receita por serviço</h2>
        <div className="space-y-3">
          {(receitaServico ?? []).map((r: any) => (
            <div key={r.servico_id}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-600">{r.servico}</span>
                <span className="font-medium text-navy-900">{formatBRL(r.receita_mensal)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-copper-500"
                  style={{ width: `${(r.receita_mensal / receitaMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Calculado a partir da composição de valor de cada serviço dentro dos contratos ativos, sem
          contar receita em duplicidade quando um cliente possui mais de um serviço.
        </p>
      </div>
    </div>
  );
}
