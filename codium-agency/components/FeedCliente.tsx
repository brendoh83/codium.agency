"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { responderVersao } from "@/actions/feed";

export interface ItemFeed {
  id: string;
  titulo: string;
  tipo: "video" | "imagem";
  estado: "pendente" | "reprovado" | "aprovado";
  versaoId: string;
  numero: number;
  url: string | null;
  expirada: boolean;
  historico: { numero: number; motivo: string }[];
}

const ETIQUETA = {
  pendente: { texto: "Pendente", cls: "bg-warn text-white" },
  reprovado: { texto: "Reprovado", cls: "bg-danger text-white" },
  aprovado: { texto: "Aprovado", cls: "bg-ok text-white" },
} as const;

function Midia({ item, grande }: { item: ItemFeed; grande?: boolean }) {
  if (item.expirada || !item.url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
        Arquivo expirado
      </div>
    );
  }
  if (item.tipo === "imagem") {
    return <img src={item.url} alt={item.titulo} className="max-h-[60vh] w-full rounded-lg object-contain" />;
  }
  return (
    <video
      src={item.url}
      controls
      playsInline
      preload={grande ? "auto" : "metadata"}
      className="max-h-[60vh] w-full rounded-lg bg-black"
    />
  );
}

function Miniatura({ item, onAbrir }: { item: ItemFeed; onAbrir: () => void }) {
  const et = ETIQUETA[item.estado];
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Abrir ${item.titulo}`}
      className="relative aspect-[4/5] w-full overflow-hidden bg-slate-300 text-left"
    >
      {item.expirada || !item.url ? (
        <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[11px] font-medium text-slate-600">
          Arquivo expirado
        </span>
      ) : item.tipo === "imagem" ? (
        <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <video
          src={`${item.url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none h-full w-full object-cover"
        />
      )}

      {item.tipo === "video" && (
        <span className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">▶</span>
      )}
      {item.estado === "pendente" && item.numero > 1 && (
        <span className="absolute left-1 top-1 rounded bg-copper-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Nova versão
        </span>
      )}
      <span
        className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${et.cls}`}
      >
        {et.texto}
      </span>
    </button>
  );
}

function Detalhe({ item, token, onFechar }: { item: ItemFeed; token: string; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [modo, setModo] = useState<null | "confirmar" | "reprovar">(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const podeResponder = item.estado === "pendente" && !item.expirada;
  const et = ETIQUETA[item.estado];

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  function enviar(decisao: "aprovado" | "reprovado") {
    setErro(null);
    start(async () => {
      const r = await responderVersao(token, item.versaoId, decisao, decisao === "reprovado" ? motivo : null);
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
              {item.estado === "pendente" && item.numero > 1 && (
                <span className="rounded bg-copper-100 px-1.5 py-0.5 text-[11px] font-medium text-copper-600">
                  Nova versão atualizada
                </span>
              )}
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

        {item.estado === "reprovado" && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Aguardando a nova versão da agência.
          </p>
        )}

        {item.historico.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {item.historico.map((h) => (
              <li key={h.numero}>
                <span className="font-medium">Versão {h.numero} reprovada:</span> {h.motivo}
              </li>
            ))}
          </ul>
        )}

        {podeResponder && modo !== "reprovar" && (
          <div className="flex gap-2">
            <button
              onClick={() => setModo("confirmar")}
              className="flex-1 rounded-lg bg-ok py-3 text-sm font-semibold text-white"
            >
              Aprovar
            </button>
            <button
              onClick={() => setModo("reprovar")}
              className="flex-1 rounded-lg border border-danger py-3 text-sm font-semibold text-danger"
            >
              Reprovar
            </button>
          </div>
        )}

        {podeResponder && modo === "reprovar" && (
          <div className="space-y-2">
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="O que precisa mudar neste conteúdo?"
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => enviar("reprovado")}
                disabled={pendente || motivo.trim().length === 0}
                className="flex-1 rounded-lg bg-danger py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Enviar reprovação
              </button>
              <button
                onClick={() => {
                  setModo(null);
                  setErro(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-danger">{erro}</p>}
      </div>

      {modo === "confirmar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-medium text-navy-900">Deseja aprovar este conteúdo?</p>
            <p className="text-sm text-slate-500">{item.titulo}</p>
            <div className="flex gap-2">
              <button
                onClick={() => enviar("aprovado")}
                disabled={pendente}
                className="flex-1 rounded-lg bg-ok py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Sim
              </button>
              <button
                onClick={() => setModo(null)}
                disabled={pendente}
                className="flex-1 rounded-lg border border-slate-300 py-3 text-sm font-semibold text-slate-700"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeedCliente({
  token,
  topo,
  aprovados,
}: {
  token: string;
  topo: ItemFeed[];
  aprovados: ItemFeed[];
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = [...topo, ...aprovados].find((i) => i.id === abertoId) ?? null;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Para aprovar{topo.length > 0 ? ` (${topo.length})` : ""}
        </h2>
        {topo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nada pendente por aqui. Tudo em dia!
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
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
          <div className="grid grid-cols-3 gap-1">
            {aprovados.map((i) => (
              <Miniatura key={i.id} item={i} onAbrir={() => setAbertoId(i.id)} />
            ))}
          </div>
        </section>
      )}

      {aberto && <Detalhe item={aberto} token={token} onFechar={() => setAbertoId(null)} />}
    </div>
  );
}
