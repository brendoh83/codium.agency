"use client";

import { useMemo, useState, useTransition } from "react";
import { criarServicoAvulso } from "@/actions/avulsos";
import { competenciaDe, gerarParcelas, validarParcelas } from "@/lib/avulsos";
import { formatBRL, monthLabel } from "@/lib/format";

type Cliente = { id: string; empresa: string };

function numero(v: string): number {
  const n = Number(v.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function NovoServicoAvulso({ clientes }: { clientes: Cliente[] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [donoTipo, setDonoTipo] = useState<"cliente" | "externa">("cliente");
  const [clienteId, setClienteId] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [descricao, setDescricao] = useState("");
  const [forma, setForma] = useState<"avista" | "parcelado">("avista");
  const [valorTexto, setValorTexto] = useState("");
  const [duracaoTexto, setDuracaoTexto] = useState("");
  const [qtd, setQtd] = useState(2);
  const [primeira, setPrimeira] = useState(hoje);
  const [edicoes, setEdicoes] = useState<Record<number, { valor?: string; vencimento?: string }>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendente, start] = useTransition();

  const total = Math.round(numero(valorTexto) * 100) / 100;

  const parcelas = useMemo(() => {
    const base = gerarParcelas(total, forma === "avista" ? 1 : qtd, primeira);
    return base.map((p) => {
      const e = edicoes[p.numero] ?? {};
      return {
        numero: p.numero,
        valor: e.valor !== undefined ? numero(e.valor) : p.valor,
        valorTexto: e.valor !== undefined ? e.valor : String(p.valor).replace(".", ","),
        vencimento: e.vencimento ?? p.vencimento,
      };
    });
  }, [total, forma, qtd, primeira, edicoes]);

  const soma = Math.round(parcelas.reduce((s, p) => s + p.valor, 0) * 100) / 100;
  const diferenca = Math.round((total - soma) * 100) / 100;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    if (!descricao.trim()) return setErro("Descreva o serviço.");
    if (donoTipo === "cliente" && !clienteId) return setErro("Escolha o cliente.");
    if (donoTipo === "externa" && !empresa.trim()) return setErro("Informe o nome da empresa.");
    const problema = validarParcelas(total, parcelas);
    if (problema) return setErro(problema);
    start(async () => {
      const r = await criarServicoAvulso({
        clienteId: donoTipo === "cliente" ? clienteId : null,
        empresaExterna: donoTipo === "externa" ? empresa : "",
        descricao,
        duracaoMeses: Number.isInteger(Number(duracaoTexto)) && Number(duracaoTexto) > 0 ? Number(duracaoTexto) : null,
        forma,
        valorTotal: total,
        parcelas: parcelas.map((p) => ({ valor: p.valor, vencimento: p.vencimento })),
      });
      if (r.erro) return setErro(r.erro);
      setDescricao("");
      setValorTexto("");
      setDuracaoTexto("");
      setEdicoes({});
      setOk(true);
    });
  }

  return (
    <form onSubmit={salvar} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-navy-900">Novo serviço avulso</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDonoTipo("cliente")}
              className={`rounded-full border px-3 py-1.5 font-medium ${donoTipo === "cliente" ? "border-navy-900 bg-navy-900 text-white" : "border-slate-200 text-slate-600"}`}
            >
              Cliente nosso
            </button>
            <button
              type="button"
              onClick={() => setDonoTipo("externa")}
              className={`rounded-full border px-3 py-1.5 font-medium ${donoTipo === "externa" ? "border-navy-900 bg-navy-900 text-white" : "border-slate-200 text-slate-600"}`}
            >
              Empresa de fora
            </button>
          </div>
          {donoTipo === "cliente" ? (
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input w-full">
              <option value="">Escolha o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.empresa}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Nome da empresa"
              className="input w-full"
            />
          )}
        </div>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="O que é o serviço (ex.: Cobertura do evento da loja 2)"
          maxLength={200}
          className="input w-full"
        />
        <label className="text-xs text-slate-500 md:col-span-2">
          Duração do serviço em meses (opcional — ex.: evento de 3 meses)
          <input
            value={duracaoTexto}
            onChange={(e) => setDuracaoTexto(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Vazio = serviço pontual"
            className="input mt-1 w-full md:w-60"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Pagamento:</span>
        <button
          type="button"
          onClick={() => {
            setForma("avista");
            setEdicoes({});
          }}
          className={`rounded-full border px-3 py-1.5 font-medium ${forma === "avista" ? "border-navy-900 bg-navy-900 text-white" : "border-slate-200 text-slate-600"}`}
        >
          À vista
        </button>
        <button
          type="button"
          onClick={() => {
            setForma("parcelado");
            setEdicoes({});
          }}
          className={`rounded-full border px-3 py-1.5 font-medium ${forma === "parcelado" ? "border-navy-900 bg-navy-900 text-white" : "border-slate-200 text-slate-600"}`}
        >
          Parcelado
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-500">
          Valor total (R$)
          <input
            value={valorTexto}
            onChange={(e) => {
              setValorTexto(e.target.value);
              setEdicoes({});
            }}
            inputMode="decimal"
            placeholder="0,00"
            className="input mt-1 w-full"
          />
        </label>
        {forma === "parcelado" && (
          <label className="text-xs text-slate-500">
            Número de parcelas
            <input
              type="number"
              min={2}
              max={60}
              value={qtd}
              onChange={(e) => {
                setQtd(Math.max(2, Math.min(60, Number(e.target.value) || 2)));
                setEdicoes({});
              }}
              className="input mt-1 w-full"
            />
          </label>
        )}
        <label className="text-xs text-slate-500">
          {forma === "avista" ? "Data prevista de recebimento" : "Data da primeira parcela"}
          <input
            type="date"
            value={primeira}
            onChange={(e) => {
              setPrimeira(e.target.value);
              setEdicoes({});
            }}
            className="input mt-1 w-full"
          />
        </label>
      </div>

      {parcelas.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {forma === "avista" ? "Recebimento" : "Parcelas (pode ajustar valor e data)"}
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {parcelas.map((p) => (
              <li key={p.numero} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="w-16 text-slate-500">{forma === "avista" ? "À vista" : `${p.numero}/${parcelas.length}`}</span>
                <input
                  type="date"
                  value={p.vencimento}
                  onChange={(e) => setEdicoes((x) => ({ ...x, [p.numero]: { ...x[p.numero], vencimento: e.target.value } }))}
                  className="input w-40"
                />
                <input
                  value={p.valorTexto}
                  onChange={(e) => setEdicoes((x) => ({ ...x, [p.numero]: { ...x[p.numero], valor: e.target.value } }))}
                  inputMode="decimal"
                  className="input w-28"
                  aria-label={`Valor da parcela ${p.numero}`}
                />
                <span className="text-xs text-slate-400">
                  entra em <span className="font-medium text-slate-600">{monthLabel(competenciaDe(p.vencimento))}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs">
            <span className="text-slate-500">Soma das parcelas: {formatBRL(soma)}</span>
            {diferenca !== 0 && (
              <span className="font-medium text-warn">
                {diferenca > 0 ? `Faltam ${formatBRL(diferenca)}` : `Sobram ${formatBRL(-diferenca)}`} para fechar o total
              </span>
            )}
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-danger">{erro}</p>}
      {ok && <p className="text-sm text-ok">Serviço cadastrado.</p>}

      <button
        disabled={pendente}
        className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 disabled:opacity-50"
      >
        {pendente ? "Salvando…" : "Cadastrar serviço"}
      </button>
    </form>
  );
}
