"use client";

import { useState, useTransition } from "react";
import { excluirRepasse, registrarRepasse } from "@/actions/repasses";
import { avisoExcedente, avisoMovimentacao, rotuloSocio, type Socio } from "@/lib/divisao";
import { formatBRL, formatDate } from "@/lib/format";

export interface DivisaoMes {
  faturamento: number;
  devido_brendo: number;
  devido_victor: number;
  devido_caixa: number;
  entrou_brendo: number;
  entrou_victor: number;
  repassado_brendo: number;
  repassado_victor: number;
  excesso_brendo: number;
  excesso_victor: number;
  caixa_apos_retiradas: number;
  diferenca_movimentacao: number;
  cobertura_brendo: number;
  cobertura_victor: number;
}

export interface RepasseLinha {
  id: string;
  socio: Socio;
  valor: number;
  data: string;
  observacao: string | null;
}

function Coluna({ socio, d }: { socio: Socio; d: DivisaoMes }) {
  const devido = socio === "brendo" ? d.devido_brendo : d.devido_victor;
  const repassado = socio === "brendo" ? d.repassado_brendo : d.repassado_victor;
  const entrou = socio === "brendo" ? d.entrou_brendo : d.entrou_victor;
  const cobriu = socio === "brendo" ? d.cobertura_brendo : d.cobertura_victor;
  const aRepassar = Math.max(0, devido - cobriu - repassado);
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-sm font-semibold text-navy-900">{rotuloSocio(socio)}</div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Devido no mês</dt>
          <dd className="font-medium text-navy-900">{formatBRL(devido)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Já entrou na agência</dt>
          <dd className="text-slate-700">{formatBRL(entrou)}</dd>
        </div>
        {cobriu > 0 && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Cobriu despesas</dt>
            <dd className="text-slate-700">− {formatBRL(cobriu)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-slate-500">Repassado</dt>
          <dd className="font-medium text-ok">{formatBRL(repassado)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-1">
          <dt className="text-slate-500">A repassar</dt>
          <dd className="font-semibold text-navy-900">{formatBRL(aRepassar)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function RepassesSecao({
  mesISO,
  mesLabel,
  divisao,
  repasses,
}: {
  mesISO: string;
  mesLabel: string;
  divisao: DivisaoMes;
  repasses: RepasseLinha[];
}) {
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  const notas = (["brendo", "victor"] as Socio[])
    .map((s) => avisoExcedente(s, s === "brendo" ? divisao.excesso_brendo : divisao.excesso_victor, mesLabel))
    .filter(Boolean) as string[];
  const alerta = avisoMovimentacao({
    repassado: divisao.repassado_brendo + divisao.repassado_victor,
    faturamento: divisao.faturamento,
    diferenca: divisao.diferenca_movimentacao,
    mes: mesLabel,
  });

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    setErro(null);
    start(async () => {
      const r = await registrarRepasse(dados);
      if (r.erro) return setErro(r.erro);
      form.reset();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-navy-900">Repasses aos sócios — {mesLabel}</h2>
      <p className="mb-4 text-xs text-slate-400">
        O que de fato foi para a conta de cada um, ligado ao mês a que se refere.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Coluna socio="brendo" d={divisao} />
        <Coluna socio="victor" d={divisao} />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Caixa do mês após retiradas dos sócios:{" "}
        <span className="font-semibold text-navy-900">{formatBRL(divisao.caixa_apos_retiradas)}</span>
      </p>

      {notas.map((n) => (
        <p key={n} className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {n}
        </p>
      ))}
      {alerta && (
        <p role="alert" className="mt-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs font-medium text-navy-900">
          {alerta}
        </p>
      )}

      <form onSubmit={enviar} className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <select name="socio" defaultValue="" required className="input md:col-span-1">
          <option value="" disabled>
            Sócio
          </option>
          <option value="brendo">Brendo</option>
          <option value="victor">Victor</option>
        </select>
        <input name="valor" inputMode="decimal" placeholder="Valor (R$)" required className="input" />
        <input type="date" name="data" defaultValue={hoje} max={hoje} className="input" />
        <input type="month" name="mes_referencia" defaultValue={mesISO.slice(0, 7)} required className="input" />
        <input name="observacao" placeholder="Observação (opcional)" className="input col-span-2 md:col-span-1" />
        <button
          disabled={pendente}
          className="col-span-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 disabled:opacity-50 md:col-span-1"
        >
          {pendente ? "Salvando…" : "Registrar repasse"}
        </button>
      </form>
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}

      {repasses.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {repasses.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <span className="font-medium text-navy-900">{rotuloSocio(r.socio)}</span>{" "}
                <span className="text-slate-600">{formatBRL(r.valor)}</span>
                <span className="ml-2 text-xs text-slate-400">{formatDate(r.data)}</span>
                {r.observacao && <div className="text-xs text-slate-500">{r.observacao}</div>}
              </div>
              <button
                disabled={pendente}
                onClick={() => {
                  if (confirm(`Excluir o repasse de ${formatBRL(r.valor)} para ${rotuloSocio(r.socio)}?`)) {
                    start(async () => {
                      const x = await excluirRepasse(r.id);
                      if (x.erro) setErro(x.erro);
                    });
                  }
                }}
                className="text-xs text-slate-400 hover:text-danger"
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
