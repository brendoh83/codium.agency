"use client";

import { useTransition } from "react";
import { formatBRL, formatDate, monthLabel } from "@/lib/format";
import { excluirDespesa } from "@/actions/despesas";

export default function DespesasLista({ despesas }: { despesas: any[] }) {
  const [, startTransition] = useTransition();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Mês ref.</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {despesas.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="font-medium text-navy-900">{d.descricao}</div>
                {d.observacao && <div className="text-xs text-slate-400">{d.observacao}</div>}
              </td>
              <td className="px-4 py-3 text-slate-600">{d.categoria || "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    d.tipo === "fixa"
                      ? "bg-navy-900/10 text-navy-900"
                      : "bg-copper-500/10 text-copper-600"
                  }`}
                >
                  {d.tipo === "fixa" ? "Fixa" : "Variável"}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-navy-900">{formatBRL(d.valor)}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(d.data)}</td>
              <td className="px-4 py-3 text-slate-600">{monthLabel(d.mes_referencia)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => startTransition(() => excluirDespesa(d.id))}
                  className="text-xs text-slate-300 hover:text-danger"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {despesas.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                Nenhuma despesa cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
