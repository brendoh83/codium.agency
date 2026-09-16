"use client";

import { useTransition } from "react";
import StatusBadge from "@/components/StatusBadge";
import { formatBRL, formatDate } from "@/lib/format";
import { atualizarStatusLead, converterLeadEmCliente, excluirLead } from "@/actions/leads";

export default function LeadsLista({ leads }: { leads: any[] }) {
  const [, startTransition] = useTransition();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Nome / Empresa</th>
            <th className="px-4 py-3">Contato</th>
            <th className="px-4 py-3">Serviço</th>
            <th className="px-4 py-3">Valor potencial</th>
            <th className="px-4 py-3">Entrada</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="font-medium text-navy-900">{l.nome}</div>
                <div className="text-xs text-slate-400">{l.empresa}</div>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {l.whatsapp}
                {l.instagram ? ` · ${l.instagram}` : ""}
              </td>
              <td className="px-4 py-3 text-slate-600">{l.servico_interesse || "—"}</td>
              <td className="px-4 py-3">{l.valor_potencial ? formatBRL(l.valor_potencial) : "—"}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(l.data_entrada)}</td>
              <td className="px-4 py-3">
                {l.status === "fechado" ? (
                  <StatusBadge status="fechado" />
                ) : (
                  <select
                    value={l.status}
                    onChange={(e) => startTransition(() => atualizarStatusLead(l.id, e.target.value))}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="novo">Novo</option>
                    <option value="em_contato">Em contato</option>
                    <option value="proposta">Proposta</option>
                    <option value="perdido">Perdido</option>
                  </select>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {l.status !== "fechado" && (
                  <button
                    onClick={() => startTransition(() => converterLeadEmCliente(l.id))}
                    className="mr-2 rounded-md bg-ok/10 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/20"
                  >
                    Converter
                  </button>
                )}
                <button
                  onClick={() => startTransition(() => excluirLead(l.id))}
                  className="text-xs text-slate-300 hover:text-danger"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                Nenhum lead cadastrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
