"use client";

import { useState } from "react";
import { regerarLink } from "@/actions/conteudos";

export default function LinkCliente({ clienteId, token }: { clienteId: string; token: string }) {
  const [atual, setAtual] = useState(token);
  const [aviso, setAviso] = useState<string | null>(null);
  const url = typeof window === "undefined" ? `/c/${atual}` : `${window.location.origin}/c/${atual}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado.");
    } catch {
      setAviso("Não foi possível copiar. Selecione e copie o link acima.");
    }
  }

  async function gerarNovo() {
    if (
      !confirm(
        "Atenção: o link atual deixa de funcionar e o cliente perde o acesso até receber o link novo. Gerar link novo mesmo assim?"
      )
    )
      return;
    const r = await regerarLink(clienteId);
    if (r.token) {
      setAtual(r.token);
      setAviso("Link novo gerado. O anterior não funciona mais. Envie o novo ao cliente.");
    } else {
      setAviso(r.erro ?? "Erro ao gerar o link.");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="space-y-2">
        <div className="text-xs uppercase text-slate-400">Link do cliente</div>
        <input
          readOnly
          value={url}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <button
          onClick={copiar}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950"
        >
          Copiar link
        </button>
        {aviso && <p className="text-xs text-slate-500">{aviso}</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-[11px] text-slate-400">
          Só use se o link vazou. O link antigo para de funcionar.
        </p>
        <button
          onClick={gerarNovo}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-400 hover:border-danger hover:text-danger"
        >
          Gerar link novo
        </button>
      </div>
    </div>
  );
}
