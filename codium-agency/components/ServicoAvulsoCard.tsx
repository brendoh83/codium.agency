"use client";

import { useState, useTransition } from "react";
import { desfazerParcela, excluirServicoAvulso, marcarParcelaRecebida } from "@/actions/avulsos";
import { diasDeAtraso, formatBRL, formatDate, monthLabel } from "@/lib/format";

export interface ParcelaLinha {
  id: string;
  numero: number;
  valor: number;
  vencimento: string;
  competencia: string;
  status: "pendente" | "pago";
  data_pagamento: string | null;
}

export interface ServicoLinha {
  id: string;
  dono: string;
  descricao: string;
  forma: "avista" | "parcelado";
  valor_total: number;
  parcelas: ParcelaLinha[];
}

function Parcela({ p, total }: { p: ParcelaLinha; total: number }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [pendente, start] = useTransition();
  const atraso = p.status === "pago" ? diasDeAtraso(p.vencimento, p.data_pagamento) : 0;
  const vencida = p.status === "pendente" && p.vencimento < hoje;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <span className="text-slate-500">{total === 1 ? "À vista" : `Parcela ${p.numero}/${total}`}</span>
        <span className="ml-2 font-medium text-navy-900">{formatBRL(p.valor)}</span>
        <div className="text-xs text-slate-400">
          Vence {formatDate(p.vencimento)} · entra em {monthLabel(p.competencia)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {p.status === "pago" ? (
          <>
            <span className="rounded-full bg-ok/10 px-2 py-1 text-xs font-medium text-ok">
              Recebido em {formatDate(p.data_pagamento)}
            </span>
            {atraso > 0 && <span className="text-[11px] font-medium text-warn">com atraso ({atraso} dias)</span>}
            <button
              disabled={pendente}
              onClick={() => start(async () => void (await desfazerParcela(p.id)))}
              className="text-xs text-slate-400 hover:text-danger"
            >
              Desfazer
            </button>
          </>
        ) : (
          <>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${vencida ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn"}`}
            >
              {vencida ? "Atrasada" : "Ainda não"}
            </span>
            <input
              type="date"
              value={data}
              max={hoje}
              onChange={(e) => setData(e.target.value || hoje)}
              aria-label="Data em que foi paga"
              className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600"
            />
            <button
              disabled={pendente}
              onClick={() => start(async () => void (await marcarParcelaRecebida(p.id, data)))}
              className="rounded-md bg-ok/10 px-2 py-1 text-xs font-medium text-ok hover:bg-ok/20 disabled:opacity-50"
            >
              Marcar recebido
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export default function ServicoAvulsoCard({ s }: { s: ServicoLinha }) {
  const [pendente, start] = useTransition();
  const recebido = s.parcelas.filter((p) => p.status === "pago").reduce((x, p) => x + p.valor, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 p-4">
        <div>
          <div className="font-medium text-navy-900">{s.descricao}</div>
          <div className="text-xs text-slate-500">
            {s.dono} · {s.forma === "avista" ? "à vista" : `parcelado em ${s.parcelas.length}x`} · total{" "}
            {formatBRL(s.valor_total)} · recebido {formatBRL(recebido)}
          </div>
        </div>
        <button
          disabled={pendente}
          onClick={() => {
            if (confirm(`Excluir o serviço "${s.descricao}" e suas parcelas? Isso muda os totais dos meses.`)) {
              start(async () => void (await excluirServicoAvulso(s.id)));
            }
          }}
          className="text-xs text-slate-300 hover:text-danger"
        >
          Excluir
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {s.parcelas.map((p) => (
          <Parcela key={p.id} p={p} total={s.parcelas.length} />
        ))}
      </ul>
    </div>
  );
}
