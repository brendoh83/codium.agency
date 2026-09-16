import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const supabase = createClient();

  let query = supabase
    .from("clientes")
    .select("*")
    .order("empresa");

  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (searchParams.q) query = query.ilike("empresa", `%${searchParams.q}%`);

  const [{ data: clientes }, { data: resumoServicos }, { data: saude }] = await Promise.all([
    query,
    supabase.from("v_cliente_servicos_resumo").select("*"),
    supabase.from("v_saude_cliente").select("cliente_id, classificacao, score"),
  ]);

  const servicosPorCliente = new Map((resumoServicos ?? []).map((r: any) => [r.cliente_id, r]));
  const saudePorCliente = new Map((saude ?? []).map((s: any) => [s.cliente_id, s]));

  const status = searchParams.status;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Clientes</h1>
          <p className="text-sm text-slate-500">{clientes?.length ?? 0} cliente(s)</p>
        </div>
        <Link
          href="/clientes/novo"
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950"
        >
          + Novo Cliente
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "Todos", value: undefined },
          { label: "Ativos", value: "ativo" },
          { label: "Pausados", value: "pausado" },
          { label: "Cancelados", value: "cancelado" },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/clientes?status=${f.value}` : "/clientes"}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              status === f.value
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Serviços</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Satisfação</th>
              <th className="px-4 py-3">Saúde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(clientes ?? []).map((c: any) => {
              const servicos = servicosPorCliente.get(c.id);
              const saudeCliente = saudePorCliente.get(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={undefined}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-navy-900 hover:underline">
                      {c.empresa}
                    </Link>
                    <div className="text-xs text-slate-400">{c.responsavel}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {servicos?.servicos?.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-navy-900">{formatBRL(c.valor_mensal)}</td>
                  <td className="px-4 py-3 text-slate-600">Dia {c.dia_pagamento ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.satisfacao_atual != null ? `${c.satisfacao_atual}/10` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={saudeCliente?.classificacao ?? c.temperatura} />
                  </td>
                </tr>
              );
            })}
            {(clientes ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="space-y-3 md:hidden">
        {(clientes ?? []).map((c: any) => {
          const servicos = servicosPorCliente.get(c.id);
          const saudeCliente = saudePorCliente.get(c.id);
          return (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-navy-900">{c.empresa}</div>
                  <div className="text-xs text-slate-400">{servicos?.servicos?.join(", ") || "—"}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-medium text-navy-900">{formatBRL(c.valor_mensal)}</span>
                <span className="text-xs text-slate-500">Dia {c.dia_pagamento ?? "—"}</span>
                <StatusBadge status={saudeCliente?.classificacao ?? c.temperatura} />
              </div>
            </Link>
          );
        })}
        {(clientes ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Nenhum cliente cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
