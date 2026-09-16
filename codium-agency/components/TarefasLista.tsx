"use client";

import { useTransition } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { atualizarStatusTarefa, excluirTarefa } from "@/actions/tarefas";

const TIPO_LABEL: Record<string, string> = {
  reuniao: "Reunião",
  entrega: "Entrega",
  criativo: "Criativo",
  campanha: "Campanha",
  gravacao: "Gravação",
  relatorio: "Relatório",
  cobranca: "Cobrança",
  outros: "Outros",
};

export default function TarefasLista({ tarefas }: { tarefas: any[] }) {
  const [, startTransition] = useTransition();
  const hoje = new Date().toISOString().slice(0, 10);

  const atrasadas = tarefas.filter((t) => t.status !== "concluido" && t.data < hoje);
  const proximas = tarefas.filter((t) => t.status !== "concluido" && t.data >= hoje);
  const concluidas = tarefas.filter((t) => t.status === "concluido");

  function Grupo({ titulo, itens, tom }: { titulo: string; itens: any[]; tom?: string }) {
    if (itens.length === 0) return null;
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-100 p-4">
          <h2 className={`text-sm font-semibold ${tom === "danger" ? "text-danger" : "text-navy-900"}`}>
            {titulo} ({itens.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {itens.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <div className="font-medium text-navy-900">{t.titulo}</div>
                <div className="text-xs text-slate-400">
                  {TIPO_LABEL[t.tipo]} · {formatDate(t.data)}
                  {t.clientes?.empresa && (
                    <>
                      {" · "}
                      <Link href={`/clientes/${t.cliente_id}`} className="hover:underline">
                        {t.clientes.empresa}
                      </Link>
                    </>
                  )}
                  {t.responsavel && ` · ${t.responsavel}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={t.status}
                  onChange={(e) => startTransition(() => atualizarStatusTarefa(t.id, e.target.value))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="a_fazer">A fazer</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Concluído</option>
                </select>
                <button
                  onClick={() => startTransition(() => excluirTarefa(t.id))}
                  className="text-xs text-slate-300 hover:text-danger"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Grupo titulo="Atrasadas" itens={atrasadas} tom="danger" />
      <Grupo titulo="Próximas" itens={proximas} />
      <Grupo titulo="Concluídas" itens={concluidas} />
      {tarefas.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          Nenhuma tarefa cadastrada.
        </p>
      )}
    </div>
  );
}
