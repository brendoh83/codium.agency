"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editarLegenda, excluirConteudo, reagendar } from "@/actions/conteudos";
import { dataHoraSaoPauloParaUtc, validarLegenda } from "@/lib/agendamento";
import ConteudoUpload from "@/components/ConteudoUpload";
import { ETIQUETA, Midia, Miniatura, type ItemFeed } from "@/components/FeedCliente";

const fmtSP = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
// ponytail: UTC-3 fixo (Brasil sem horário de verão)
const paraCampoLocal = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);

function Agenda({ item, clienteId }: { item: ItemFeed; clienteId: string }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState(item.legenda ?? "");
  const [quando, setQuando] = useState(item.agendadoPara ? paraCampoLocal(item.agendadoPara) : "");
  if (!item.legenda || !item.agendadoPara) return null;

  const rodar = (fn: () => Promise<{ erro?: string }>) => {
    setErro(null);
    start(async () => {
      const r = await fn();
      if (r.erro) return setErro(r.erro);
      router.refresh();
    });
  };
  const salvarLegenda = () => {
    const e = validarLegenda(texto);
    if (e) return setErro(e);
    rodar(() => editarLegenda({ clienteId, conteudoId: item.id, texto }));
  };
  const salvarData = () => {
    const iso = dataHoraSaoPauloParaUtc(quando);
    if (!iso) return setErro("Escolha o dia e a hora.");
    rodar(() => reagendar({ clienteId, conteudoId: item.id, agendadoPara: iso }));
  };

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
      <p className="text-slate-600">
        <span className="font-medium">Posta em:</span> {fmtSP(item.agendadoPara)}
        {item.partes?.data && <span className="ml-2 text-xs text-slate-400">({item.partes.data})</span>}
      </p>

      {item.sugestaoData && (
        <div className="space-y-1 rounded-lg border border-copper-500 bg-white p-2">
          <p>
            O cliente sugeriu <span className="font-medium">{fmtSP(item.sugestaoData.para)}</span>
            {item.sugestaoData.recado ? `: ${item.sugestaoData.recado}` : ""}
          </p>
          <button
            type="button"
            disabled={pendente}
            onClick={() => rodar(() => reagendar({ clienteId, conteudoId: item.id, agendadoPara: item.sugestaoData!.para, aprovada: true }))}
            className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Confirmar nova data
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="block flex-1 text-xs text-slate-500">
          Mudar a data (horário de São Paulo)
          <input
            type="datetime-local"
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <button type="button" disabled={pendente} onClick={salvarData} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-50">
          Reagendar
        </button>
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-slate-500">
          Legenda {item.partes?.legenda && <span className="text-slate-400">({item.partes.legenda})</span>}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={2200}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
          />
        </label>
        {item.motivoLegenda && <p className="text-xs text-danger">Reprovada: {item.motivoLegenda}</p>}
        <button
          type="button"
          disabled={pendente || texto.trim() === item.legenda.trim()}
          onClick={salvarLegenda}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-50"
        >
          Salvar legenda (volta para aprovação)
        </button>
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
    </div>
  );
}

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

        <Agenda item={item} clienteId={clienteId} />

        {item.historico.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {item.historico.map((h) => (
              <li key={h.numero}>
                <span className="font-medium">v{h.numero} reprovada:</span> {h.motivo}
              </li>
            ))}
          </ul>
        )}

        {(item.partes?.midia ?? item.estado) === "pendente" && (
          <div className="space-y-1">
            <p className="text-xs text-slate-500">
              O cliente ainda não respondeu. Enviar outro arquivo substitui este (continua na mesma versão).
            </p>
            <ConteudoUpload clienteId={clienteId} conteudoId={item.id} trocar tipoConteudo={item.tipo} onConcluido={onFechar} />
          </div>
        )}

        {(item.partes?.midia ?? item.estado) === "reprovado" && (
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Reprovado pelo cliente. Suba a correção como nova versão.</p>
            <ConteudoUpload clienteId={clienteId} conteudoId={item.id} tipoConteudo={item.tipo} onConcluido={onFechar} />
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
