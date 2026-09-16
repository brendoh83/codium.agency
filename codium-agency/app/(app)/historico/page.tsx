import { createClient } from "@/lib/supabase/server";
import { fecharMes } from "@/actions/fechamentos";
import HistoricoLista from "@/components/HistoricoLista";
import { formatBRL, monthLabel, firstDayOfMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const supabase = createClient();
  const mesAtual = firstDayOfMonth();

  const [{ data: fechamentos }, { data: previaMesAtual }] = await Promise.all([
    supabase.from("fechamentos_mensais").select("*").order("mes", { ascending: false }),
    supabase.from("v_financeiro_mes").select("*").eq("mes", mesAtual).maybeSingle(),
  ]);

  const jaFechado = (fechamentos ?? []).some((f: any) => f.mes === mesAtual);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Histórico</h1>
        <p className="text-sm text-slate-500">Fechamento financeiro salvo mês a mês</p>
      </div>

      {!jaFechado && (
        <div className="rounded-xl border border-dashed border-copper-500/40 bg-copper-100/20 p-5">
          <h2 className="mb-1 text-sm font-semibold text-navy-900">
            {monthLabel(mesAtual)} ainda não foi fechado
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Prévia com os números de hoje: faturamento {formatBRL(previaMesAtual?.faturamento_total ?? 0)},
            recebido {formatBRL(previaMesAtual?.total_recebido ?? 0)}, saldo do caixa{" "}
            {formatBRL(previaMesAtual?.saldo_caixa ?? 0)}. Você pode fechar o mês quantas vezes quiser
            até o dia acabar — fechar de novo atualiza os números salvos.
          </p>
          <form action={fecharMes.bind(null, mesAtual)}>
            <button className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950">
              Fechar {monthLabel(mesAtual)}
            </button>
          </form>
        </div>
      )}

      <HistoricoLista fechamentos={fechamentos ?? []} />
    </div>
  );
}
