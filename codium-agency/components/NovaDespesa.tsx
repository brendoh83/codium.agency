"use client";

import { useState, useTransition } from "react";
import { criarDespesa } from "@/actions/despesas";

const CATEGORIAS = [
  "Sistemas", "Assinaturas", "Internet", "Ferramentas", "Impostos",
  "Compra pontual", "Equipamento", "Freelancer", "Serviço eventual", "Combustível",
];

function numero(v: string): number {
  const n = Number(v.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function NovaDespesa({ mesPadrao }: { mesPadrao: string }) {
  const [tipo, setTipo] = useState<"fixa" | "variavel">("fixa");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendente, start] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setErro(null);
    setOk(false);
    start(async () => {
      const r = await criarDespesa({
        descricao: String(f.get("descricao") ?? ""),
        valor: numero(String(f.get("valor") ?? "")),
        categoria: String(f.get("categoria") ?? ""),
        tipo,
        diaVencimento: Number(f.get("dia") ?? 0),
        mesInicio: String(f.get("mes_inicio") ?? ""),
        meses: tipo === "variavel" ? Number(f.get("meses") ?? 0) : null,
      });
      if (r.erro) return setErro(r.erro);
      form.reset();
      setOk(true);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 className="text-sm font-semibold text-navy-900">Nova despesa</h2>

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setTipo("fixa")}
          className={`rounded-full border px-3 py-1.5 font-medium ${tipo === "fixa" ? "border-navy-900 bg-navy-900 text-white" : "border-slate-200 text-slate-600"}`}
        >
          Fixa (todo mês)
        </button>
        <button
          type="button"
          onClick={() => setTipo("variavel")}
          className={`rounded-full border px-3 py-1.5 font-medium ${tipo === "variavel" ? "border-navy-900 bg-navy-900 text-white" : "border-slate-200 text-slate-600"}`}
        >
          Variável (por período)
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {tipo === "fixa"
          ? "Aparece todos os meses, a partir do mês de início, até você alterar ou excluir."
          : "Vale só pelos meses que você definir. O valor é cobrado por mês."}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <input name="descricao" placeholder="Descrição (ex.: Internet)" required className="input md:col-span-2" />
        <input name="valor" inputMode="decimal" placeholder="Valor por mês (R$)" required className="input" />
        <input name="categoria" list="categorias-desp" placeholder="Categoria" className="input" />
        <datalist id="categorias-desp">
          {CATEGORIAS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <label className="text-xs text-slate-500">
          Vence todo dia
          <input name="dia" type="number" min={1} max={31} defaultValue={10} required className="input mt-1 w-full" />
        </label>
        <label className="text-xs text-slate-500">
          Começa em
          <input name="mes_inicio" type="month" defaultValue={mesPadrao} required className="input mt-1 w-full" />
        </label>
        {tipo === "variavel" && (
          <label className="text-xs text-slate-500">
            Por quantos meses
            <input name="meses" type="number" min={1} max={60} defaultValue={1} required className="input mt-1 w-full" />
          </label>
        )}
      </div>

      {erro && <p className="text-sm text-danger">{erro}</p>}
      {ok && <p className="text-sm text-ok">Despesa cadastrada.</p>}

      <button
        disabled={pendente}
        className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 disabled:opacity-50"
      >
        {pendente ? "Salvando…" : "Cadastrar despesa"}
      </button>
    </form>
  );
}
