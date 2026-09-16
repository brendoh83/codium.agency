import { createClient } from "@/lib/supabase/server";
import { criarDespesa } from "@/actions/despesas";
import DespesasLista from "@/components/DespesasLista";
import StatCard from "@/components/StatCard";
import { formatBRL, monthLabel, firstDayOfMonth, shiftMonth } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CATEGORIAS_FIXAS = ["Sistemas", "Assinaturas", "Internet", "Ferramentas"];
const CATEGORIAS_VARIAVEIS = ["Compra pontual", "Equipamento", "Freelancer", "Serviço eventual"];

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const supabase = createClient();
  const mes = searchParams.mes ?? firstDayOfMonth();

  const { data: despesas } = await supabase
    .from("despesas")
    .select("*")
    .eq("mes_referencia", mes)
    .order("data", { ascending: false });

  const lista = despesas ?? [];
  const totalFixas = lista.filter((d) => d.tipo === "fixa").reduce((s, d) => s + d.valor, 0);
  const totalVariaveis = lista.filter((d) => d.tipo === "variavel").reduce((s, d) => s + d.valor, 0);
  const totalGeral = totalFixas + totalVariaveis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Despesas</h1>
          <p className="text-sm text-slate-500">Custos fixos e variáveis da agência</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/despesas?mes=${shiftMonth(mes, -1)}`}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            ← Anterior
          </Link>
          <span className="px-2 text-sm font-medium text-navy-900">{monthLabel(mes)}</span>
          <Link
            href={`/despesas?mes=${shiftMonth(mes, 1)}`}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            Próximo →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Despesas fixas" value={formatBRL(totalFixas)} />
        <StatCard label="Despesas variáveis" value={formatBRL(totalVariaveis)} tone="warn" />
        <StatCard label="Total de despesas" value={formatBRL(totalGeral)} tone="danger" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">Nova despesa</h2>
        <form action={criarDespesa} className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input name="descricao" placeholder="Descrição" required className="input md:col-span-2" />
          <input
            name="valor"
            placeholder="Valor (R$)"
            required
            className="input"
          />
          <input
            name="categoria"
            placeholder="Categoria"
            list="categorias-despesa"
            className="input"
          />
          <datalist id="categorias-despesa">
            {[...CATEGORIAS_FIXAS, ...CATEGORIAS_VARIAVEIS].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <select name="tipo" className="input" defaultValue="variavel">
            <option value="fixa">Fixa</option>
            <option value="variavel">Variável</option>
          </select>
          <input type="date" name="data" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
          <input name="observacao" placeholder="Observação (opcional)" className="input md:col-span-3" />
          <input type="hidden" name="mes_referencia" value={mes.slice(0, 7)} />
          <button className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 md:col-span-3">
            Adicionar despesa
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          Sugestões de categoria fixa: {CATEGORIAS_FIXAS.join(", ")}. Variável:{" "}
          {CATEGORIAS_VARIAVEIS.join(", ")}.
        </p>
      </div>

      <DespesasLista despesas={lista} />
    </div>
  );
}
