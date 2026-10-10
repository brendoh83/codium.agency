"use client";

import { useState, useTransition } from "react";
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

function Midia({ item }: { item: ItemFeed }) {
  if (item.expirada || !item.url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
        Arquivo expirado
      </div>
    );
  }
  if (item.tipo === "imagem") return <img src={item.url} alt={item.titulo} className="w-full rounded-lg" />;
  return <video src={item.url} controls playsInline preload="metadata" className="w-full rounded-lg bg-black" />;
}

function Card({ item, token }: { item: ItemFeed; token: string }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [modo, setModo] = useState<null | "confirmar" | "reprovar">(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const podeResponder = item.estado === "pendente" && !item.expirada;

  function enviar(decisao: "aprovado" | "reprovado") {
    setErro(null);
    start(async () => {
      const r = await responderVersao(token, item.versaoId, decisao, decisao === "reprovado" ? motivo : null);
      if (r.erro) return setErro(r.erro);
      setModo(null);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-navy-900">{item.titulo}</h3>
        <div className="flex items-center gap-2">
          {item.estado === "pendente" && item.numero > 1 && (
            <span className="rounded-full bg-copper-100 px-2 py-1 text-xs font-medium text-copper-600">
              Nova versão atualizada
            </span>
          )}
          {item.estado === "aprovado" && (
            <span className="rounded-full bg-ok px-2 py-1 text-xs font-semibold text-white">Aprovado</span>
          )}
          {item.estado === "reprovado" && (
            <span className="rounded-full bg-danger/10 px-2 py-1 text-xs font-medium text-danger">
              Aguardando nova versão
            </span>
          )}
        </div>
      </div>

      <Midia item={item} />

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
    </article>
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
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Para aprovar</h2>
        {topo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nada pendente por aqui. Tudo em dia!
          </p>
        ) : (
          topo.map((i) => <Card key={i.id} item={i} token={token} />)
        )}
      </section>

      {aprovados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Aprovados</h2>
          {aprovados.map((i) => (
            <Card key={i.id} item={i} token={token} />
          ))}
        </section>
      )}
    </div>
  );
}
