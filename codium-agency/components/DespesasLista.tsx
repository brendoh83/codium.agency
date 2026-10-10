"use client";

import { useState, useTransition } from "react";
import {
  alterarValorDaqueParaFrente,
  desfazerDespesaPaga,
  excluirDaquiParaFrente,
  excluirOcorrencia,
  marcarDespesaPaga,
} from "@/actions/despesas";
import { dividirIgual, validarCobertura } from "@/lib/despesas";
import type { Socio } from "@/lib/divisao";
import { formatBRL, formatDate } from "@/lib/format";

export interface DespesaItem {
  id: string;
  modelo_id: string | null;
  descricao: string;
  categoria: string | null;
  tipo: string;
  valor: number;
  vencimento: string | null;
  pago: boolean;
  data_pagamento: string | null;
  coberturas: { socio: Socio; valor: number }[];
}

function numero(v: string): number {
  const n = Number(v.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function Linha({ d }: { d: DespesaItem }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const [cobertura, setCobertura] = useState<null | { falta: number; disponivel: number }>(null);
  const [partes, setPartes] = useState<{ brendo: string; victor: string }>({ brendo: "", victor: "" });

  const atrasada = !d.pago && d.vencimento !== null && d.vencimento < hoje;

  function pagar(coberturas?: { socio: Socio; valor: number }[]) {
    setErro(null);
    start(async () => {
      const r = await marcarDespesaPaga({ despesaId: d.id, data, coberturas });
      if (r.erro) return setErro(r.erro);
      if (r.precisaCobertura) {
        const metade = dividirIgual(r.precisaCobertura.falta);
        setPartes({
          brendo: String(metade.brendo).replace(".", ","),
          victor: String(metade.victor).replace(".", ","),
        });
        setCobertura(r.precisaCobertura);
        return;
      }
      setCobertura(null);
    });
  }

  function confirmarCobertura() {
    if (!cobertura) return;
    const lista: { socio: Socio; valor: number }[] = [
      { socio: "brendo", valor: numero(partes.brendo) },
      { socio: "victor", valor: numero(partes.victor) },
    ].filter((p) => p.valor > 0) as { socio: Socio; valor: number }[];
    const problema = validarCobertura(cobertura.falta, lista);
    if (problema) return setErro(problema);
    pagar(lista);
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-navy-900">{d.descricao}</div>
          <div className="text-xs text-slate-400">
            {[d.categoria, d.tipo === "fixa" ? "fixa" : "variável"].filter(Boolean).join(" · ")}
            {d.vencimento && ` · vence ${formatDate(d.vencimento)}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-navy-900">{formatBRL(d.valor)}</span>
          {d.pago ? (
            <>
              <span className="rounded-full bg-ok/10 px-2 py-1 text-xs font-medium text-ok">
                Paga em {formatDate(d.data_pagamento)}
              </span>
              <button
                disabled={pendente}
                onClick={() => start(async () => void (await desfazerDespesaPaga(d.id)))}
                className="text-xs text-slate-400 hover:text-danger"
              >
                Desfazer
              </button>
            </>
          ) : (
            <>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${atrasada ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn"}`}
              >
                {atrasada ? "Atrasada" : "A pagar"}
              </span>
              <input
                type="date"
                value={data}
                max={hoje}
                onChange={(e) => setData(e.target.value || hoje)}
                aria-label="Data do pagamento"
                className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600"
              />
              <button
                disabled={pendente}
                onClick={() => pagar()}
                className="rounded-md bg-ok/10 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/20 disabled:opacity-50"
              >
                Marcar paga
              </button>
            </>
          )}
        </div>
      </div>

      {d.pago && d.coberturas.length > 0 && (
        <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          Caixa não cobriu tudo. Diferença coberta por:{" "}
          {d.coberturas
            .map((c) => `${c.socio === "brendo" ? "Brendo" : "Victor"} ${formatBRL(c.valor)}`)
            .join(" + ")}
          .
        </p>
      )}

      {cobertura && (
        <div className="space-y-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
          <p className="font-medium text-navy-900">
            Esta despesa é {formatBRL(d.valor)} e há {formatBRL(Math.max(0, cobertura.disponivel))} no caixa. A diferença
            de {formatBRL(cobertura.falta)} sairá de quem?
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-600">
              Brendo (R$)
              <input
                value={partes.brendo}
                onChange={(e) => setPartes((p) => ({ ...p, brendo: e.target.value }))}
                inputMode="decimal"
                className="input mt-1 w-28"
              />
            </label>
            <label className="text-xs text-slate-600">
              Victor (R$)
              <input
                value={partes.victor}
                onChange={(e) => setPartes((p) => ({ ...p, victor: e.target.value }))}
                inputMode="decimal"
                className="input mt-1 w-28"
              />
            </label>
            <button
              disabled={pendente}
              onClick={() => {
                const t = dividirIgual(cobertura.falta);
                setPartes({ brendo: String(t.brendo).replace(".", ","), victor: String(t.victor).replace(".", ",") });
              }}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
            >
              Meio a meio
            </button>
            <button
              disabled={pendente}
              onClick={() => setPartes({ brendo: String(cobertura.falta).replace(".", ","), victor: "" })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
            >
              100% Brendo
            </button>
            <button
              disabled={pendente}
              onClick={() => setPartes({ brendo: "", victor: String(cobertura.falta).replace(".", ",") })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
            >
              100% Victor
            </button>
          </div>
          <div className="flex gap-2">
            <button
              disabled={pendente}
              onClick={confirmarCobertura}
              className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Confirmar pagamento
            </button>
            <button onClick={() => setCobertura(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-xs text-danger">{erro}</p>}

      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        {d.modelo_id && d.tipo === "fixa" && !d.pago && (
          <button
            disabled={pendente}
            onClick={() => {
              const t = prompt(`Novo valor mensal de "${d.descricao}" (vale daqui para frente):`, String(d.valor).replace(".", ","));
              if (t === null) return;
              const v = numero(t);
              start(async () => {
                const r = await alterarValorDaqueParaFrente(d.modelo_id!, v);
                if (r.erro) setErro(r.erro);
              });
            }}
            className="hover:text-navy-900"
          >
            Alterar valor daqui para frente
          </button>
        )}
        {d.modelo_id && (
          <button
            disabled={pendente}
            onClick={() => {
              if (confirm(`Excluir "${d.descricao}" daqui para frente? Os meses já pagos e os passados ficam.`)) {
                start(async () => void (await excluirDaquiParaFrente(d.modelo_id!)));
              }
            }}
            className="hover:text-danger"
          >
            Excluir daqui para frente
          </button>
        )}
        <button
          disabled={pendente}
          onClick={() => {
            if (confirm(`Excluir só esta ocorrência de "${d.descricao}"?`)) {
              start(async () => void (await excluirOcorrencia(d.id)));
            }
          }}
          className="hover:text-danger"
        >
          Excluir só este mês
        </button>
      </div>
    </li>
  );
}

export default function DespesasLista({ despesas }: { despesas: DespesaItem[] }) {
  if (despesas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
        Nenhuma despesa neste mês.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      {despesas.map((d) => (
        <Linha key={d.id} d={d} />
      ))}
    </ul>
  );
}
