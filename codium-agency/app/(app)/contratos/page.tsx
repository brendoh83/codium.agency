import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import { formatBRL, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const DURACAO_LABEL: Record<string, string> = {
  "1_mes": "1 mês",
  "3_meses": "3 meses",
  "6_meses": "6 meses",
  "12_meses": "12 meses",
  recorrente: "Recorrente",
};

function statusVencimento(dataFim: string | null, status: string) {
  if (status !== "ativo") return { label: "Encerrado", tone: "encerrado" };
  if (!dataFim) return { label: "Ativo", tone: "ativo" };
  const dias = Math.round(
    (new Date(dataFim + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  if (dias < 0) return { label: `Vencido (${formatDate(dataFim)})`, tone: "atrasado" };
  if (dias <= 30) return { label: `Vence em ${dias}d`, tone: "pendente" };
  return { label: "Ativo", tone: "ativo" };
}

export default async function ContratosPage() {
  const supabase = createClient();
  const { data: contratos } = await supabase
    .from("contratos")
    .select("*, clientes(id, empresa)")
    .order("data_fim", { ascending: true, nullsFirst: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Contratos</h1>
        <p className="text-sm text-slate-500">{contratos?.length ?? 0} contrato(s)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(contratos ?? []).map((c: any) => {
              const sv = statusVencimento(c.data_fim, c.status);
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.clientes?.id}`} className="font-medium text-navy-900 hover:underline">
                      {c.clientes?.empresa}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.tipo || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{DURACAO_LABEL[c.duracao]}</td>
                  <td className="px-4 py-3 font-medium">{formatBRL(c.valor)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.data_inicio)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sv.tone} />
                    <span className="ml-2 text-xs text-slate-400">{sv.label}</span>
                  </td>
                </tr>
              );
            })}
            {(contratos ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum contrato cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
