import { createClient } from "@/lib/supabase/server";
import { fecharMes } from "@/actions/fechamentos";
import HistoricoLista from "@/components/HistoricoLista";
import { formatBRL, monthLabel, firstDayOfMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const supabase = createClient();
  const mesAtual = firstDayOfMonth();

  const [{ data: fechamentos }, { data: meses }] = await Promise.all([
    supabase.from("fechamentos_mensais").select("*").order("mes", { ascending: false }),
    supabase.from("v_financeiro_mes").select("*").lte("mes", mesAtual).order("mes", { ascending: false }),
  ]);

  const fechados = new Set((fechamentos ?? []).map((f: any) => f.mes));
  const abertos: any[] = (meses ?? []).filter((m: any) => !fechados.has(m.mes));
  // o mês atual sempre aparece para fechar, mesmo sem movimento ainda
  if (!fechados.has(mesAtual) && !abertos.some((m) => m.mes === mesAtual)) {
    abertos.unshift({ mes: mesAtual });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Histórico</h1>
        <p className="text-sm text-slate-500">Fechamento financeiro salvo mês a mês</p>
      </div>

      {abertos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Meses em aberto</h2>
          {abertos.map((m) => {
            const atual = m.mes === mesAtual;
            const pendente = Number(m.total_pendente ?? 0) + Number(m.total_atrasado ?? 0);
            return (
              <div
                key={m.mes}
                className="rounded-xl border border-dashed border-copper-500/40 bg-copper-100/20 p-5"
              >
                <h3 className="mb-1 text-sm font-semibold text-navy-900">
                  {monthLabel(m.mes)} {atual ? "ainda não foi fechado" : "— mês passado, ainda em aberto"}
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Prévia com os números de hoje: faturamento {formatBRL(m.faturamento_total ?? 0)}, recebido{" "}
                  {formatBRL(m.total_recebido ?? 0)}, saldo do caixa {formatBRL(m.saldo_caixa ?? 0)}.
                  {pendente > 0 && !atual
                    ? ` Ainda há ${formatBRL(pendente)} sem receber: fechar agora congela sem esse valor, e dá para fechar de novo depois.`
                    : " Você pode fechar o mês de novo depois, para atualizar os números salvos."}
                </p>
                <form action={fecharMes.bind(null, m.mes)}>
                  <button className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950">
                    Fechar {monthLabel(m.mes)}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <HistoricoLista fechamentos={fechamentos ?? []} />
    </div>
  );
}
