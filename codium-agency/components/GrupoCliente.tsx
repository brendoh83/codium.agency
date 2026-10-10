"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gruposDisponiveis, reenviarAviso, salvarGrupoCliente } from "@/actions/whatsapp";

export default function GrupoCliente({
  clienteId,
  atualId,
  atualNome,
}: {
  clienteId: string;
  atualId: string | null;
  atualNome: string | null;
}) {
  const router = useRouter();
  const [grupos, setGrupos] = useState<{ id: string; nome: string }[] | null>(null);
  const [filtro, setFiltro] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  function carregar() {
    setAviso(null);
    start(async () => {
      const r = await gruposDisponiveis();
      if (r.erro) return setAviso(r.erro);
      setGrupos(r.grupos ?? []);
    });
  }

  function escolher(id: string) {
    const g = grupos?.find((x) => x.id === id);
    if (!g) return;
    start(async () => {
      const r = await salvarGrupoCliente(clienteId, g.id, g.nome);
      if (r.erro) return setAviso(r.erro);
      setGrupos(null);
      setAviso("Grupo salvo.");
      router.refresh();
    });
  }

  function reenviar() {
    setAviso(null);
    start(async () => {
      const r = await reenviarAviso(clienteId);
      setAviso(r.erro ?? "Aviso enviado no grupo.");
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="text-xs uppercase text-slate-400">Grupo de WhatsApp do cliente</div>
      <div className="text-sm text-navy-900">
        {atualId ? (atualNome ?? atualId) : "Nenhum grupo escolhido (sem avisos)"}
      </div>
      <div className="flex flex-wrap gap-2">
        {grupos === null ? (
          <button
            onClick={carregar}
            disabled={pendente}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            {atualId ? "Trocar grupo" : "Escolher grupo"}
          </button>
        ) : (
          <div className="w-full space-y-2">
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder={
                grupos.length ? `Buscar entre ${grupos.length} grupos…` : "Nenhum grupo encontrado (conecte o WhatsApp)"
              }
              className="input w-full"
            />
            <select
              defaultValue=""
              size={6}
              disabled={pendente}
              onChange={(e) => escolher(e.target.value)}
              className="input w-full"
            >
              {grupos
                .filter((g) => g.nome.toLowerCase().includes(filtro.trim().toLowerCase()))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
            </select>
          </div>
        )}
        {atualId && (
          <button
            onClick={reenviar}
            disabled={pendente}
            className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            Avisar de novo no grupo
          </button>
        )}
      </div>
      {aviso && <p className="text-xs text-slate-500">{aviso}</p>}
    </div>
  );
}
