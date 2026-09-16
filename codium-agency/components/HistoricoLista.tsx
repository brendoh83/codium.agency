"use client";

import { useTransition } from "react";
import { formatBRL, monthLabel } from "@/lib/format";
import { reabrirMes } from "@/actions/fechamentos";

export default function HistoricoLista({ fechamentos }: { fechamentos: any[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {fechamentos.map((f) => (
        <div key={f.mes} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-navy-900">{monthLabel(f.mes)}</h2>
            <button
              disabled={pending}
              onClick={() => {
                if (confirm(`Reabrir ${monthLabel(f.mes)}? O fechamento salvo será removido (dá pra fechar de novo depois).`)) {
                  startTransition(() => reabrirMes(f.mes));
                }
              }}
              className="text-xs text-slate-300 hover:text-danger"
            >
              Reabrir mês
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Item label="Faturamento" value={formatBRL(f.faturamento_total)} />
            <Item label="Recebido" value={formatBRL(f.total_recebido)} tone="ok" />
            <Item label="Brendo" value={formatBRL(f.total_brendo)} />
            <Item label="Victor" value={formatBRL(f.total_victor)} />
            <Item label="Caixa" value={formatBRL(f.total_caixa)} />
            <Item label="Despesas fixas" value={formatBRL(f.despesas_fixas)} tone="warn" />
            <Item label="Despesas variáveis" value={formatBRL(f.despesas_variaveis)} tone="warn" />
            <Item label="Despesas totais" value={formatBRL(f.despesas_totais)} tone="danger" />
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Item
              label="Saldo final do caixa"
              value={formatBRL(f.saldo_caixa)}
              tone={f.saldo_caixa >= 0 ? "ok" : "danger"}
            />
          </div>
        </div>
      ))}
      {fechamentos.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          Nenhum mês fechado ainda.
        </p>
      )}
    </div>
  );
}

function Item({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "danger" }) {
  const toneClass =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-navy-900";
  return (
    <div>
      <div className="text-[11px] uppercase text-slate-400">{label}</div>
      <div className={`mt-0.5 text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
