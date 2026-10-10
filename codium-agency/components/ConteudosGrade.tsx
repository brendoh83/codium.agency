"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirConteudo } from "@/actions/conteudos";
import ConteudoUpload from "@/components/ConteudoUpload";
import { ETIQUETA, Midia, Miniatura, type ItemFeed } from "@/components/FeedCliente";

function Detalhe({ item, clienteId, onFechar }: { item: ItemFeed; clienteId: string; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const et = ETIQUETA[item.estado];

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  function excluir() {
    if (!confirm(`Excluir "${item.titulo}"? Isso apaga o conteúdo e os arquivos, e não pode ser desfeito.`)) return;
    setErro(null);
    start(async () => {
      const r = await excluirConteudo({ clienteId, conteudoId: item.id });
      if (r.erro) return setErro(r.erro);
      router.refresh();
      onFechar();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[94vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-navy-900">{item.titulo}</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${et.cls}`}>{et.texto}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">v{item.numero}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            ✕
          </button>
        </div>

        <Midia item={item} grande />

        {item.historico.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {item.historico.map((h) => (
              <li key={h.numero}>
                <span className="font-medium">v{h.numero} reprovada:</span> {h.motivo}
              </li>
            ))}
          </ul>
        )}

        {item.estado === "pendente" && (
          <div className="space-y-1">
            <p className="text-xs text-slate-500">
              O cliente ainda não respondeu. Enviar outro arquivo substitui este (continua na mesma versão).
            </p>
            <ConteudoUpload clienteId={clienteId} conteudoId={item.id} trocar onConcluido={onFechar} />
          </div>
        )}

        {item.estado === "reprovado" && (
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Reprovado pelo cliente. Suba a correção como nova versão.</p>
            <ConteudoUpload clienteId={clienteId} conteudoId={item.id} onConcluido={onFechar} />
          </div>
        )}

        {erro && <p className="text-sm text-danger">{erro}</p>}

        <button
          type="button"
          onClick={excluir}
          disabled={pendente}
          className="w-full rounded-lg border border-danger py-2.5 text-sm font-semibold text-danger disabled:opacity-50"
        >
          {pendente ? "Excluindo..." : "Excluir conteúdo"}
        </button>
      </div>
    </div>
  );
}

export default function ConteudosGrade({
  clienteId,
  topo,
  aprovados,
}: {
  clienteId: string;
  topo: ItemFeed[];
  aprovados: ItemFeed[];
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = [...topo, ...aprovados].find((i) => i.id === abertoId) ?? null;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Para aprovar{topo.length > 0 ? ` (${topo.length})` : ""}
        </h2>
        {topo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nenhum conteúdo aguardando.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1 md:grid-cols-5">
            {topo.map((i) => (
              <Miniatura key={i.id} item={i} onAbrir={() => setAbertoId(i.id)} />
            ))}
          </div>
        )}
      </section>

      {aprovados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Aprovados ({aprovados.length})
          </h2>
          <div className="grid grid-cols-3 gap-1 md:grid-cols-5">
            {aprovados.map((i) => (
              <Miniatura key={i.id} item={i} onAbrir={() => setAbertoId(i.id)} />
            ))}
          </div>
        </section>
      )}

      {aberto && <Detalhe item={aberto} clienteId={clienteId} onFechar={() => setAbertoId(null)} />}
    </div>
  );
}
