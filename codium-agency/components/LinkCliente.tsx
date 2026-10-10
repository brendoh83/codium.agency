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
    if (!confirm("O link atual deixa de funcionar. Gerar um link novo?")) return;
    const r = await regerarLink(clienteId);
    if (r.token) {
      setAtual(r.token);
      setAviso("Link novo gerado. O anterior não funciona mais.");
    } else {
      setAviso(r.erro ?? "Erro ao gerar o link.");
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="text-xs uppercase text-slate-400">Link do cliente</div>
      <input readOnly value={url} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={copiar} className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white hover:bg-navy-950">
          Copiar link
        </button>
        <button onClick={gerarNovo} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Gerar link novo
        </button>
      </div>
      {aviso && <p className="text-xs text-slate-500">{aviso}</p>}
    </div>
  );
}
