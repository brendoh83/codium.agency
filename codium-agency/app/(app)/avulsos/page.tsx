import { createClient } from "@/lib/supabase/server";
import NovoServicoAvulso from "@/components/NovoServicoAvulso";
import ServicoAvulsoCard, { type ServicoLinha } from "@/components/ServicoAvulsoCard";

export const dynamic = "force-dynamic";

export default async function AvulsosPage() {
  const supabase = createClient();
  const [{ data: clientes }, { data: servicos }] = await Promise.all([
    supabase.from("clientes").select("id, empresa").order("empresa"),
    supabase
      .from("servicos_avulsos")
      .select(
        "id, descricao, duracao_meses, forma, valor_total, empresa_externa, created_at, clientes(empresa), servico_parcelas(id, numero, valor, vencimento, competencia, status, data_pagamento)"
      )
      .order("created_at", { ascending: false }),
  ]);

  const lista: ServicoLinha[] = ((servicos ?? []) as any[]).map((s) => ({
    id: s.id,
    dono: s.clientes?.empresa ?? s.empresa_externa ?? "—",
    descricao: s.descricao,
    duracao_meses: s.duracao_meses ?? null,
    forma: s.forma,
    valor_total: Number(s.valor_total),
    parcelas: ((s.servico_parcelas ?? []) as any[])
      .map((p) => ({ ...p, valor: Number(p.valor) }))
      .sort((a, b) => a.numero - b.numero),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Serviços avulsos</h1>
        <p className="text-sm text-slate-500">
          Trabalhos pontuais, sem contrato mensal. Cada parcela entra no mês da sua data.
        </p>
      </div>

      <NovoServicoAvulso clientes={(clientes ?? []) as { id: string; empresa: string }[]} />

      <div className="space-y-3">
        {lista.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Nenhum serviço avulso cadastrado ainda.
          </p>
        )}
        {lista.map((s) => (
          <ServicoAvulsoCard key={s.id} s={s} />
        ))}
      </div>
    </div>
  );
}
