"use client";

import { useTransition } from "react";
import { alternarServico } from "@/actions/servicos";

export default function ServicosConfig({ servicos }: { servicos: any[] }) {
  const [, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {servicos.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <span className={s.ativo ? "text-navy-900" : "text-slate-400 line-through"}>{s.nome}</span>
          <button
            onClick={() => startTransition(() => alternarServico(s.id, !s.ativo))}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              s.ativo ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-ok/10 text-ok hover:bg-ok/20"
            }`}
          >
            {s.ativo ? "Desativar" : "Ativar"}
          </button>
        </div>
      ))}
    </div>
  );
}
