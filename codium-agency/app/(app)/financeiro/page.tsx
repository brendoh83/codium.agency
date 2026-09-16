import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { garantirPagamentosFuturos } from "@/actions/pagamentos";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { formatBRL, formatDate, monthLabel, firstDayOfMonth, shiftMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  await garantirPagamentosFuturos(6);
  const supabase = createClient();
  const mes = searchParams.mes ?? firstDayOfMonth();

  const [{ data: pagamentos }, { data: previsibilidade }] = await Promise.all([
    supabase
      .from("v_pagamentos")
      .select("*, clientes(empresa)")
      .eq("competencia", mes)
      .order("vencimento"),
    supabase.from("v_previsibilidade_mensal").select("*").gte("mes", firstDayOfMonth()).order("mes").limit(6),
  ]);

  const lista = (pagamentos ?? []) as any[];
  const recebido = lista.filter((p) => p.status_efetivo === "pago").reduce((s, p) => s + p.valor, 0);
  const pendente = lista.filter((p) => p.status_efetivo === "pendente").reduce((s, p) => s + p.valor, 0);
  const atrasado = lista.filter((p) => p.status_efetivo === "atrasado").reduce((s, p) => s + p.valor, 0);
  const previsto = lista.reduce((s, p) => s + p.valor, 0);

  const dotStyle: Record<string, string> = { pago: "bg-ok", pendente: "bg-warn", atrasado: "bg-danger" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Financeiro</h1>
        <p className="text-sm text-slate-500">Agenda de pagamentos e previsibilidade</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Receita prevista" value={formatBRL(previsto)} />
        <StatCard label="Recebida" value={formatBRL(recebido)} tone="ok" />
        <StatCard label="Pendente" value={formatBRL(pendente)} tone="warn" />
        <StatCard label="Atrasada" value={formatBRL(atrasado)} tone={atrasado > 0 ? "danger" : "default"} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-navy-900">{monthLabel(mes)}</h2>
          <div className="flex gap-1">
            <Link href={`/financeiro?mes=${shiftMonth(mes, -1)}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
              ← Anterior
            </Link>
            <Link href={`/financeiro?mes=${firstDayOfMonth()}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
              Hoje
            </Link>
            <Link href={`/financeiro?mes=${shiftMonth(mes, 1)}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
              Próximo →
            </Link>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {lista.map((p: any) => (
            <Link key={p.id} href={`/clientes/${p.cliente_id}`} className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-slate-50">
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
          {lista.length === 0 && <p className="p-4 text-sm text-slate-400">Nenhum pagamento neste mês.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">Previsibilidade — próximos meses</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {(previsibilidade ?? []).map((p: any) => (
            <div key={p.mes} className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs uppercase text-slate-400">{monthLabel(p.mes)}</div>
              <div className="mt-1 text-lg font-semibold text-navy-900">{formatBRL(p.previsto)}</div>
              <div className="mt-1 flex gap-2 text-[11px] text-slate-400">
                <span className="text-ok">{formatBRL(p.recebido)} recebido</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
