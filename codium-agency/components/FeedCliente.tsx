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

export const ETIQUETA = {
  pendente: { texto: "Pendente", cls: "bg-warn text-white" },
  reprovado: { texto: "Reprovado", cls: "bg-danger text-white" },
  aprovado: { texto: "Aprovado", cls: "bg-ok text-white" },
} as const;

const PONTO = { pendente: "bg-warn", reprovado: "bg-danger", aprovado: "bg-ok" } as const;

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 focus-visible:ring-offset-2";
const TOQUE = "transition-transform duration-150 motion-safe:active:scale-[0.97]";
const BOTAO_PRIMARIO = `inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-950 disabled:opacity-50 ${TOQUE} ${FOCO}`;
const BOTAO_SECUNDARIO = `inline-flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy-900 hover:border-navy-700/40 disabled:opacity-50 ${TOQUE} ${FOCO}`;

function reduzMovimento() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Marca a mídia como pronta (onLoad, cache já carregado antes da hidratação, erro ou tempo limite). */
function useCarregada(src: string | null) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    if (!src) return;
    // iOS nem sempre dispara eventos de vídeo sem interação: não deixa o esqueleto eterno.
    const t = setTimeout(() => setPronto(true), 4000);
    return () => clearTimeout(t);
  }, [src]);
  const ok = () => setPronto(true);
  return {
    pronto,
    img: {
      onLoad: ok,
      onError: ok,
      ref: (el: HTMLImageElement | null) => {
        if (el?.complete) ok();
      },
    },
    video: {
      onLoadedData: ok,
      onLoadedMetadata: ok,
      onError: ok,
      ref: (el: HTMLVideoElement | null) => {
        if (el && el.readyState >= 1) ok();
      },
    },
  };
}

function SemArquivo({ item, className }: { item: ItemFeed; className: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 bg-[#F1ECE7] px-2 text-center text-muted-ink ${className}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 text-muted">
        <path
          d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5zM4 15l4.5-4 4 3.5L15 12l5 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[11px] font-medium leading-tight">
        {item.expirada ? "Arquivo expirado" : "Prévia indisponível"}
      </span>
    </div>
  );
}

export function Midia({ item, grande }: { item: ItemFeed; grande?: boolean }) {
  const c = useCarregada(item.expirada ? null : item.url);
  if (item.expirada || !item.url) return <SemArquivo item={item} className="aspect-video rounded-xl text-sm" />;
  const fade = `relative transition-opacity duration-500 ${c.pronto ? "opacity-100" : "opacity-0"}`;
  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#F4F0EC] ${c.pronto ? "" : "min-h-[45vh]"}`}>
      {!c.pronto && <div aria-hidden className="skeleton absolute inset-0" />}
      {item.tipo === "imagem" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...c.img} src={item.url} alt={item.titulo} className={`max-h-[60vh] w-full object-contain ${fade}`} />
      ) : (
        <video
          {...c.video}
          src={item.url}
          controls
          playsInline
          preload={grande ? "auto" : "metadata"}
          className={`max-h-[60vh] w-full bg-black ${fade}`}
        />
      )}
    </div>
  );
}

function Selo({ estado, className = "" }: { estado: ItemFeed["estado"]; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-medium text-navy-900 shadow-sm backdrop-blur ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${PONTO[estado]}`} />
      {ETIQUETA[estado].texto}
    </span>
  );
}

export function Miniatura({
  item,
  onAbrir,
  indice,
}: {
  item: ItemFeed;
  onAbrir: () => void;
  /** Posição na grade: quando informado, entra com fade-up escalonado. */
  indice?: number;
}) {
  const c = useCarregada(item.expirada ? null : item.url);
  const semArquivo = item.expirada || !item.url;
  const fade = `transition-[opacity,transform] duration-700 ease-out ${c.pronto ? "opacity-100" : "opacity-0"} motion-safe:group-hover:scale-[1.03]`;
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Abrir ${item.titulo} (${ETIQUETA[item.estado].texto.toLowerCase()})`}
      style={indice === undefined ? undefined : { animationDelay: `${Math.min(indice, 12) * 45 + 280}ms` }}
      className={`group relative aspect-[4/5] w-full overflow-hidden bg-[#EFE8E2] text-left transition-transform duration-150 motion-safe:active:scale-[0.98] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper-500 ${
        indice === undefined ? "" : "motion-safe:animate-fade-up"
      }`}
    >
      {semArquivo ? (
        <SemArquivo item={item} className="absolute inset-0" />
      ) : (
        <>
          {!c.pronto && <span aria-hidden className="skeleton absolute inset-0" />}
          {item.tipo === "imagem" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...c.img} src={item.url!} alt="" loading="lazy" className={`h-full w-full object-cover ${fade}`} />
          ) : (
            <video
              {...c.video}
              src={`${item.url}#t=0.1`}
              muted
              playsInline
              preload="metadata"
              className={`pointer-events-none h-full w-full object-cover ${fade}`}
            />
          )}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-navy-950/35 to-transparent" />
        </>
      )}

      {item.tipo === "video" && (
        <span aria-hidden className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy-950/55 backdrop-blur">
          <svg viewBox="0 0 12 12" className="ml-0.5 h-2.5 w-2.5 fill-white">
            <path d="M2.5 1.5v9l8-4.5z" />
          </svg>
        </span>
      )}
      {item.estado === "pendente" && item.numero > 1 && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-copper-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          Nova versão
        </span>
      )}
      <Selo estado={item.estado} className="absolute bottom-1.5 left-1.5" />
    </button>
  );
}

function Verificado() {
  return (
    <svg aria-hidden viewBox="0 0 56 56" className="h-14 w-14 text-ok motion-safe:animate-pop">
      <circle
        cx="28"
        cy="28"
        r="26"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="1"
        className="motion-safe:animate-draw"
      />
      <path
        d="M18 28.5l7 7 13-14"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1"
        className="motion-safe:animate-draw motion-safe:[animation-delay:260ms]"
      />
    </svg>
  );
}

function Detalhe({ item, token, onFechar }: { item: ItemFeed; token: string; onFechar: () => void }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [modo, setModo] = useState<null | "confirmar" | "reprovar">(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [aprovado, setAprovado] = useState(false);

  const podeResponder = item.estado === "pendente" && !item.expirada;

  function fechar() {
    if (reduzMovimento()) return onFechar();
    setSaindo(true);
    setTimeout(onFechar, 240);
  }

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key !== "Escape" || pendente || aprovado) return;
      if (modo === "confirmar") setModo(null);
      else fechar();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  function enviar(decisao: "aprovado" | "reprovado") {
    setErro(null);
    start(async () => {
      const r = await responderVersao(token, item.versaoId, decisao, decisao === "reprovado" ? motivo : null);
      if (r.erro) return setErro(r.erro);
      if (decisao === "aprovado") {
        // Mostra o "check" antes de atualizar a grade e fechar.
        setAprovado(true);
        setTimeout(() => {
          router.refresh();
          fechar();
        }, 1300);
        return;
      }
      router.refresh();
      fechar();
    });
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center bg-navy-950/60 backdrop-blur-[2px] sm:items-center sm:p-6 ${
        saindo ? "motion-safe:animate-fade-out" : "motion-safe:animate-fade-in"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && modo === null && !pendente) fechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-titulo"
        className={`max-h-[94vh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-[22px] bg-white px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 shadow-sheet sm:rounded-2xl sm:px-6 sm:pb-6 sm:pt-5 sm:shadow-dialog ${
          saindo
            ? "motion-safe:animate-sheet-out sm:motion-safe:animate-modal-out"
            : "motion-safe:animate-sheet-in sm:motion-safe:animate-modal-in"
        }`}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1">
            <h3 id="detalhe-titulo" className="break-words font-display text-[21px] font-medium leading-snug text-navy-900">
              {item.titulo}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Selo estado={item.estado} className="border border-line shadow-none" />
              {item.estado === "pendente" && item.numero > 1 && (
                <span className="rounded-full bg-copper-100 px-2 py-0.5 text-[10.5px] font-medium text-copper-700">
                  Nova versão atualizada
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className={`-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-ink hover:bg-paper ${TOQUE} ${FOCO}`}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
              <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4">
          <Midia item={item} grande />
        </div>

        {item.estado === "reprovado" && (
          <p className="mt-4 flex items-center gap-2.5 rounded-xl bg-paper px-4 py-3 text-sm text-muted-ink">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-copper-500" />
            Aguardando a nova versão da agência.
          </p>
        )}

        {item.historico.length > 0 && (
          <section className="mt-5">
            <h4 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-copper-700">Histórico de ajustes</h4>
            <ol className="mt-3 space-y-3 border-l border-line pl-4">
              {item.historico.map((h) => (
                <li key={h.numero} className="relative text-sm leading-relaxed text-muted-ink">
                  <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full border border-copper-500 bg-white" />
                  <span className="block text-[12px] font-semibold text-navy-900">Versão {h.numero} · reprovada</span>
                  <span className="whitespace-pre-line">{h.motivo}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {podeResponder && modo !== "reprovar" && (
          <div className="mt-6 flex gap-2.5">
            <button onClick={() => setModo("reprovar")} className={`flex-1 ${BOTAO_SECUNDARIO}`}>
              Reprovar
            </button>
            <button onClick={() => setModo("confirmar")} className={`flex-1 ${BOTAO_PRIMARIO}`}>
              <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4">
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Aprovar
            </button>
          </div>
        )}

        {podeResponder && modo === "reprovar" && (
          <div className="mt-6 space-y-3 motion-safe:animate-fade-up">
            <label htmlFor="motivo" className="block text-sm font-medium text-navy-900">
              O que precisa mudar?
              <span className="ml-1 font-normal text-muted-ink">(obrigatório)</span>
            </label>
            <textarea
              id="motivo"
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Ex.: trocar a foto de capa, ajustar o texto da legenda…"
              className="w-full resize-none rounded-xl border border-line bg-paper/60 p-3.5 text-[16px] leading-relaxed text-navy-900 placeholder:text-muted focus:border-copper-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-copper-100"
            />
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setModo(null);
                  setErro(null);
                }}
                className={BOTAO_SECUNDARIO}
              >
                Cancelar
              </button>
              <button
                onClick={() => enviar("reprovado")}
                disabled={pendente || motivo.trim().length === 0}
                className={`flex-1 ${BOTAO_PRIMARIO}`}
              >
                {pendente ? "Enviando…" : "Enviar reprovação"}
              </button>
            </div>
          </div>
        )}

        {erro && modo !== "confirmar" && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {erro}
          </p>
        )}
      </div>

      {modo === "confirmar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-5 motion-safe:animate-fade-in">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmar-titulo"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-dialog motion-safe:animate-modal-in"
          >
            {aprovado ? (
              <div role="status" className="flex flex-col items-center py-3 text-center">
                <Verificado />
                <p id="confirmar-titulo" className="mt-4 font-display text-xl font-medium text-navy-900 motion-safe:animate-fade-up motion-safe:[animation-delay:300ms]">
                  Conteúdo aprovado
                </p>
                <p className="mt-1 text-sm text-muted-ink motion-safe:animate-fade-up motion-safe:[animation-delay:380ms]">
                  Obrigado pela confirmação.
                </p>
              </div>
            ) : (
              <>
                <p id="confirmar-titulo" className="font-display text-xl font-medium leading-snug text-navy-900">
                  Deseja aprovar este conteúdo?
                </p>
                <p className="mt-1.5 break-words text-sm text-muted-ink">{item.titulo}</p>
                {erro && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {erro}
                  </p>
                )}
                <div className="mt-6 flex gap-2.5">
                  <button onClick={() => setModo(null)} disabled={pendente} className={`flex-1 ${BOTAO_SECUNDARIO}`}>
                    Não
                  </button>
                  <button onClick={() => enviar("aprovado")} disabled={pendente} className={`flex-1 ${BOTAO_PRIMARIO}`}>
                    {pendente ? "Aprovando…" : "Sim"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, total, children }: { titulo: string; total: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-[19px] font-medium text-navy-900">{titulo}</h2>
        {total > 0 && <span className="text-xs tabular-nums text-muted-ink">{total}</span>}
        <span aria-hidden className="h-px flex-1 translate-y-[-4px] bg-line" />
      </div>
      {children}
    </section>
  );
}

function Grade({ itens, inicio, onAbrir }: { itens: ItemFeed[]; inicio: number; onAbrir: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-[3px] overflow-hidden rounded-xl">
      {itens.map((i, n) => (
        <Miniatura key={i.id} item={i} indice={inicio + n} onAbrir={() => onAbrir(i.id)} />
      ))}
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
    <>
      <div className="space-y-9">
        <Secao titulo="Para aprovar" total={topo.length}>
          {topo.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-6 py-8 text-center text-sm text-muted-ink motion-safe:animate-fade-up motion-safe:[animation-delay:280ms]">
              Nenhum conteúdo aguardando você no momento.
            </p>
          ) : (
            <Grade itens={topo} inicio={0} onAbrir={setAbertoId} />
          )}
        </Secao>

        {aprovados.length > 0 && (
          <Secao titulo="Aprovados" total={aprovados.length}>
            <Grade itens={aprovados} inicio={topo.length} onAbrir={setAbertoId} />
          </Secao>
        )}
      </div>

      {aberto && <Detalhe key={aberto.id} item={aberto} token={token} onFechar={() => setAbertoId(null)} />}
    </>
  );
}
