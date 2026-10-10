import { formatBRL, formatDate } from "@/lib/format";

export interface RecebimentoLinha {
  id: string;
  empresa: string;
  valor: number;
  data_pagamento: string | null;
  pct_brendo: number;
  pct_victor: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function RecebimentosMes({
  mesLabel,
  linhas,
  totais,
}: {
  mesLabel: string;
  linhas: RecebimentoLinha[];
  totais: { brendo: number; victor: number; caixa: number };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-navy-900">Recebimentos do mês — divisão por pagamento</h2>
        <p className="text-xs text-slate-400">{mesLabel}. Cada pagamento recebido e como ele se divide.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pago em</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Brendo</th>
              <th className="px-4 py-3">Victor</th>
              <th className="px-4 py-3">Caixa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => {
              const b = r2((l.valor * l.pct_brendo * 0.9) / 100);
              const v = r2((l.valor * l.pct_victor * 0.9) / 100);
              const c = r2(l.valor - b - v);
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium text-navy-900">{l.empresa}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(l.data_pagamento)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatBRL(l.valor)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatBRL(b)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatBRL(v)}</td>
                  <td className="px-4 py-3 text-ok">{formatBRL(c)}</td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nenhum pagamento recebido neste mês ainda.
                </td>
              </tr>
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-navy-900">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Total do mês
                </td>
                <td className="px-4 py-3">{formatBRL(linhas.reduce((s, l) => s + l.valor, 0))}</td>
                <td className="px-4 py-3">{formatBRL(totais.brendo)}</td>
                <td className="px-4 py-3">{formatBRL(totais.victor)}</td>
                <td className="px-4 py-3">{formatBRL(totais.caixa)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
