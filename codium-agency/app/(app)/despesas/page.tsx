import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { garantirDespesasRecorrentes } from "@/actions/despesas";
import DespesasLista, { type DespesaItem } from "@/components/DespesasLista";
import NovaDespesa from "@/components/NovaDespesa";
import StatCard from "@/components/StatCard";
import { formatBRL, monthLabel, firstDayOfMonth, shiftMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DespesasPage({ searchParams }: { searchParams: { mes?: string } }) {
  await garantirDespesasRecorrentes();
  const supabase = createClient();
  const mes = searchParams.mes ?? firstDayOfMonth();

  const [{ data: despesas }, { data: coberturas }, { data: caixa }] = await Promise.all([
    supabase.from("despesas").select("*").eq("mes_referencia", mes).order("vencimento", { ascending: true }),
    supabase.from("despesa_coberturas").select("despesa_id, socio, valor"),
    supabase.from("v_caixa_mes").select("saldo_final").eq("mes", mes).maybeSingle(),
  ]);

  const cobPorDespesa = new Map<string, { socio: any; valor: number }[]>();
  for (const c of (coberturas ?? []) as any[]) {
    const lista = cobPorDespesa.get(c.despesa_id) ?? [];
    lista.push({ socio: c.socio, valor: Number(c.valor) });
    cobPorDespesa.set(c.despesa_id, lista);
  }

  const itens: DespesaItem[] = ((despesas ?? []) as any[]).map((d) => ({
    id: d.id,
    modelo_id: d.modelo_id,
    descricao: d.descricao,
    categoria: d.categoria,
    tipo: d.tipo,
    valor: Number(d.valor),
    vencimento: d.vencimento,
    pago: Boolean(d.pago),
    data_pagamento: d.data_pagamento,
    coberturas: cobPorDespesa.get(d.id) ?? [],
  }));

  const soma = (f: (d: DespesaItem) => boolean) => itens.filter(f).reduce((s, d) => s + d.valor, 0);
  const totalMes = soma(() => true);
  const pagas = soma((d) => d.pago);
  const aPagar = soma((d) => !d.pago);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Despesas</h1>
          <p className="text-sm text-slate-500">Fixas (todo mês) e variáveis (por período). Só o que for pago sai do caixa.</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/despesas?mes=${shiftMonth(mes, -1)}`}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            ← Anterior
          </Link>
          <span className="px-2 text-sm font-medium text-navy-900">{monthLabel(mes)}</span>
          <Link
            href={`/despesas?mes=${shiftMonth(mes, 1)}`}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            Próximo →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Despesas do mês" value={formatBRL(totalMes)} />
        <StatCard label="Já pagas" value={formatBRL(pagas)} tone="ok" />
        <StatCard label="A pagar" value={formatBRL(aPagar)} tone={aPagar > 0 ? "warn" : "default"} />
        <StatCard
          label="Caixa disponível"
          value={formatBRL(Number(caixa?.saldo_final ?? 0))}
          tone={Number(caixa?.saldo_final ?? 0) >= 0 ? "ok" : "danger"}
          sub="Acumulado até este mês"
        />
      </div>

      <NovaDespesa mesPadrao={mes.slice(0, 7)} />

      <DespesasLista despesas={itens} />
    </div>
  );
}
