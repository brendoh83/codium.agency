"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { contasAutodm, ligarAutodm } from "@/actions/autodm";

export default function LigarAutodm({ clienteId, atualId }: { clienteId: string; atualId: string | null }) {
  const router = useRouter();
  const [contas, setContas] = useState<{ id: string; nome: string }[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  const carregar = () =>
    start(async () => {
      setAviso(null);
      const r = await contasAutodm();
      if (r.erro) return setAviso(r.erro);
      setContas(r.contas ?? []);
    });

  const escolher = (id: string) =>
    start(async () => {
      setAviso(null);
      const r = await ligarAutodm(clienteId, id || null);
      if (r.erro) return setAviso(r.erro);
      setContas(null);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-slate-500">AutoDM:</span>
      {contas === null ? (
        <button
          type="button"
          onClick={carregar}
          disabled={pendente}
          className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-50"
        >
          {pendente ? "Carregando…" : atualId ? "Trocar conta do AutoDM" : "Ligar conta do AutoDM"}
        </button>
      ) : (
        <select
          defaultValue={atualId ?? ""}
          disabled={pendente}
          onChange={(e) => escolher(e.target.value)}
          className="input"
          aria-label="Conta do AutoDM"
        >
          <option value="">Nenhuma</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      )}
      {aviso && <span className="text-danger">{aviso}</span>}
    </div>
  );
}
