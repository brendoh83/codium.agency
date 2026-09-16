"use client";

import { useMemo, useState } from "react";
import type { Servico } from "@/lib/types";
import { formatBRL } from "@/lib/format";

export default function ClienteForm({
  servicos,
  action,
}: {
  servicos: Servico[];
  action: (formData: FormData) => void;
}) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [valorMensal, setValorMensal] = useState<string>("");
  const [composicao, setComposicao] = useState<Record<string, string>>({});
  const [duracao, setDuracao] = useState("recorrente");
  const [pctBrendo, setPctBrendo] = useState("50");

  const pctBrendoNum = Math.min(100, Math.max(0, Number(pctBrendo.replace(",", ".")) || 0));
  const pctVictorNum = Math.round((100 - pctBrendoNum) * 100) / 100;

  const somaComposicao = useMemo(
    () =>
      selecionados.reduce((acc, id) => acc + (Number(composicao[id]?.replace(",", ".")) || 0), 0),
    [selecionados, composicao]
  );
  const valorNum = Number(valorMensal.replace(",", ".")) || 0;
  const diferenca = Math.round((valorNum - somaComposicao) * 100) / 100;

  function toggleServico(id: string) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <form action={action} className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">Dados básicos</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome da empresa" name="empresa" required />
          <Field label="Nome do responsável" name="responsavel" />
          <Field label="WhatsApp" name="whatsapp" placeholder="(00) 00000-0000" />
          <Field label="Instagram" name="instagram" placeholder="@empresa" />
          <Field label="Cidade" name="cidade" />
          <Field label="Nicho" name="nicho" />
          <Field label="Data de início" name="data_inicio" type="date" />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select name="status" defaultValue="ativo" className="input">
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">Observações</label>
          <textarea name="observacoes" rows={3} className="input" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-navy-900">Plano e serviços contratados</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Nome do plano" name="plano" placeholder="Ex: Gestão Completa" />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Valor mensal (R$)</label>
            <input
              name="valor_mensal"
              value={valorMensal}
              onChange={(e) => setValorMensal(e.target.value)}
              className="input"
              placeholder="1500.00"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Dia de pagamento</label>
            <input
              type="number"
              min={1}
              max={28}
              name="dia_pagamento"
              defaultValue={10}
              className="input"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs font-medium text-slate-600">
            Serviços contratados (pode marcar mais de um)
          </label>
          <div className="space-y-2">
            {servicos.map((s) => {
              const ativo = selecionados.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    ativo ? "border-navy-900 bg-copper-100/30" : "border-slate-200"
                  }`}
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="servicos"
                      value={s.id}
                      checked={ativo}
                      onChange={() => toggleServico(s.id)}
                    />
                    {s.nome}
                  </label>
                  {ativo && (
                    <input
                      className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Valor (R$)"
                      name={`valor_servico_${s.id}`}
                      value={composicao[s.id] ?? ""}
                      onChange={(e) => setComposicao((p) => ({ ...p, [s.id]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {selecionados.length > 0 && (
            <p
              className={`mt-2 text-xs ${
                Math.abs(diferenca) < 0.01 || somaComposicao === 0 ? "text-slate-400" : "text-warn"
              }`}
            >
              {somaComposicao === 0
                ? "Se não informar o valor por serviço, o valor mensal será dividido igualmente entre eles."
                : Math.abs(diferenca) < 0.01
                ? "Composição bate com o valor mensal."
                : `Composição soma ${somaComposicao.toFixed(2)} — diferença de R$ ${diferenca.toFixed(2)} em relação ao valor mensal.`}
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Duração do contrato</label>
            <select
              name="duracao"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              className="input"
            >
              <option value="recorrente">Recorrente / sem prazo definido</option>
              <option value="1_mes">1 mês</option>
              <option value="3_meses">3 meses</option>
              <option value="6_meses">6 meses</option>
              <option value="12_meses">12 meses</option>
            </select>
          </div>
          {duracao !== "recorrente" && (
            <Field label="Data de término" name="data_fim" type="date" />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="mb-1 text-sm font-semibold text-navy-900">Divisão de ganhos</h2>
        <p className="mb-4 text-xs text-slate-400">
          Percentual de cada sócio sobre o valor mensal deste cliente. A soma precisa fechar 100%.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">% Brendo</label>
            <input
              name="pct_brendo"
              value={pctBrendo}
              onChange={(e) => setPctBrendo(e.target.value)}
              className="input"
              placeholder="50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              % Victor (completa 100%)
            </label>
            <input
              className="input bg-slate-50 text-slate-500"
              value={pctVictorNum}
              readOnly
            />
            <input type="hidden" name="pct_victor" value={pctVictorNum} />
          </div>
        </div>
        <DivisaoPreview valorMensal={valorNum} pctBrendo={pctBrendoNum} pctVictor={pctVictorNum} />
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          className="rounded-lg bg-navy-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-navy-950"
        >
          Salvar cliente
        </button>
      </div>

    </form>
  );
}

export function DivisaoPreview({
  valorMensal,
  pctBrendo,
  pctVictor,
}: {
  valorMensal: number;
  pctBrendo: number;
  pctVictor: number;
}) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const brutoBrendo = round2((valorMensal * pctBrendo) / 100);
  const brutoVictor = round2((valorMensal * pctVictor) / 100);
  const caixaBrendo = round2(brutoBrendo * 0.1);
  const caixaVictor = round2(brutoVictor * 0.1);
  const liquidoBrendo = round2(brutoBrendo - caixaBrendo);
  const liquidoVictor = round2(brutoVictor - caixaVictor);
  const caixaTotal = round2(caixaBrendo + caixaVictor);

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <MiniStat label="Ganho bruto Brendo" value={formatBRL(brutoBrendo)} />
      <MiniStat label="Ganho bruto Victor" value={formatBRL(brutoVictor)} />
      <MiniStat label="Ganho líquido Brendo" value={formatBRL(liquidoBrendo)} sub="após 10% pro caixa" />
      <MiniStat label="Ganho líquido Victor" value={formatBRL(liquidoVictor)} sub="após 10% pro caixa" />
      <MiniStat label="Vai pro caixa da empresa" value={formatBRL(caixaTotal)} />
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-navy-900">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input type={type} name={name} required={required} placeholder={placeholder} className="input" />
    </div>
  );
}
