"use client";

import { useState } from "react";
import { labelFor } from "@/lib/briefing-labels";
import { formatDate } from "@/lib/format";

type Briefing = {
  id: string;
  nome: string | null;
  empresa: string | null;
  whatsapp: string | null;
  respostas: Record<string, unknown>;
  concluido: boolean;
  concluido_em: string | null;
  created_at: string;
};

function formatValor(v: unknown) {
  if (Array.isArray(v)) return v.join(", ");
  if (v == null || v === "") return "—";
  return String(v);
}

export default function BriefingLista({ briefings }: { briefings: Briefing[] }) {
  const [abertoId, setAbertoId] = useState<string | null>(null);

  if (briefings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
        Nenhum cliente respondeu o briefing ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {briefings.map((b) => {
        const aberto = abertoId === b.id;
        const respostas = Object.entries(b.respostas ?? {}).filter(
          ([chave]) => chave !== "nome" && chave !== "empresa" && chave !== "whatsapp"
        );
        return (
          <div key={b.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <button
              onClick={() => setAbertoId(aberto ? null : b.id)}
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
            >
              <div>
                <div className="font-medium text-navy-900">{b.nome || "Sem nome"}</div>
                <div className="text-xs text-slate-400">{b.empresa || "Sem empresa"}</div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    b.concluido ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"
                  }`}
                >
                  {b.concluido ? "Completo" : "Em andamento"}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDate((b.concluido_em ?? b.created_at).slice(0, 10))}
                </span>
                <span className="text-slate-400">{aberto ? "▲" : "▼"}</span>
              </div>
            </button>
            {aberto && (
              <div className="border-t border-slate-100 p-4">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase text-slate-400">WhatsApp</div>
                    <div className="text-navy-900">{b.whatsapp || "—"}</div>
                  </div>
                  {respostas.map(([chave, valor]) => (
                    <div key={chave}>
                      <div className="text-xs uppercase text-slate-400">{labelFor(chave)}</div>
                      <div className="whitespace-pre-wrap text-navy-900">{formatValor(valor)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
