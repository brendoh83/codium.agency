"use client";

import { useState, useTransition } from "react";
import { marcarPagamentoRecebido } from "@/actions/pagamentos";

export default function MarcarRecebido({ pagamentoId, clienteId }: { pagamentoId: string; clienteId: string }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [pendente, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <input
        type="date"
        value={data}
        max={hoje}
        onChange={(e) => setData(e.target.value || hoje)}
        aria-label="Data em que o cliente pagou"
        className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600"
      />
      <button
        disabled={pendente}
        className="rounded-md bg-ok/10 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/20 disabled:opacity-50"
        onClick={() => start(() => marcarPagamentoRecebido(pagamentoId, clienteId, data))}
      >
        Marcar recebido
      </button>
    </div>
  );
}
